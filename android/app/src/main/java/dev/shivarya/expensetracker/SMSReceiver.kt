package dev.shivarya.expensetracker

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import android.telephony.SmsMessage
import android.util.Log

class SMSReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) {
      return
    }

    try {
      val messages: Array<SmsMessage> = Telephony.Sms.Intents.getMessagesFromIntent(intent)
      if (messages.isEmpty()) {
        return
      }

      for (message in messages) {
        val sender = message.displayOriginatingAddress ?: message.originatingAddress ?: ""
        val body = message.displayMessageBody ?: message.messageBody ?: ""
        val date = message.timestampMillis

        if (sender.isBlank() && body.isBlank()) {
          continue
        }

        // Durable fallback: drained by JS on next app open.
        SmsQueueStore.enqueue(context, sender, body, date)
        // Fast path, only lands when the app is actually open (no-ops otherwise).
        SmsBridgeModule.emitIncomingSMS(sender, body, date)

        // The path that actually works when Android woke us just for this
        // broadcast and there is no JS engine to receive the event above.
        if (SmsTransactionWorker.isBankSender(sender)) {
          Log.i("SMSReceiver", "Bank SMS from '$sender' — enqueueing native sync")
          SmsTransactionWorker.enqueue(context.applicationContext, sender, body, date)
        }
      }
    } catch (error: Exception) {
      Log.e("SMSReceiver", "Failed to handle incoming SMS", error)
    }
  }
}
