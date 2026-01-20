import { Stock, MutualFund, FixedDeposit, LongTermFund } from './investments';
import { BankAccount, Transaction, EMI } from './transactions';

export interface PortfolioSummary {
  category: string;
  invested_amount: number;
  current_value: number;
  gain_loss_percent: number;
  item_count: number;
}

export interface DashboardData {
  portfolio: {
    summary: PortfolioSummary[];
    total_invested: number;
    total_current_value: number;
    overall_gain_loss: number;
    overall_gain_loss_amount: number;
  };
  bank_accounts: BankAccount[];
  recent_transactions: Transaction[];
  upcoming_emis: EMI[];
  monthly_expenses: {
    name: string;
    color: string;
    icon: string;
    count: number;
    total: number;
    monthly_budget: number;
  }[];
  upcoming_maturities: {
    type: string;
    institution: string;
    reference: string;
    maturity_date: string;
    amount: number;
  }[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}
