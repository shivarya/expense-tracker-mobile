export interface Stock {
  id: number;
  platform: 'zerodha' | 'groww' | 'other';
  symbol: string;
  company_name?: string;
  quantity: number;
  average_price: number;
  invested_amount: number;
  current_value: number;
  current_price?: number;
  gain_loss_amount: number;
  gain_loss_percent: number;
  last_updated: string;
}

export interface MutualFund {
  id: number;
  fund_name: string;
  folio_number: string;
  amc: string;
  units: number;
  nav: number;
  invested_amount: number;
  current_value: number;
  gain_loss_amount: number;
  gain_loss_percent: number;
  plan_type: 'direct' | 'regular';
  option_type: 'growth' | 'dividend' | 'idcw';
  portal_url?: string;
  last_updated: string;
}

export interface FixedDeposit {
  id: number;
  bank: string;
  fd_number?: string;
  principal_amount: number;
  interest_rate: number;
  tenure_months: number;
  start_date: string;
  maturity_date: string;
  maturity_value: number;
  amount_percent: number;
  status: 'active' | 'matured' | 'premature_withdrawal';
}

export interface LongTermFund {
  id: number;
  fund_type: 'pf' | 'nps' | 'sukanya' | 'ppf' | 'vpf';
  account_name: string;
  account_number?: string;
  invested_amount: number;
  current_value: number;
  employer_contribution?: number;
  interest_earned?: number;
  maturity_date?: string;
  maturity_value?: number;
  status: 'active' | 'matured' | 'closed';
}

export interface Investments {
  stocks: Stock[];
  mutual_funds: MutualFund[];
  fixed_deposits: FixedDeposit[];
  long_term_funds: LongTermFund[];
}
