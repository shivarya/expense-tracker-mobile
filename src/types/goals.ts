export type GoalType = 'debt_payoff' | 'savings' | 'net_worth' | 'spend_cap';
export type GoalStatus = 'active' | 'achieved' | 'abandoned';

export interface GoalProgress {
  progress_percent: number;
  is_achieved?: boolean;
  linked_loan_missing?: boolean;
  // debt_payoff
  principal_amount?: number;
  remaining_principal?: number;
  amount_paid_off?: number;
  remaining_months?: number;
  current_emi?: number;
  loan_name?: string;
  projected_payoff_date?: string;
  is_on_track?: boolean;
  required_emi?: number | null;
  emi_increase_needed?: number;
  lumpsum_needed?: number | null;
  already_on_track_without_prepayment?: boolean;
  target_date_passed?: boolean;
  // savings + net_worth
  current_amount?: number;
  target_amount?: number;
  months_remaining?: number;
  required_monthly_contribution?: number | null;
  // net_worth
  assumed_annual_return_percent?: number;
  assumed_monthly_contribution?: number;
  projected_value_at_target_date?: number;
  is_scoped?: boolean;
  additional_monthly_contribution_needed?: number;
  // spend_cap
  category_ids?: number[];
  days_in_month?: number;
  days_elapsed?: number;
  days_remaining?: number;
  run_rate_projection?: number;
  is_over_cap?: boolean;
  is_projected_to_exceed?: boolean;
}

export interface Goal {
  id: number;
  goal_type: GoalType;
  name: string;
  emi_id?: number | null;
  target_amount?: number | null;
  start_amount: number;
  target_date?: string | null;
  assumed_annual_return_percent?: number | null;
  assumed_monthly_contribution?: number | null;
  linked_category_ids?: number[] | null;
  status: GoalStatus;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  progress: GoalProgress;
}

export interface GoalContribution {
  id: number;
  goal_id: number;
  amount: number;
  contributed_at: string;
  note?: string | null;
}

export interface MonthlyPlanAllocation {
  goal_id: number;
  name: string;
  goal_type: GoalType;
  monthly_need: number;
  suggested_amount: number;
  lumpsum_target?: number;
  note: string;
}

export interface MonthlyPlan {
  is_configured: boolean;
  monthly_income: number | null;
  monthly_other_commitments: number;
  active_emi_total: number;
  housing_loan_emi_total: number;
  short_term_emi_total: number;
  spend_cap_target: number;
  total_committed: number;
  available_surplus: number | null;
  allocations: MonthlyPlanAllocation[];
  leftover_to_buffer: number;
}
