export interface BankAccount {
  id: number;
  bank: string;
  account_type: 'savings' | 'current' | 'credit_card';
  account_number: string;
  account_name: string;
  balance: number;
  credit_limit?: number;
  available_credit?: number;
  card_last_four?: string;
  status: 'active' | 'closed' | 'frozen';
}

export interface Category {
  id: number;
  name: string;
  icon: string;
  color: string;
  type: 'expense' | 'income' | 'investment' | 'transfer';
  monthly_budget: number;
  is_system: boolean;
}

export interface Transaction {
  id: number;
  account_id: number;
  category_id: number;
  transaction_type: 'debit' | 'credit' | 'transfer';
  amount: number;
  merchant?: string;
  description?: string;
  transaction_date: string;
  reference_number?: string;
  source: 'sms' | 'email' | 'web_scrape' | 'manual' | 'sms_webhook' | 'statement_pdf';
  category_name?: string;
  category_color?: string;
  category_icon?: string;
  bank?: string;
  account_type?: string;
  account_name?: string;
  payment_method?: string;
  has_split?: boolean;
  split_count?: number;
  split_total?: number;
  refund_allocation_count?: number;
  refund_allocated_amount?: number;
  refund_targets_count?: number;
  refund_allocated_out?: number;
}

export interface TransactionSplitLine {
  id?: number;
  category_id: number;
  amount: number;
  display_order?: number;
  notes?: string | null;
  category_name?: string;
  category_color?: string;
  category_icon?: string;
}

export interface TransactionSplitsResponse {
  transaction_id: number;
  parent_amount: number;
  is_split: boolean;
  split_count: number;
  split_total: number;
  splits: TransactionSplitLine[];
}

export interface RefundAllocation {
  id?: number;
  refund_transaction_id?: number;
  expense_transaction_id: number;
  amount: number;
  notes?: string | null;
  expense_merchant?: string | null;
  expense_description?: string | null;
  expense_transaction_date?: string;
  expense_category_name?: string | null;
  refund_merchant?: string | null;
  refund_description?: string | null;
  refund_transaction_date?: string;
}

export interface RefundAllocationsResponse {
  transaction_id: number;
  transaction_type: 'debit' | 'credit' | 'transfer';
  mode: 'from_refund' | 'to_expense';
  refund_amount?: number;
  total_allocated: number;
  remaining_refundable?: number | null;
  allocations: RefundAllocation[];
}

export type TransactionGroupRuleType =
  | 'category_id'
  | 'account_id'
  | 'account_type'
  | 'payment_method_keyword'
  | 'merchant_keyword'
  | 'transaction_type';

export interface TransactionGroupRule {
  id?: number;
  rule_type: TransactionGroupRuleType;
  rule_value: string;
}

export interface TransactionGroup {
  id: number;
  name: string;
  description?: string | null;
  icon?: string;
  color?: string;
  is_preset?: boolean;
  rule_count?: number;
  rules: TransactionGroupRule[];
}

export interface TrustedContact {
  id: number;
  name: string;
  upi_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface EMI {
  id: number;
  loan_name: string;
  loan_type: 'home' | 'car' | 'personal' | 'education' | 'credit_card' | 'consumer_durable' | 'other';
  bank: string;
  principal_amount: number;
  interest_rate: number;
  tenure_months: number;
  emi_amount: number;
  remaining_months: number;
  total_installments?: number;
  paid_installments?: number;
  next_payment_date: string;
  start_date?: string;
  end_date?: string;
  status: 'active' | 'paid' | 'foreclosed';
}

export interface StatementPasswordPayload {
  bank: string;
  account_type: 'savings' | 'current' | 'credit_card';
  card_last_four?: string;
  password: string;
}

export interface StatementPasswordResponse {
  bank: string;
  account_type: 'savings' | 'current' | 'credit_card';
  card_last_four?: string;
  stored: boolean;
}

export interface StatementUploadResult {
  upload_id: number;
  duplicate_upload: boolean;
  extracted_transactions: number;
  saved_transactions: number;
  skipped_high_confidence: number;
  flagged_possible_duplicates: number;
  ai_checked_transactions: number;
  duplicate_fallback_used: number;
  errors?: string[];
}
