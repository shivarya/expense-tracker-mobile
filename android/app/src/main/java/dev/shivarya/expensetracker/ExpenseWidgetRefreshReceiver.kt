package dev.shivarya.expensetracker

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class ExpenseWidgetRefreshReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != ACTION_REFRESH) {
      return
    }

    WidgetSummarySyncer.refreshInBackground(context.applicationContext)
  }

  companion object {
    const val ACTION_REFRESH = "dev.shivarya.expensetracker.widget.ACTION_REFRESH"

    fun createPendingIntent(context: Context): PendingIntent {
      val intent = Intent(context, ExpenseWidgetRefreshReceiver::class.java).apply {
        action = ACTION_REFRESH
      }

      return PendingIntent.getBroadcast(
        context,
        4001,
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    }
  }
}