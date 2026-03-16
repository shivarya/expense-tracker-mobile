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
