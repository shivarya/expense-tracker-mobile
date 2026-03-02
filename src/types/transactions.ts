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
  source: 'sms' | 'email' | 'web_scrape' | 'manual';
  category_name?: string;
  category_color?: string;
  category_icon?: string;
  bank?: string;
  account_type?: string;
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
