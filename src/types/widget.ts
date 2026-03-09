export interface WidgetTrendSummary {
  percentage: number | null;
  amount_change: number;
  previous_amount: number;
  direction: 'up' | 'down' | 'flat';
}

export interface WidgetCategorySummary {
  name: string;
  color: string;
  icon: string;
  count: number;
  amount: number;
}

export interface WidgetMonthlySpendPoint {
  key: string;
  label: string;
  amount: number;
}

export interface WidgetSummary {
  month_label: string;
  month_spent: number;
  month_income: number;
  month_savings: number;
  transaction_count: number;
  trend_vs_last_month: WidgetTrendSummary;
  top_category: WidgetCategorySummary | null;
  top_categories: WidgetCategorySummary[];
  monthly_spend_series: WidgetMonthlySpendPoint[];
  updated_at: string;
  currency: string;
}