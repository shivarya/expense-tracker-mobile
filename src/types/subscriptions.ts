export type SubscriptionBillingCycle = 'weekly' | 'monthly' | 'quarterly' | 'annual';
export type SubscriptionStatus = 'active' | 'deactivated' | 'dismissed';

export interface Subscription {
  id: number;
  merchant_pattern: string;
  display_name: string;
  category_id: number | null;
  category_name?: string;
  billing_cycle: SubscriptionBillingCycle;
  average_amount: number;
  last_amount: number;
  amount_variance_percent: number;
  occurrence_count: number;
  first_transaction_date: string;
  last_transaction_date: string;
  next_expected_date: string | null;
  status: SubscriptionStatus;
  detection_source: 'bulk_scan' | 'incremental';
  cancel_url: string | null;
  notes: string | null;
  dismissed_at: string | null;
  deactivated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionsSummary {
  active_count: number;
  estimated_monthly_total: number;
}

export interface SubscriptionsListResponse {
  subscriptions: Subscription[];
  summary: SubscriptionsSummary;
}

export interface SubscriptionScanResult {
  groups_evaluated: number;
  created: number;
  updated: number;
  skipped_dismissed: number;
}
