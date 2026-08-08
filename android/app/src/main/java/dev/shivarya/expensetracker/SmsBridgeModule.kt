package dev.shivarya.expensetracker

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

class SmsBridgeModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

  companion object {
    private var appReactContext: ReactApplicationContext? = null
    private const val EVENT_NAME = "SMSIncoming"

    fun emitIncomingSMS(sender: String, body: String, date: Long) {
      val context = appReactContext ?: return
      if (!context.hasActiveCatalystInstance()) {
        return
      }

      try {
        val payload = Arguments.createMap()
        payload.putString("sender", sender)
        payload.putString("body", body)
        payload.putDouble("date", date.toDouble())

        context
          .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
          .emit(EVENT_NAME, payload)
      } catch (_: Exception) {
        // Ignore event emission failures; queue fallback still handles delivery.
      }
    }
  }

  init {
    appReactContext = reactContext
  }

  override fun getName(): String = "SmsBridge"

  @ReactMethod
  fun drainPendingSMS(promise: Promise) {
    try {
      val queue = SmsQueueStore.drain(reactContext.applicationContext)
      val output = Arguments.createArray()

      for (index in 0 until queue.length()) {
        val item = queue.optJSONObject(index) ?: continue
        val payload = Arguments.createMap()
        payload.putString("sender", item.optString("sender", ""))
        payload.putString("body", item.optString("body", ""))
        payload.putDouble("date", item.optLong("date", 0L).toDouble())
        output.pushMap(payload)
      }

      promise.resolve(output)
    } catch (error: Exception) {
      promise.reject("DRAIN_FAILED", error)
    }
  }

  @ReactMethod
  fun addListener(eventName: String) {
    // Required for NativeEventEmitter compatibility.
  }

  @ReactMethod
  fun removeListeners(count: Int) {
    // Required for NativeEventEmitter compatibility.
  }

  /**
   * Fires the real SmsTransactionWorker against a synthetic bank SMS so the whole
   * native path (session read → POST → notification → tap deep link) can be
   * verified without waiting on an actual bank message.
   */
  @ReactMethod
  fun triggerTestTransactionSync(promise: Promise) {
    try {
      val now = System.currentTimeMillis()
      val stamp = java.text.SimpleDateFormat("dd/MM/yy", java.util.Locale.US).format(java.util.Date(now))
      // Must read as a genuine bank debit alert: the server's AI prompt is
      // deliberately trained to skip anything that looks administrative or
      // non-transactional, so wording like "test"/"not a real transaction" in
      // the body gets correctly dropped and no transaction (or notification)
      // is ever produced. The distinctive merchant name is what makes the
      // resulting row easy to spot and delete afterwards.
      val body = "Sent Rs.11.00 From HDFC Bank A/C x1453 To ZZ NOTIFY CHECK On $stamp " +
        "Ref ${now % 1000000000000L} Not You? Call 18002586161"

      SmsTransactionWorker.enqueue(reactContext.applicationContext, "AD-HDFCBK-S", body, now)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("TEST_SYNC_FAILED", error)
    }
  }

  @ReactMethod
  fun updateWidgetSnapshot(snapshotJson: String, promise: Promise) {
    try {
      WidgetDataStore.saveSnapshot(reactContext.applicationContext, snapshotJson)
      ExpenseSummaryWidgetProvider.refreshAllWidgets(reactContext.applicationContext)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("WIDGET_SNAPSHOT_FAILED", error)
    }
  }

  @ReactMethod
  fun clearWidgetSnapshot(promise: Promise) {
    try {
      WidgetDataStore.clearSnapshot(reactContext.applicationContext)
      ExpenseSummaryWidgetProvider.refreshAllWidgets(reactContext.applicationContext)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("WIDGET_CLEAR_SNAPSHOT_FAILED", error)
    }
  }

  @ReactMethod
  fun updateWidgetSession(baseUrl: String, token: String, promise: Promise) {
    try {
      WidgetDataStore.saveSession(reactContext.applicationContext, baseUrl, token)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("WIDGET_SESSION_FAILED", error)
    }
  }

  @ReactMethod
  fun clearWidgetSession(promise: Promise) {
    try {
      WidgetDataStore.clearSession(reactContext.applicationContext)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("WIDGET_CLEAR_SESSION_FAILED", error)
    }
  }

  @ReactMethod
  fun requestWidgetRefresh(promise: Promise) {
    try {
      ExpenseSummaryWidgetProvider.refreshAllWidgets(reactContext.applicationContext)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("WIDGET_REFRESH_FAILED", error)
    }
  }
}
