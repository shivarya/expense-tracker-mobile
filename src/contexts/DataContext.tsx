import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { DashboardData } from '../types/dashboard';
import { Investments } from '../types/investments';
import { BankAccount, Category } from '../types/transactions';
import ApiService from '../services/api';

interface DataContextType {
  dashboard: DashboardData | null;
  investments: Investments | null;
  accounts: BankAccount[];
  categories: Category[];
  loading: boolean;
  error: string | null;
  refreshDashboard: () => Promise<void>;
  refreshInvestments: () => Promise<void>;
  refreshAccounts: () => Promise<void>;
  refreshCategories: () => Promise<void>;
  refreshAll: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [investments, setInvestments] = useState<Investments | null>(null);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('[DataContext] Fetching dashboard...');
      const data = await ApiService.getDashboard();
      console.log('[DataContext] Dashboard loaded:', !!data);
      setDashboard(data);
    } catch (err: any) {
      const msg = err.message || 'Failed to fetch dashboard';
      setError(msg);
      console.error('[DataContext] Dashboard error:', msg, err);
    } finally {
      setLoading(false);
    }
  };

  const refreshInvestments = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await ApiService.getAllInvestments();
      setInvestments(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch investments');
      console.error('Investments error:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshAccounts = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await ApiService.getAccounts();
      setAccounts(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch accounts');
      console.error('Accounts error:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshCategories = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await ApiService.getCategories();
      setCategories(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch categories');
      console.error('Categories error:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshAll = async () => {
    await Promise.all([
      refreshDashboard(),
      refreshInvestments(),
      refreshAccounts(),
      refreshCategories(),
    ]);
  };

  // Load initial data
  useEffect(() => {
    refreshAll();
  }, []);

  return (
    <DataContext.Provider
      value={{
        dashboard,
        investments,
        accounts,
        categories,
        loading,
        error,
        refreshDashboard,
        refreshInvestments,
        refreshAccounts,
        refreshCategories,
        refreshAll,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within DataProvider');
  }
  return context;
};
