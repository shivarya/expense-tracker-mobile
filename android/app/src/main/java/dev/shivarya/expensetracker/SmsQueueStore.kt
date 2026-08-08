package dev.shivarya.expensetracker

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

object SmsQueueStore {
  private const val PREFS_NAME = "expense_tracker_sms_bridge"
  private const val KEY_PENDING_SMS = "pending_sms"
  private const val MAX_QUEUE_SIZE = 200

  @Synchronized
  fun enqueue(context: Context, sender: String, body: String, date: Long) {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val queue = parseQueue(prefs.getString(KEY_PENDING_SMS, "[]"))

    val payload = JSONObject()
    payload.put("sender", sender)
    payload.put("body", body)
    payload.put("date", date)

    queue.put(payload)

    val trimmed = trimQueue(queue)
    prefs.edit().putString(KEY_PENDING_SMS, trimmed.toString()).apply()
  }

  @Synchronized
  fun drain(context: Context): JSONArray {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val queue = parseQueue(prefs.getString(KEY_PENDING_SMS, "[]"))
    prefs.edit().putString(KEY_PENDING_SMS, "[]").apply()
    return queue
  }

  private fun trimQueue(queue: JSONArray): JSONArray {
    if (queue.length() <= MAX_QUEUE_SIZE) {
      return queue
    }

    val startIndex = queue.length() - MAX_QUEUE_SIZE
    val trimmed = JSONArray()
    for (index in startIndex until queue.length()) {
      trimmed.put(queue.opt(index))
    }

    return trimmed
  }

  private fun parseQueue(raw: String?): JSONArray {
    if (raw.isNullOrBlank()) {
      return JSONArray()
    }

    return try {
      JSONArray(raw)
    } catch (_: Exception) {
      JSONArray()
    }
  }
}
