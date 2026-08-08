package dev.shivarya.expensetracker

import android.content.Context
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

object WidgetSummarySyncer {
  private val executor = Executors.newSingleThreadExecutor()
  private val refreshInFlight = AtomicBoolean(false)

  fun refreshInBackground(context: Context) {
    val appContext = context.applicationContext
    if (!refreshInFlight.compareAndSet(false, true)) {
      return
    }

    WidgetDataStore.setRefreshing(appContext, true)
    ExpenseSummaryWidgetProvider.refreshAllWidgets(appContext)

    executor.execute {
      var connection: HttpURLConnection? = null

      try {
        val session = WidgetDataStore.getSession(appContext)
        if (!session.isReady) {
          WidgetDataStore.markRefreshFailure(appContext, "Open app to sign in")
          return@execute
        }

        val url = URL("${session.baseUrl}/widget/summary")
        connection = (url.openConnection() as HttpURLConnection).apply {
          requestMethod = "GET"
          connectTimeout = 15000
          readTimeout = 15000
          setRequestProperty("Accept", "application/json")
          setRequestProperty("Authorization", "Bearer ${session.token}")
        }

        val statusCode = connection.responseCode
        val responseBody = when {
          statusCode in 200..299 -> connection.inputStream?.bufferedReader()?.use { it.readText() }.orEmpty()
          else -> connection.errorStream?.bufferedReader()?.use { it.readText() }.orEmpty()
        }

        if (statusCode !in 200..299) {
          val fallbackMessage = if (statusCode == 401) "Open app to sign in" else "Refresh failed"
          val parsedError = try {
            JSONObject(responseBody).optString("error", fallbackMessage)
          } catch (_: Exception) {
            fallbackMessage
          }
          WidgetDataStore.markRefreshFailure(appContext, parsedError)
          return@execute
        }

        val json = JSONObject(responseBody)
        if (!json.optBoolean("success", false)) {
          WidgetDataStore.markRefreshFailure(appContext, json.optString("error", "Refresh failed"))
          return@execute
        }

        val data = json.optJSONObject("data")
        if (data == null) {
          WidgetDataStore.markRefreshFailure(appContext, "Widget data unavailable")
          return@execute
        }

        WidgetDataStore.saveSnapshot(appContext, data.toString())
      } catch (error: Exception) {
        WidgetDataStore.markRefreshFailure(appContext, error.message ?: "Refresh failed")
      } finally {
        connection?.disconnect()
        refreshInFlight.set(false)
        ExpenseSummaryWidgetProvider.refreshAllWidgets(appContext)
      }
    }
  }
}