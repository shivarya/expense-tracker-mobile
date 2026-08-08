package dev.shivarya.expensetracker

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.Typeface
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.core.graphics.drawable.IconCompat

/**
 * Posts the "new transaction detected" alert straight from native code.
 *
 * Deliberately does not reuse the JS-side 'sms-sync-auto' channel: that one is
 * created inside useSMSSync's ensureNotificationPermissions(), so it only exists
 * once the JS engine has run. This notifier fires when Android woke the process
 * for a broadcast and there is no JS at all, so it owns its own channel.
 */
object SmsNotifier {
  private const val CHANNEL_ID = "sms-txn-realtime"
  private const val CHANNEL_NAME = "Transaction Alerts"
  private const val ACCENT_COLOR = "#2B7BE5"
  private const val RUPEE_GLYPH = "₹"

  fun notifyTransaction(
    context: Context,
    transactionId: Int,
    categoryName: String?,
    categoryId: Int?,
    merchant: String?,
    amount: Double,
    description: String?,
    transactionType: String?,
  ) {
    ensureChannel(context)

    val isCredit = transactionType?.lowercase() == "credit"
    val label = merchant?.takeIf { it.isNotBlank() }
      ?: description?.takeIf { it.isNotBlank() }
      ?: "transaction"
    val title = categoryName?.takeIf { it.isNotBlank() } ?: "New Transaction"
    val body = buildString {
      append(formatAmount(amount))
      append(if (isCredit) " from " else " to ")
      append(label)
      append(" — tap to fix category if wrong")
    }

    val uri = buildFocusUri(transactionId, categoryId, merchant, amount, description)

    val builder = NotificationCompat.Builder(context, CHANNEL_ID)

    // Prefer the font's own ₹ glyph over hand-drawn vector geometry — an
    // approximated rupee path reads as "not quite a rupee" at status-bar size.
    val rupeeIcon = rupeeSmallIcon()
    if (rupeeIcon != null) {
      builder.setSmallIcon(rupeeIcon)
    } else {
      builder.setSmallIcon(R.drawable.ic_stat_transaction)
    }

    val notification = builder
      .setColor(Color.parseColor(ACCENT_COLOR))
      .setLargeIcon(appIconBitmap(context))
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))
      .setPriority(NotificationCompat.PRIORITY_DEFAULT)
      .setAutoCancel(true)
      .setContentIntent(createDeepLinkPendingIntent(context, uri))
      .build()

    try {
      // Uses the transaction id so a repeat notify for the same row replaces
      // rather than stacks. Throws nothing on missing POST_NOTIFICATIONS —
      // notify() is simply a no-op — so no permission check is needed here.
      NotificationManagerCompat.from(context).notify(transactionId, notification)
    } catch (_: SecurityException) {
      // POST_NOTIFICATIONS revoked between the permission gate and now.
    }
  }

  /**
   * Draws the platform font's rupee glyph, white on transparent, as the status-bar
   * icon. The system reduces a small icon to its alpha channel, so white-on-clear
   * is exactly the required form — and taking the shape from the font avoids
   * approximating the glyph by hand in a vector path.
   *
   * Returns null if the font has no ₹ glyph, in which case the caller falls back
   * to the bundled vector.
   */
  private fun rupeeSmallIcon(): IconCompat? {
    return try {
      val size = 96
      val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        typeface = Typeface.DEFAULT_BOLD
        textAlign = Paint.Align.CENTER
        textSize = size * 0.86f
      }

      val inkBounds = Rect()
      paint.getTextBounds(RUPEE_GLYPH, 0, RUPEE_GLYPH.length, inkBounds)
      if (inkBounds.isEmpty) {
        return null
      }

      val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
      // Centre on the glyph's ink box rather than its baseline, so the symbol sits
      // optically centred instead of riding low.
      Canvas(bitmap).drawText(
        RUPEE_GLYPH,
        size / 2f,
        size / 2f - inkBounds.exactCenterY(),
        paint,
      )

      IconCompat.createWithBitmap(bitmap)
    } catch (_: Exception) {
      null
    }
  }

  /**
   * Renders the launcher icon into a bitmap for setLargeIcon, so the alert reads
   * as coming from this app rather than as a bare system notification.
   *
   * Goes through the drawable rather than BitmapFactory.decodeResource: on API 26+
   * R.mipmap.ic_launcher resolves to the adaptive-icon XML, which decodeResource
   * cannot decode and would return null for.
   */
  private fun appIconBitmap(context: Context): Bitmap? = try {
    val drawable = ContextCompat.getDrawable(context, R.mipmap.ic_launcher)
    if (drawable == null) {
      null
    } else {
      val size = 192
      val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
      val canvas = Canvas(bitmap)
      drawable.setBounds(0, 0, size, size)
      drawable.draw(canvas)
      bitmap
    }
  } catch (_: Exception) {
    // Cosmetic only — never let this stop the notification going out.
    null
  }

  private fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }

    val manager = context.getSystemService(NotificationManager::class.java) ?: return
    val channel = NotificationChannel(
      CHANNEL_ID,
      CHANNEL_NAME,
      NotificationManager.IMPORTANCE_DEFAULT,
    ).apply {
      description = "Alerts the moment a bank SMS is turned into a transaction"
      enableLights(true)
      lightColor = Color.parseColor(ACCENT_COLOR)
      enableVibration(true)
      vibrationPattern = longArrayOf(0, 120)
    }

    manager.createNotificationChannel(channel)
  }

  /**
   * Routes through the existing expensetracker:// deep link rather than
   * expo-notifications' response listener — a raw NotificationManagerCompat
   * notify never reaches that listener. App.tsx parses these focus* params and
   * TransactionsScreen opens its category picker on arrival.
   */
  private fun buildFocusUri(
    transactionId: Int,
    categoryId: Int?,
    merchant: String?,
    amount: Double,
    description: String?,
  ): Uri {
    val builder = Uri.parse("expensetracker://expenses/current").buildUpon()
      .appendQueryParameter("initialMonthKey", "current")
      .appendQueryParameter("focusTransactionId", transactionId.toString())

    if (categoryId != null && categoryId > 0) {
      builder.appendQueryParameter("focusCategoryId", categoryId.toString())
    }
    if (!merchant.isNullOrBlank()) {
      builder.appendQueryParameter("focusMerchant", merchant)
    }
    if (amount > 0) {
      builder.appendQueryParameter("focusAmount", trimAmount(amount))
    }
    if (!description.isNullOrBlank()) {
      builder.appendQueryParameter("focusDescription", description)
    }

    return builder.build()
  }

  private fun createDeepLinkPendingIntent(context: Context, uri: Uri): PendingIntent {
    val intent = Intent(Intent.ACTION_VIEW, uri).apply {
      setClassName(context, "dev.shivarya.expensetracker.MainActivity")
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    }

    return PendingIntent.getActivity(
      context,
      uri.toString().hashCode(),
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  private fun formatAmount(amount: Double): String = "₹" + trimAmount(amount)

  private fun trimAmount(amount: Double): String =
    if (amount == Math.floor(amount) && !amount.isInfinite()) {
      amount.toLong().toString()
    } else {
      String.format("%.2f", amount)
    }
}
