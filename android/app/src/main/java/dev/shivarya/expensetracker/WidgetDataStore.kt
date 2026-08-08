package dev.shivarya.expensetracker

import android.content.Context

object WidgetDataStore {
  private const val PREFS_NAME = "expense_tracker_widget"
  private const val KEY_SNAPSHOT_JSON = "snapshot_json"
  private const val KEY_BASE_URL = "base_url"
  private const val KEY_AUTH_TOKEN = "auth_token"
  private const val KEY_LAST_ERROR = "last_error"
  private const val KEY_LAST_SUCCESS_AT = "last_success_at"
  private const val KEY_LAST_ATTEMPT_AT = "last_attempt_at"
  private const val KEY_IS_REFRESHING = "is_refreshing"

  data class WidgetSession(val baseUrl: String?, val token: String?) {
    val isReady: Boolean
      get() = !baseUrl.isNullOrBlank() && !token.isNullOrBlank()
  }

  private fun prefs(context: Context) = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  fun saveSnapshot(context: Context, snapshotJson: String) {
    prefs(context).edit()
      .putString(KEY_SNAPSHOT_JSON, snapshotJson)
      .remove(KEY_LAST_ERROR)
      .putLong(KEY_LAST_SUCCESS_AT, System.currentTimeMillis())
      .putLong(KEY_LAST_ATTEMPT_AT, System.currentTimeMillis())
      .putBoolean(KEY_IS_REFRESHING, false)
      .apply()
  }

  fun getSnapshotJson(context: Context): String? = prefs(context).getString(KEY_SNAPSHOT_JSON, null)

  fun clearSnapshot(context: Context) {
    prefs(context).edit()
      .remove(KEY_SNAPSHOT_JSON)
      .remove(KEY_LAST_ERROR)
      .remove(KEY_LAST_SUCCESS_AT)
      .remove(KEY_LAST_ATTEMPT_AT)
      .putBoolean(KEY_IS_REFRESHING, false)
      .apply()
  }

  fun saveSession(context: Context, baseUrl: String, token: String) {
    prefs(context).edit()
      .putString(KEY_BASE_URL, baseUrl.trimEnd('/'))
      .putString(KEY_AUTH_TOKEN, token)
      .apply()
  }

  fun getSession(context: Context): WidgetSession {
    val store = prefs(context)
    return WidgetSession(
      baseUrl = store.getString(KEY_BASE_URL, null),
      token = store.getString(KEY_AUTH_TOKEN, null),
    )
  }

  fun clearSession(context: Context) {
    prefs(context).edit()
      .remove(KEY_BASE_URL)
      .remove(KEY_AUTH_TOKEN)
      .apply()
  }

  fun setRefreshing(context: Context, refreshing: Boolean) {
    prefs(context).edit()
      .putBoolean(KEY_IS_REFRESHING, refreshing)
      .putLong(KEY_LAST_ATTEMPT_AT, System.currentTimeMillis())
      .apply()
  }

  fun isRefreshing(context: Context): Boolean = prefs(context).getBoolean(KEY_IS_REFRESHING, false)

  fun markRefreshFailure(context: Context, errorMessage: String?) {
    prefs(context).edit()
      .putString(KEY_LAST_ERROR, (errorMessage ?: "Refresh failed").take(120))
      .putLong(KEY_LAST_ATTEMPT_AT, System.currentTimeMillis())
      .putBoolean(KEY_IS_REFRESHING, false)
      .apply()
  }

  fun getLastError(context: Context): String? = prefs(context).getString(KEY_LAST_ERROR, null)

  fun getLastSuccessAt(context: Context): Long = prefs(context).getLong(KEY_LAST_SUCCESS_AT, 0L)
}