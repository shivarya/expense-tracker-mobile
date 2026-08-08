package dev.shivarya.expensetracker

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.view.View
import android.widget.RemoteViews
import androidx.core.content.ContextCompat
import org.json.JSONObject
import java.util.Locale

class ExpenseSummaryWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    refreshWidgets(context, appWidgetManager, appWidgetIds)
    WidgetSummarySyncer.refreshInBackground(context.applicationContext)
  }

  override fun onAppWidgetOptionsChanged(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetId: Int,
    newOptions: android.os.Bundle,
  ) {
    updateWidget(context, appWidgetManager, appWidgetId)
  }

  companion object {
    fun refreshAllWidgets(context: Context) {
      val appWidgetManager = AppWidgetManager.getInstance(context)
      val componentName = ComponentName(context, ExpenseSummaryWidgetProvider::class.java)
      val appWidgetIds = appWidgetManager.getAppWidgetIds(componentName)
      if (appWidgetIds.isEmpty()) {
        return
      }

      refreshWidgets(context, appWidgetManager, appWidgetIds)
    }

    private fun refreshWidgets(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
      appWidgetIds.forEach { appWidgetId ->
        updateWidget(context, appWidgetManager, appWidgetId)
      }
    }

    private fun updateWidget(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int) {
      val options = appWidgetManager.getAppWidgetOptions(appWidgetId)
      val minWidth = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH)
      val minHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT)
      val maxWidth = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH)
      val maxHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT)
      val size = resolveWidgetSize(options)
      val views = RemoteViews(context.packageName, size.layoutRes)
      val snapshot = parseSnapshot(WidgetDataStore.getSnapshotJson(context))
      val hasSession = WidgetDataStore.getSession(context).isReady
      val refreshing = WidgetDataStore.isRefreshing(context)
      val lastError = WidgetDataStore.getLastError(context)
      val lastSuccessAt = WidgetDataStore.getLastSuccessAt(context)

      when (size) {
        WidgetLayout.SMALL -> bindSmall(context, views, snapshot, hasSession, refreshing, lastError, lastSuccessAt)
        WidgetLayout.MEDIUM_COMPACT -> bindMediumCompact(context, views, snapshot, hasSession, refreshing, lastError, lastSuccessAt, minWidth, minHeight, maxWidth, maxHeight)
        WidgetLayout.MEDIUM -> bindMedium(context, views, snapshot, hasSession, refreshing, lastError, lastSuccessAt)
        WidgetLayout.LARGE -> bindLarge(context, views, snapshot, hasSession, refreshing, lastError, lastSuccessAt)
      }

      appWidgetManager.updateAppWidget(appWidgetId, views)
    }

    private fun bindSmall(
      context: Context,
      views: RemoteViews,
      snapshot: WidgetSnapshot?,
      hasSession: Boolean,
      refreshing: Boolean,
      lastError: String?,
      lastSuccessAt: Long,
    ) {
      if (snapshot == null) {
        views.setTextViewText(R.id.widget_month_label, context.getString(R.string.expense_widget_name))
        views.setTextViewText(R.id.widget_month_spent_value, if (hasSession) context.getString(R.string.widget_empty_value) else context.getString(R.string.widget_sign_in_value))
        views.setTextViewText(R.id.widget_income_inline, if (hasSession) context.getString(R.string.widget_placeholder_value) else "")
        views.setViewVisibility(R.id.widget_trend_chip, View.GONE)
        views.setViewVisibility(R.id.widget_status_text, View.VISIBLE)
      } else {
        views.setTextViewText(R.id.widget_month_label, "${snapshot.monthLabel.uppercase(Locale.ENGLISH)} SPENT")
        views.setTextViewText(R.id.widget_month_spent_value, formatCompactCurrency(snapshot.monthSpent))
        views.setTextViewText(R.id.widget_income_inline, "Income ${formatCompactCurrency(snapshot.monthIncome)}")
        views.setViewVisibility(R.id.widget_trend_chip, View.VISIBLE)
        applyTrendChip(context, views, R.id.widget_trend_chip, snapshot.trend)
        views.setViewVisibility(
          R.id.widget_status_text,
          if (refreshing || lastError != null) View.VISIBLE else View.GONE,
        )
      }

      views.setImageViewBitmap(R.id.widget_graph_image, WidgetGraphRenderer.renderCompact(context, snapshot?.monthlySpendSeries ?: emptyList(), 148, 34))
      views.setTextViewText(R.id.widget_status_text, buildStatusText(context, hasSession, refreshing, lastError, lastSuccessAt))
      views.setOnClickPendingIntent(R.id.widget_root, createDeepLinkPendingIntent(context, buildExpensesUri(headerTitle = "This Month Cashflow")))
    }

    private fun bindMedium(
      context: Context,
      views: RemoteViews,
      snapshot: WidgetSnapshot?,
      hasSession: Boolean,
      refreshing: Boolean,
      lastError: String?,
      lastSuccessAt: Long,
    ) {
      views.setTextViewText(R.id.widget_header_title, if (snapshot == null) context.getString(R.string.expense_widget_name) else "${snapshot.monthLabel.uppercase(Locale.ENGLISH)} CASHFLOW")
      views.setTextViewText(R.id.widget_refresh_button, context.getString(R.string.widget_action_refresh))

      if (snapshot == null) {
        views.setTextViewText(R.id.widget_spent_value, if (hasSession) context.getString(R.string.widget_empty_value) else context.getString(R.string.widget_sign_in_value))
        views.setTextViewText(R.id.widget_income_value, context.getString(R.string.widget_placeholder_value))
        views.setTextViewText(R.id.widget_top_category_value, buildEmptyStateMessage(context, hasSession))
        views.setTextViewText(R.id.widget_top_category_meta, if (hasSession) "Add categories to surface spend drivers" else "Sign in to load insights")
        views.setTextViewText(R.id.widget_balance_value, context.getString(R.string.widget_placeholder_value))
        views.setTextViewText(R.id.widget_balance_meta, "")
        views.setTextColor(R.id.widget_balance_value, ContextCompat.getColor(context, R.color.widget_text_primary))
        views.setTextViewText(R.id.widget_graph_subtitle, buildStatusText(context, hasSession, refreshing, lastError, lastSuccessAt))
        views.setTextViewText(R.id.widget_graph_detail, "")
        views.setViewVisibility(R.id.widget_graph_detail, View.GONE)
        views.setTextColor(R.id.widget_graph_subtitle, ContextCompat.getColor(context, R.color.widget_text_primary))
      } else {
        views.setTextViewText(R.id.widget_spent_value, formatCompactCurrency(snapshot.monthSpent))
        views.setTextViewText(R.id.widget_income_value, formatCompactCurrency(snapshot.monthIncome))
        views.setTextViewText(R.id.widget_top_category_value, buildTopCategoryValue(snapshot.topCategories.firstOrNull()))
        views.setTextViewText(R.id.widget_top_category_meta, buildTopCategoryMeta(snapshot.topCategories.firstOrNull()))
        views.setTextViewText(R.id.widget_balance_value, formatSignedCompactCurrency(snapshot.monthSavings))
        views.setTextViewText(R.id.widget_balance_meta, buildBalanceMeta(snapshot))
        applyBalanceTextColor(context, views, R.id.widget_balance_value, snapshot.monthSavings)
        views.setTextViewText(R.id.widget_graph_subtitle, buildTrendHeadline(snapshot.trend))
        views.setTextViewText(R.id.widget_graph_detail, buildGraphDetail(snapshot, includeAverage = true))
        views.setViewVisibility(R.id.widget_graph_detail, View.VISIBLE)
        views.setTextColor(R.id.widget_graph_detail, ContextCompat.getColor(context, R.color.widget_text_secondary))
        applyTrendTextColor(context, views, R.id.widget_graph_subtitle, snapshot.trend)
      }

      views.setImageViewBitmap(R.id.widget_graph_image, WidgetGraphRenderer.render(context, snapshot?.monthlySpendSeries ?: emptyList(), 300, 72, false))
      views.setViewVisibility(R.id.widget_status_text, if (snapshot != null && !refreshing && lastError == null) View.GONE else View.VISIBLE)
      views.setTextViewText(R.id.widget_status_text, buildStatusText(context, hasSession, refreshing, lastError, lastSuccessAt))
      views.setOnClickPendingIntent(R.id.widget_root, createDeepLinkPendingIntent(context, buildExpensesUri(headerTitle = "This Month Cashflow")))
      views.setOnClickPendingIntent(R.id.widget_spent_block, createDeepLinkPendingIntent(context, buildExpensesUri(headerTitle = "Spent This Month", txnType = "debit")))
      views.setOnClickPendingIntent(R.id.widget_income_block, createDeepLinkPendingIntent(context, buildExpensesUri(headerTitle = "Income This Month", txnType = "credit")))
      views.setOnClickPendingIntent(R.id.widget_top_category_block, createDeepLinkPendingIntent(context, buildExpensesUri(headerTitle = "Top Category This Month", txnType = "debit", categoryId = snapshot?.topCategories?.firstOrNull()?.categoryId)))
      views.setOnClickPendingIntent(R.id.widget_balance_block, createDeepLinkPendingIntent(context, buildExpensesUri(headerTitle = "This Month Cashflow")))
      views.setOnClickPendingIntent(R.id.widget_graph_block, createDeepLinkPendingIntent(context, buildExpensesUri(headerTitle = "Spend Trend", txnType = "debit")))
      views.setOnClickPendingIntent(R.id.widget_refresh_button, ExpenseWidgetRefreshReceiver.createPendingIntent(context))
    }

    private fun bindMediumCompact(
      context: Context,
      views: RemoteViews,
      snapshot: WidgetSnapshot?,
      hasSession: Boolean,
      refreshing: Boolean,
      lastError: String?,
      lastSuccessAt: Long,
      minWidth: Int,
      minHeight: Int,
      maxWidth: Int,
      maxHeight: Int,
    ) {
      val effectiveWidth = maxOf(minWidth, maxWidth)
      val effectiveHeight = maxOf(minHeight, maxHeight)
      val hideInsightsRow = effectiveHeight <= 172 || effectiveWidth <= 192
      val hideIncomeTile = effectiveHeight <= 146 || effectiveWidth <= 170
      val hideGraphSubtitle = effectiveHeight <= 140
      val hideGraphDetail = effectiveHeight <= 156 || effectiveWidth <= 188

      views.setViewVisibility(R.id.widget_insights_row, if (hideInsightsRow) View.GONE else View.VISIBLE)
      views.setViewVisibility(R.id.widget_income_block, if (hideIncomeTile) View.GONE else View.VISIBLE)
      views.setViewVisibility(R.id.widget_graph_subtitle, if (hideGraphSubtitle) View.GONE else View.VISIBLE)
      views.setViewVisibility(R.id.widget_graph_detail, if (hideGraphDetail) View.GONE else View.VISIBLE)

      views.setTextViewText(R.id.widget_header_title, if (snapshot == null) context.getString(R.string.expense_widget_name) else "${snapshot.monthLabel.uppercase(Locale.ENGLISH)} CASHFLOW")
      views.setTextViewText(R.id.widget_refresh_button, context.getString(R.string.widget_action_refresh))

      if (snapshot == null) {
        views.setTextViewText(R.id.widget_spent_value, if (hasSession) context.getString(R.string.widget_empty_value) else context.getString(R.string.widget_sign_in_value))
        views.setTextViewText(R.id.widget_income_value, context.getString(R.string.widget_placeholder_value))
        views.setTextViewText(R.id.widget_top_category_value, buildEmptyStateMessage(context, hasSession))
        views.setTextViewText(R.id.widget_top_category_meta, if (hasSession) "Add categories to surface spend drivers" else "Sign in to load insights")
        views.setTextViewText(R.id.widget_balance_value, context.getString(R.string.widget_placeholder_value))
        views.setTextViewText(R.id.widget_balance_meta, "")
        views.setTextColor(R.id.widget_balance_value, ContextCompat.getColor(context, R.color.widget_text_primary))
        views.setTextViewText(R.id.widget_graph_subtitle, buildStatusText(context, hasSession, refreshing, lastError, lastSuccessAt))
        views.setTextViewText(R.id.widget_graph_detail, "")
        views.setViewVisibility(R.id.widget_graph_detail, View.GONE)
        views.setTextColor(R.id.widget_graph_subtitle, ContextCompat.getColor(context, R.color.widget_text_primary))
      } else {
        views.setTextViewText(R.id.widget_spent_value, formatCompactCurrency(snapshot.monthSpent))
        views.setTextViewText(R.id.widget_income_value, formatCompactCurrency(snapshot.monthIncome))
        views.setTextViewText(R.id.widget_top_category_value, buildTopCategoryValue(snapshot.topCategories.firstOrNull()))
        views.setTextViewText(R.id.widget_top_category_meta, buildTopCategoryMeta(snapshot.topCategories.firstOrNull()))
        views.setTextViewText(R.id.widget_balance_value, formatSignedCompactCurrency(snapshot.monthSavings))
        views.setTextViewText(R.id.widget_balance_meta, buildBalanceMeta(snapshot))
        applyBalanceTextColor(context, views, R.id.widget_balance_value, snapshot.monthSavings)
        views.setTextViewText(R.id.widget_graph_subtitle, buildTrendHeadline(snapshot.trend))
        views.setTextViewText(R.id.widget_graph_detail, buildGraphDetail(snapshot, includeAverage = false))
        views.setTextColor(R.id.widget_graph_detail, ContextCompat.getColor(context, R.color.widget_text_secondary))
        applyTrendTextColor(context, views, R.id.widget_graph_subtitle, snapshot.trend)
      }

      views.setViewVisibility(R.id.widget_status_text, if (snapshot != null && !refreshing && lastError == null) View.GONE else View.VISIBLE)
      views.setTextViewText(R.id.widget_status_text, buildStatusText(context, hasSession, refreshing, lastError, lastSuccessAt))
      val graphWidth = (effectiveWidth - 24).coerceIn(170, 360)
      val graphHeight = when {
        effectiveHeight >= 230 -> 58
        !hideInsightsRow -> 46
        effectiveHeight >= 172 -> 34
        else -> 24
      }
      views.setImageViewBitmap(R.id.widget_graph_image, WidgetGraphRenderer.renderCompact(context, snapshot?.monthlySpendSeries ?: emptyList(), graphWidth, graphHeight))
      views.setOnClickPendingIntent(R.id.widget_root, createDeepLinkPendingIntent(context, buildExpensesUri(headerTitle = "This Month Cashflow")))
      views.setOnClickPendingIntent(R.id.widget_spent_block, createDeepLinkPendingIntent(context, buildExpensesUri(headerTitle = "Spent This Month", txnType = "debit")))
      views.setOnClickPendingIntent(R.id.widget_income_block, createDeepLinkPendingIntent(context, buildExpensesUri(headerTitle = "Income This Month", txnType = "credit")))
      views.setOnClickPendingIntent(R.id.widget_top_category_block, createDeepLinkPendingIntent(context, buildExpensesUri(headerTitle = "Top Category This Month", txnType = "debit", categoryId = snapshot?.topCategories?.firstOrNull()?.categoryId)))
      views.setOnClickPendingIntent(R.id.widget_balance_block, createDeepLinkPendingIntent(context, buildExpensesUri(headerTitle = "This Month Cashflow")))
      views.setOnClickPendingIntent(R.id.widget_graph_block, createDeepLinkPendingIntent(context, buildExpensesUri(headerTitle = "Spend Trend", txnType = "debit")))
      views.setOnClickPendingIntent(R.id.widget_refresh_button, ExpenseWidgetRefreshReceiver.createPendingIntent(context))
    }

    private fun bindLarge(
      context: Context,
      views: RemoteViews,
      snapshot: WidgetSnapshot?,
      hasSession: Boolean,
      refreshing: Boolean,
      lastError: String?,
      lastSuccessAt: Long,
    ) {
      views.setTextViewText(R.id.widget_header_title, if (snapshot == null) context.getString(R.string.expense_widget_name) else "${snapshot.monthLabel.uppercase(Locale.ENGLISH)} CASHFLOW")
      views.setTextViewText(R.id.widget_refresh_button, context.getString(R.string.widget_action_refresh))

      if (snapshot == null) {
        views.setTextViewText(R.id.widget_spent_value, if (hasSession) context.getString(R.string.widget_empty_value) else context.getString(R.string.widget_sign_in_value))
        views.setTextViewText(R.id.widget_income_value, context.getString(R.string.widget_placeholder_value))
        views.setTextViewText(R.id.widget_top_category_value, buildEmptyStateMessage(context, hasSession))
        views.setTextViewText(R.id.widget_top_category_meta, if (hasSession) "Add categories to surface spend drivers" else "Sign in to load insights")
        views.setTextViewText(R.id.widget_balance_value, context.getString(R.string.widget_placeholder_value))
        views.setTextViewText(R.id.widget_balance_meta, "")
        views.setTextColor(R.id.widget_balance_value, ContextCompat.getColor(context, R.color.widget_text_primary))
        views.setTextViewText(R.id.widget_graph_subtitle, buildStatusText(context, hasSession, refreshing, lastError, lastSuccessAt))
        views.setTextViewText(R.id.widget_graph_detail, "")
        views.setViewVisibility(R.id.widget_graph_detail, View.GONE)
        views.setTextColor(R.id.widget_graph_subtitle, ContextCompat.getColor(context, R.color.widget_text_primary))
        views.setTextViewText(R.id.widget_category_line_1, buildEmptyStateMessage(context, hasSession))
        views.setTextViewText(R.id.widget_category_line_2, "")
      } else {
        views.setTextViewText(R.id.widget_spent_value, formatCompactCurrency(snapshot.monthSpent))
        views.setTextViewText(R.id.widget_income_value, formatCompactCurrency(snapshot.monthIncome))
        views.setTextViewText(R.id.widget_top_category_value, buildTopCategoryValue(snapshot.topCategories.firstOrNull()))
        views.setTextViewText(R.id.widget_top_category_meta, buildTopCategoryMeta(snapshot.topCategories.firstOrNull()))
        views.setTextViewText(R.id.widget_balance_value, formatSignedCompactCurrency(snapshot.monthSavings))
        views.setTextViewText(R.id.widget_balance_meta, buildBalanceMeta(snapshot))
        applyBalanceTextColor(context, views, R.id.widget_balance_value, snapshot.monthSavings)
        views.setTextViewText(R.id.widget_graph_subtitle, buildTrendHeadline(snapshot.trend))
        views.setTextViewText(R.id.widget_graph_detail, buildGraphDetail(snapshot, includeAverage = true))
        views.setViewVisibility(R.id.widget_graph_detail, View.VISIBLE)
        views.setTextColor(R.id.widget_graph_detail, ContextCompat.getColor(context, R.color.widget_text_secondary))
        applyTrendTextColor(context, views, R.id.widget_graph_subtitle, snapshot.trend)
        views.setTextViewText(R.id.widget_category_line_1, buildCategoryLine(snapshot.topCategories.getOrNull(0), 1))
        views.setTextViewText(R.id.widget_category_line_2, buildCategoryLine(snapshot.topCategories.getOrNull(1), 2))
      }

      views.setImageViewBitmap(R.id.widget_graph_image, WidgetGraphRenderer.render(context, snapshot?.monthlySpendSeries ?: emptyList(), 420, 96, true))
      views.setViewVisibility(R.id.widget_status_text, if (snapshot != null && !refreshing && lastError == null) View.GONE else View.VISIBLE)
      views.setTextViewText(R.id.widget_status_text, buildStatusText(context, hasSession, refreshing, lastError, lastSuccessAt))
      views.setOnClickPendingIntent(R.id.widget_root, createDeepLinkPendingIntent(context, buildExpensesUri(headerTitle = "This Month Cashflow")))
      views.setOnClickPendingIntent(R.id.widget_spent_block, createDeepLinkPendingIntent(context, buildExpensesUri(headerTitle = "Spent This Month", txnType = "debit")))
      views.setOnClickPendingIntent(R.id.widget_income_block, createDeepLinkPendingIntent(context, buildExpensesUri(headerTitle = "Income This Month", txnType = "credit")))
      views.setOnClickPendingIntent(R.id.widget_top_category_block, createDeepLinkPendingIntent(context, buildExpensesUri(headerTitle = "Top Category This Month", txnType = "debit", categoryId = snapshot?.topCategories?.firstOrNull()?.categoryId)))
      views.setOnClickPendingIntent(R.id.widget_balance_block, createDeepLinkPendingIntent(context, buildExpensesUri(headerTitle = "This Month Cashflow")))
      views.setOnClickPendingIntent(R.id.widget_graph_block, createDeepLinkPendingIntent(context, buildExpensesUri(headerTitle = "Spend Trend", txnType = "debit")))
      views.setOnClickPendingIntent(R.id.widget_categories_block, createDeepLinkPendingIntent(context, buildExpensesUri(headerTitle = "Top Categories", txnType = "debit")))
      views.setOnClickPendingIntent(R.id.widget_refresh_button, ExpenseWidgetRefreshReceiver.createPendingIntent(context))
    }

    private fun resolveWidgetSize(options: android.os.Bundle): WidgetLayout {
      val minWidth = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH)
      val minHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT)
      val maxWidth = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH)
      val maxHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT)
      val effectiveWidth = maxOf(minWidth, maxWidth)
      val effectiveHeight = maxOf(minHeight, maxHeight)
      val isShortWidget = effectiveHeight <= 172 && effectiveWidth >= 160

      return when {
        isShortWidget -> WidgetLayout.MEDIUM_COMPACT
        effectiveWidth >= 250 || effectiveHeight >= 220 -> WidgetLayout.LARGE
        effectiveWidth >= 180 || effectiveHeight >= 140 -> WidgetLayout.MEDIUM
        else -> WidgetLayout.SMALL
      }
    }

    private fun buildStatusText(
      context: Context,
      hasSession: Boolean,
      refreshing: Boolean,
      lastError: String?,
      lastSuccessAt: Long,
    ): String {
      return when {
        refreshing -> context.getString(R.string.widget_refreshing)
        lastError != null && lastSuccessAt == 0L -> lastError
        lastSuccessAt > 0L -> context.getString(R.string.widget_updated_prefix, formatRelativeTime(lastSuccessAt))
        hasSession -> context.getString(R.string.widget_open_app_sync)
        else -> context.getString(R.string.widget_open_app_sign_in)
      }
    }

    private fun buildEmptyStateMessage(context: Context, hasSession: Boolean): String {
      return if (hasSession) {
        context.getString(R.string.widget_open_app_sync)
      } else {
        context.getString(R.string.widget_open_app_sign_in)
      }
    }

    private fun buildCategoryLine(category: WidgetCategory?, index: Int): String {
      if (category == null) {
        return if (index == 1) "No categories yet" else ""
      }

      return "$index. ${category.name} • ${formatCompactCurrency(category.amount)}"
    }

    private fun buildTopCategoryValue(category: WidgetCategory?): String {
      return category?.name ?: "No top spend yet"
    }

    private fun buildTopCategoryMeta(category: WidgetCategory?): String {
      if (category == null) {
        return "Tag expenses in app to unlock"
      }

      return "${formatCompactCurrency(category.amount)} • ${category.count} txns"
    }

    private fun buildBalanceMeta(snapshot: WidgetSnapshot): String {
      if (snapshot.transactionCount <= 0) {
        return "No transactions yet"
      }

      val averageTicket = snapshot.monthSpent / snapshot.transactionCount.toDouble()
      return "${snapshot.transactionCount} txns • avg ${formatCompactCurrency(averageTicket)}"
    }

    private fun buildTrendLabel(trend: WidgetTrend): String {
      return when {
        trend.percentage == null && trend.amountChange > 0 -> "New spend this month"
        trend.percentage == null -> "No month-on-month comparison yet"
        trend.direction == "up" -> "+${formatPercent(trend.percentage)} vs last month"
        trend.direction == "down" -> "-${formatPercent(trend.percentage)} vs last month"
        else -> "Flat vs last month"
      }
    }

    private fun buildTrendHeadline(trend: WidgetTrend): String {
      return when {
        trend.percentage == null && trend.amountChange > 0 -> "New spend"
        trend.percentage == null -> "No comparison"
        trend.direction == "up" -> "Up ${formatPercent(trend.percentage)}"
        trend.direction == "down" -> "Down ${formatPercent(trend.percentage)}"
        else -> "Flat"
      }
    }

    private fun buildGraphDetail(snapshot: WidgetSnapshot, includeAverage: Boolean): String {
      val currentAmount = snapshot.monthSpent
      val fallbackPrevious = snapshot.monthlySpendSeries.dropLast(1).lastOrNull()?.amount?.takeIf { it > 0.009 }
      val previousAmount = snapshot.trend.previousAmount?.takeIf { it > 0.009 } ?: fallbackPrevious
      val segments = mutableListOf("This ${formatCompactCurrency(currentAmount)}")

      segments.add(if (previousAmount != null) "Last ${formatCompactCurrency(previousAmount)}" else "Last n/a")

      if (includeAverage) {
        val nonZeroSeries = snapshot.monthlySpendSeries.map { it.amount }.filter { it > 0.009 }
        if (nonZeroSeries.isNotEmpty()) {
          segments.add("Avg ${formatCompactCurrency(nonZeroSeries.average())}")
        }
      }

      return segments.joinToString(" • ")
    }

    private fun applyTrendChip(context: Context, views: RemoteViews, viewId: Int, trend: WidgetTrend) {
      val background = when (trend.direction) {
        "down" -> R.drawable.widget_chip_positive
        "up" -> R.drawable.widget_chip_negative
        else -> R.drawable.widget_chip_neutral
      }
      val textColor = when (trend.direction) {
        "down" -> R.color.widget_positive_text
        "up" -> R.color.widget_negative_text
        else -> R.color.widget_neutral_text
      }

      views.setTextViewText(viewId, buildTrendLabel(trend))
      views.setInt(viewId, "setBackgroundResource", background)
      views.setTextColor(viewId, ContextCompat.getColor(context, textColor))
    }

    private fun applyTrendTextColor(context: Context, views: RemoteViews, viewId: Int, trend: WidgetTrend) {
      val colorRes = when (trend.direction) {
        "down" -> R.color.widget_positive_text
        "up" -> R.color.widget_negative_text
        else -> R.color.widget_text_primary
      }
      views.setTextColor(viewId, ContextCompat.getColor(context, colorRes))
    }

    private fun applyBalanceTextColor(context: Context, views: RemoteViews, viewId: Int, balance: Double) {
      val colorRes = when {
        balance > 0.009 -> R.color.widget_income_text
        balance < -0.009 -> R.color.widget_negative_text
        else -> R.color.widget_text_primary
      }
      views.setTextColor(viewId, ContextCompat.getColor(context, colorRes))
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

    private fun buildExpensesUri(
      headerTitle: String,
      txnType: String? = null,
      categoryId: Int? = null,
    ): Uri {
      val builder = Uri.parse("expensetracker://expenses/current").buildUpon()
        .appendQueryParameter("initialMonthKey", "current")
        .appendQueryParameter("headerTitle", headerTitle)

      if (!txnType.isNullOrBlank()) {
        builder.appendQueryParameter("type", txnType)
      }

      if (categoryId != null && categoryId > 0) {
        builder.appendQueryParameter("categoryId", categoryId.toString())
      }

      return builder.build()
    }

    private fun parseSnapshot(raw: String?): WidgetSnapshot? {
      if (raw.isNullOrBlank()) {
        return null
      }

      return try {
        val json = JSONObject(raw)
        val trendJson = json.optJSONObject("trend_vs_last_month")
        val topCategoriesJson = json.optJSONArray("top_categories")
        val monthlySeriesJson = json.optJSONArray("monthly_spend_series")
        val monthLabel = json.optString("month_label", "This Month")

        val categories = mutableListOf<WidgetCategory>()
        if (topCategoriesJson != null) {
          for (index in 0 until topCategoriesJson.length()) {
            topCategoriesJson.optJSONObject(index)?.let { categories.add(parseCategory(it)) }
          }
        }

        val monthlySeries = mutableListOf<WidgetGraphRenderer.GraphPoint>()
        if (monthlySeriesJson != null) {
          for (index in 0 until monthlySeriesJson.length()) {
            monthlySeriesJson.optJSONObject(index)?.let {
              monthlySeries.add(
                WidgetGraphRenderer.GraphPoint(
                  label = it.optString("label", ""),
                  amount = it.optDouble("amount", 0.0),
                )
              )
            }
          }
        }

        val normalizedSeries = normalizeMonthlySeries(monthLabel, monthlySeries)

        WidgetSnapshot(
          monthLabel = monthLabel,
          monthSpent = json.optDouble("month_spent", 0.0),
          monthIncome = json.optDouble("month_income", 0.0),
          monthSavings = json.optDouble("month_savings", 0.0),
          transactionCount = json.optInt("transaction_count", 0),
          trend = WidgetTrend(
            percentage = trendJson?.let {
              if (it.isNull("percentage")) null else it.optDouble("percentage", 0.0)
            },
            amountChange = trendJson?.optDouble("amount_change", 0.0) ?: 0.0,
            previousAmount = trendJson?.let {
              if (it.isNull("previous_amount")) null else it.optDouble("previous_amount", 0.0)
            },
            direction = trendJson?.optString("direction", "flat") ?: "flat",
          ),
          topCategories = categories,
          monthlySpendSeries = normalizedSeries,
        )
      } catch (_: Exception) {
        null
      }
    }

    private fun normalizeMonthlySeries(
      monthLabel: String,
      monthlySeries: List<WidgetGraphRenderer.GraphPoint>,
    ): List<WidgetGraphRenderer.GraphPoint> {
      if (monthlySeries.isEmpty()) {
        return monthlySeries
      }

      val currentMonthAbbrev = monthLabel.take(3).uppercase(Locale.ENGLISH)
      val indexOfCurrent = monthlySeries.indexOfLast {
        it.label.trim().uppercase(Locale.ENGLISH).startsWith(currentMonthAbbrev)
      }

      val clippedSeries = if (indexOfCurrent >= 0) {
        monthlySeries.take(indexOfCurrent + 1)
      } else {
        monthlySeries
      }

      return clippedSeries.takeLast(6)
    }

    private fun parseCategory(json: JSONObject): WidgetCategory {
      return WidgetCategory(
        categoryId = if (json.isNull("category_id")) null else json.optInt("category_id"),
        name = json.optString("name", "Uncategorized"),
        amount = json.optDouble("amount", 0.0),
        count = json.optInt("count", 0),
      )
    }

    private fun formatCompactCurrency(value: Double): String {
      val absolute = kotlin.math.abs(value)
      val sign = if (value < 0) "-" else ""
      val formatted = when {
        absolute >= 10000000 -> compactNumber(absolute / 10000000, "Cr")
        absolute >= 100000 -> compactNumber(absolute / 100000, "L")
        absolute >= 1000 -> compactNumber(absolute / 1000, "K")
        else -> String.format(Locale.ENGLISH, "%.0f", absolute)
      }

      return "$sign₹$formatted"
    }

    private fun formatSignedCompactCurrency(value: Double): String {
      return when {
        value > 0.009 -> "+${formatCompactCurrency(value)}"
        else -> formatCompactCurrency(value)
      }
    }

    private fun compactNumber(value: Double, suffix: String): String {
      val raw = String.format(Locale.ENGLISH, "%.1f", value)
      return raw.removeSuffix(".0") + suffix
    }

    private fun formatPercent(value: Double): String {
      val raw = String.format(Locale.ENGLISH, "%.1f", kotlin.math.abs(value))
      return raw.removeSuffix(".0") + "%"
    }

    private fun formatRelativeTime(timestamp: Long): String {
      val elapsedMinutes = ((System.currentTimeMillis() - timestamp).coerceAtLeast(0L) / 60000L)
      return when {
        elapsedMinutes < 1 -> "just now"
        elapsedMinutes < 60 -> "${elapsedMinutes}m ago"
        elapsedMinutes < 1440 -> "${elapsedMinutes / 60}h ago"
        else -> "${elapsedMinutes / 1440}d ago"
      }
    }
  }
}

private enum class WidgetLayout(val layoutRes: Int) {
  SMALL(R.layout.expense_widget_small),
  MEDIUM_COMPACT(R.layout.expense_widget_medium_compact),
  MEDIUM(R.layout.expense_widget_medium),
  LARGE(R.layout.expense_widget_large),
}

private data class WidgetTrend(
  val percentage: Double?,
  val amountChange: Double,
  val previousAmount: Double?,
  val direction: String,
)

private data class WidgetCategory(
  val categoryId: Int?,
  val name: String,
  val amount: Double,
  val count: Int,
)

private data class WidgetSnapshot(
  val monthLabel: String,
  val monthSpent: Double,
  val monthIncome: Double,
  val monthSavings: Double,
  val transactionCount: Int,
  val trend: WidgetTrend,
  val topCategories: List<WidgetCategory>,
  val monthlySpendSeries: List<WidgetGraphRenderer.GraphPoint>,
)