package dev.shivarya.expensetracker

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import androidx.core.content.ContextCompat
import kotlin.math.max
import java.util.Locale

object WidgetGraphRenderer {
  data class GraphPoint(val label: String, val amount: Double)

  private const val DEFAULT_POINT_COUNT = 6

  fun renderCompact(
    context: Context,
    points: List<GraphPoint>,
    widthDp: Int,
    heightDp: Int,
  ): Bitmap {
    return renderBars(
      context = context,
      points = points,
      widthDp = widthDp,
      heightDp = heightDp,
      showLabels = false,
      compact = true,
    )
  }

  fun render(
    context: Context,
    points: List<GraphPoint>,
    widthDp: Int,
    heightDp: Int,
    showLabels: Boolean = true,
  ): Bitmap {
    return renderBars(
      context = context,
      points = points,
      widthDp = widthDp,
      heightDp = heightDp,
      showLabels = showLabels,
      compact = false,
    )
  }

  private fun renderBars(
    context: Context,
    points: List<GraphPoint>,
    widthDp: Int,
    heightDp: Int,
    showLabels: Boolean,
    compact: Boolean,
  ): Bitmap {
    val density = context.resources.displayMetrics.density
    val widthPx = (widthDp * density).toInt().coerceAtLeast(1)
    val heightPx = (heightDp * density).toInt().coerceAtLeast(1)
    val bitmap = Bitmap.createBitmap(widthPx, heightPx, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    val safePoints = points.takeLast(DEFAULT_POINT_COUNT).ifEmpty {
      List(DEFAULT_POINT_COUNT) { GraphPoint("", 0.0) }
    }

    val labelArea = if (showLabels) 20f * density else 2f * density
    val topPadding = when {
      compact -> 2f * density
      showLabels -> 17f * density
      else -> 8f * density
    }
    val leftPadding = if (compact) 2f * density else 7f * density
    val rightPadding = if (compact) 2f * density else 7f * density
    val chartBottom = (heightPx - labelArea).coerceAtLeast(1f)
    val chartHeight = (chartBottom - topPadding).coerceAtLeast(1f)
    val chartWidth = (widthPx - leftPadding - rightPadding).coerceAtLeast(1f)

    val spacing = (if (compact) 1.5f else 2.5f) * density
    val barCount = safePoints.size.coerceAtLeast(1)
    val maxSpacing = ((chartWidth / barCount) * 0.45f).coerceAtLeast(1f)
    val barSpacing = spacing.coerceAtMost(maxSpacing)
    val rawBarWidth = (chartWidth - barSpacing * (barCount - 1)) / barCount
    val barWidth = rawBarWidth.coerceAtLeast(1f)
    val totalBarsWidth = barWidth * barCount + barSpacing * (barCount - 1)
    val startX = leftPadding + ((chartWidth - totalBarsWidth) / 2f).coerceAtLeast(0f)

    val maxAmount = max(safePoints.maxOfOrNull { it.amount } ?: 0.0, 1.0)
    val baselinePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = ContextCompat.getColor(context, R.color.widget_graph_bar)
      alpha = if (compact) 88 else 110
      style = Paint.Style.STROKE
      strokeWidth = 1f * density
    }
    val baseBarColor = ContextCompat.getColor(context, R.color.widget_graph_bar)
    val activeBarColor = ContextCompat.getColor(context, R.color.widget_graph_bar_active)
    val barPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      style = Paint.Style.FILL
    }
    val labelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = ContextCompat.getColor(context, R.color.widget_graph_label)
      textAlign = Paint.Align.CENTER
      textSize = 10f * density
    }
    val valuePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = ContextCompat.getColor(context, R.color.widget_text_secondary)
      textAlign = Paint.Align.CENTER
      textSize = 8f * density
    }

    canvas.drawLine(startX, chartBottom, startX + totalBarsWidth, chartBottom, baselinePaint)

    val minHeightFactor = if (compact) 0.14f else 0.1f
    val minHeight = (chartHeight * minHeightFactor).coerceAtLeast(1f)
    val radius = minOf(barWidth / 2f, (if (compact) 2.8f else 4.5f) * density)
    val previousIndex = (safePoints.lastIndex - 1).coerceAtLeast(0)

    safePoints.forEachIndexed { index, point ->
      val hasAmount = point.amount > 0.009
      val normalized = (point.amount / maxAmount).toFloat().coerceIn(0f, 1f)
      val barHeight = if (hasAmount) {
        (normalized * chartHeight).coerceAtLeast(minHeight)
      } else {
        0f
      }
      val left = startX + index * (barWidth + barSpacing)
      val top = chartBottom - barHeight
      val right = left + barWidth
      val isCurrent = index == safePoints.lastIndex
      val isPrevious = index == previousIndex

      barPaint.color = when {
        isCurrent -> activeBarColor
        isPrevious -> activeBarColor
        compact -> activeBarColor
        else -> baseBarColor
      }
      barPaint.alpha = when {
        isCurrent -> 255
        isPrevious -> if (compact) 212 else 205
        compact -> 156
        else -> 138
      }

      if (barHeight > 0f) {
        canvas.drawRoundRect(RectF(left, top, right, chartBottom), radius, radius, barPaint)
      }

      if (!compact && showLabels && hasAmount && (isCurrent || isPrevious)) {
        val amountText = formatCompactAmount(point.amount)
        val valueY = (top - (3f * density)).coerceAtLeast(9f * density)
        canvas.drawText(amountText, left + (barWidth / 2f), valueY, valuePaint)
      }

      if (showLabels) {
        canvas.drawText(safePoints[index].label, left + (barWidth / 2f), heightPx - 6f * density, labelPaint)
      }
    }

    return bitmap
  }

  private fun formatCompactAmount(value: Double): String {
    val absolute = kotlin.math.abs(value)
    val formatted = when {
      absolute >= 10000000 -> compactNumber(absolute / 10000000, "Cr")
      absolute >= 100000 -> compactNumber(absolute / 100000, "L")
      absolute >= 1000 -> compactNumber(absolute / 1000, "K")
      else -> String.format(Locale.ENGLISH, "%.0f", absolute)
    }

    return "₹$formatted"
  }

  private fun compactNumber(value: Double, suffix: String): String {
    val raw = String.format(Locale.ENGLISH, "%.1f", value)
    return raw.removeSuffix(".0") + suffix
  }
}