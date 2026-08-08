package dev.shivarya.expensetracker

import android.content.Context
import android.util.Log
import androidx.work.Constraints
import androidx.work.Data
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import org.json.JSONArray
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.TimeUnit

/**
 * Syncs one incoming bank SMS and posts its notification, entirely in native code.
 *
 * This exists because SmsBridgeModule.emitIncomingSMS() no-ops whenever the RN JS
 * engine isn't running — which is exactly the case when Android wakes the process
 * only to deliver SMS_RECEIVED. The JS path could therefore never notify in the
 * common "app not open" case; it only enqueued to SmsQueueStore and waited for the
 * user to open the app. Networking style mirrors WidgetSummarySyncer (HttpURLConnection
 * + org.json, no OkHttp/coroutines).
 */
class SmsTransactionWorker(context: Context, params: WorkerParameters) : Worker(context, params) {

  override fun doWork(): Result {
    val sender = inputData.getString(KEY_SENDER).orEmpty()
    val body = inputData.getString(KEY_BODY).orEmpty()
    val date = inputData.getLong(KEY_DATE, 0L)

    if (body.isBlank()) {
      Log.i(TAG, "Skipping: empty body")
      return Result.success()
    }

    val session = WidgetDataStore.getSession(applicationContext)
    if (!session.isReady) {
      // No stored credentials to work with. SmsQueueStore still holds this SMS,
      // so the JS drain on next app open covers it. Retrying here would never help.
      Log.w(TAG, "No session; leaving SMS to the queue fallback")
      return Result.success()
    }

    var connection: HttpURLConnection? = null

    return try {
      val payload = JSONObject().put(
        "messages",
        JSONArray().put(
          JSONObject()
            .put("sender", sender)
            .put("body", body)
            .put("date", formatDate(date)),
        ),
      )

      Log.i(TAG, "Posting SMS from '$sender' to /parse/sms")

      connection = (URL("${session.baseUrl}/parse/sms").openConnection() as HttpURLConnection).apply {
        requestMethod = "POST"
        connectTimeout = 20000
        readTimeout = 40000
        doOutput = true
        setRequestProperty("Accept", "application/json")
        setRequestProperty("Content-Type", "application/json")
        setRequestProperty("Authorization", "Bearer ${session.token}")
      }

      OutputStreamWriter(connection.outputStream, Charsets.UTF_8).use { it.write(payload.toString()) }

      val statusCode = connection.responseCode
      val responseBody = when {
        statusCode in 200..299 -> connection.inputStream?.bufferedReader()?.use { it.readText() }.orEmpty()
        else -> connection.errorStream?.bufferedReader()?.use { it.readText() }.orEmpty()
      }

      if (statusCode == 401) {
        // Stored token went stale; only a foreground app run can refresh it.
        Log.w(TAG, "401 — stored token stale, leaving SMS to the queue fallback")
        return Result.success()
      }

      if (statusCode !in 200..299) {
        Log.w(TAG, "HTTP $statusCode — will retry")
        return Result.retry()
      }

      val json = JSONObject(responseBody)
      if (!json.optBoolean("success", false)) {
        Log.w(TAG, "Server reported failure: ${json.optString("error", "unknown")}")
        return Result.success()
      }

      val data = json.optJSONObject("data")
      val created = data?.optJSONArray("transactions")
      if (created == null || created.length() == 0) {
        // Normal for a non-transactional SMS (the AI prompt drops administrative
        // alerts), or one the duplicate detector matched to an existing row.
        Log.i(
          TAG,
          "No notification: parsed=${data?.optInt("parsed_transactions", 0)} " +
            "saved=${data?.optInt("saved_transactions", 0)} " +
            "duplicates=${data?.optInt("skipped_duplicates", 0)}",
        )
        return Result.success()
      }

      for (index in 0 until created.length()) {
        val txn = created.optJSONObject(index) ?: continue
        val transactionId = txn.optInt("id", 0)
        if (transactionId <= 0) continue

        SmsNotifier.notifyTransaction(
          context = applicationContext,
          transactionId = transactionId,
          categoryName = txn.optString("category_name").takeIf { it.isNotBlank() && it != "null" },
          categoryId = txn.optInt("category_id", 0).takeIf { it > 0 },
          merchant = txn.optString("merchant").takeIf { it.isNotBlank() && it != "null" },
          amount = txn.optDouble("amount", 0.0),
          description = txn.optString("description").takeIf { it.isNotBlank() && it != "null" },
          transactionType = txn.optString("transaction_type"),
        )

        Log.i(TAG, "Notified transaction id=$transactionId")
      }

      Result.success()
    } catch (error: Exception) {
      Log.w(TAG, "Sync failed, will retry: ${error.message}")
      Result.retry()
    } finally {
      connection?.disconnect()
    }
  }

  private fun formatDate(millis: Long): String {
    val safeMillis = if (millis > 0) millis else System.currentTimeMillis()
    val formatter = java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss", java.util.Locale.US)
    return formatter.format(java.util.Date(safeMillis))
  }

  companion object {
    private const val TAG = "SmsTxnWorker"
    private const val KEY_SENDER = "sender"
    private const val KEY_BODY = "body"
    private const val KEY_DATE = "date"

    /** Mirrors the sender filter in the server's SMSParserController::parseSMS(). */
    private val BANK_SENDER_KEYWORDS = listOf("hdfc", "sbi", "icici", "idfc", "rbl", "axis", "kotak")

    fun isBankSender(sender: String): Boolean {
      val normalized = sender.lowercase()
      return BANK_SENDER_KEYWORDS.any { normalized.contains(it) }
    }

    fun enqueue(context: Context, sender: String, body: String, date: Long) {
      val request = OneTimeWorkRequestBuilder<SmsTransactionWorker>()
        .setInputData(
          Data.Builder()
            .putString(KEY_SENDER, sender)
            .putString(KEY_BODY, body)
            .putLong(KEY_DATE, date)
            .build(),
        )
        .setConstraints(
          Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build(),
        )
        .setBackoffCriteria(androidx.work.BackoffPolicy.LINEAR, 30, TimeUnit.SECONDS)
        .build()

      // KEEP + a name derived from the message means a duplicated broadcast
      // (or a test re-tap) can't double-post the same SMS.
      WorkManager.getInstance(context).enqueueUniqueWork(
        "sms-txn-${sender.lowercase()}-$date",
        ExistingWorkPolicy.KEEP,
        request,
      )
    }
  }
}
