import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { AppState } from 'react-native';
import { DashboardData } from '../types/dashboard';
import { Investments } from '../types/investments';
import { BankAccount, Category, EMI } from '../types/transactions';
import { Goal } from '../types/goals';
import { Subscription } from '../types/subscriptions';
import ApiService from '../services/api';
import { requestWidgetSummaryRefresh } from '../services/widget';
import { useAuth } from './AuthContext';
import { useSMSSync } from '../hooks/useSMSSync';

interface DataContextType {
  dashboard: DashboardData | null;
  investments: Investments | null;
  accounts: BankAccount[];
  categories: Category[];
  emis: EMI[];
  goals: Goal[];
  subscriptions: Subscription[];
  loading: boolean;
  error: string | null;
  refreshDashboard: () => Promise<void>;
  refreshInvestments: () => Promise<void>;
  refreshAccounts: () => Promise<void>;
  refreshCategories: () => Promise<void>;
  refreshEmis: () => Promise<void>;
  refreshGoals: () => Promise<void>;
  refreshSubscriptions: () => Promise<void>;
  refreshAll: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { runDailyAutoSyncIfNeeded } = useSMSSync({ enableRealtimeListener: true });
  const autoSyncInProgressRef = useRef(false);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [investments, setInvestments] = useState<Investments | null>(null);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [emis, setEmis] = useState<EMI[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('[DataContext] Fetching dashboard...');
      const data = await ApiService.getDashboard();
      console.log('[DataContext] Dashboard loaded:', !!data);
      setDashboard(data);
      void requestWidgetSummaryRefresh();
    } catch (err: any) {
      const msg = err.message || 'Failed to fetch dashboard';
      setError(msg);
      console.error('[DataContext] Dashboard error:', msg, err);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshInvestments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await ApiService.getAllInvestments();
      setInvestments(data);
      void requestWidgetSummaryRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to fetch investments');
      console.error('Investments error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshAccounts = useCallback(async () => {
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
  }, []);

  const refreshCategories = useCallback(async () => {
    try {
      // Don't set global loading=true for categories — it's a background refresh
      setError(null);
      const data = await ApiService.getCategories();
      setCategories(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch categories');
      console.error('Categories error:', err);
    }
  }, []);

  const refreshEmis = useCallback(async () => {
    try {
      setError(null);
      const data = await ApiService.getEMIs();
      setEmis(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch EMIs');
      console.error('EMIs error:', err);
    }
  }, []);

  const refreshGoals = useCallback(async () => {
    try {
      setError(null);
      const data = await ApiService.getGoals();
      setGoals(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch goals');
      console.error('Goals error:', err);
    }
  }, []);

  const refreshSubscriptions = useCallback(async () => {
    try {
      setError(null);
      const data = await ApiService.getSubscriptions();
      setSubscriptions(data.subscriptions);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch subscriptions');
      console.error('Subscriptions error:', err);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      refreshDashboard(),
      refreshInvestments(),
      refreshAccounts(),
      refreshCategories(),
      refreshEmis(),
      refreshGoals(),
      refreshSubscriptions(),
    ]);
  }, [refreshDashboard, refreshInvestments, refreshAccounts, refreshCategories, refreshEmis, refreshGoals, refreshSubscriptions]);

  const tryDailyAutoSync = useCallback(async (reason: 'startup' | 'foreground') => {
    if (!user || autoSyncInProgressRef.current) {
      return;
    }

    autoSyncInProgressRef.current = true;
    try {
      const result = await runDailyAutoSyncIfNeeded();

      if (result.success && !result.didSkip && result.saved > 0) {
        console.log(`[DataContext] Auto SMS sync (${reason}) saved ${result.saved} transactions. Refreshing data.`);
        await refreshAll();
      }
    } catch (error) {
      console.warn(`[DataContext] Auto SMS sync (${reason}) failed:`, error);
    } finally {
      autoSyncInProgressRef.current = false;
    }
  }, [refreshAll, runDailyAutoSyncIfNeeded, user]);

  // Load initial data only when user is authenticated
  useEffect(() => {
    if (user) {
      console.log('[DataContext] User authenticated, fetching data...');
      refreshAll();

      // Daily fallback: when app opens and user is authenticated, run one silent auto-sync.
      tryDailyAutoSync('startup');

      const appStateSubscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') {
          tryDailyAutoSync('foreground');
        }
      });

      return () => {
        appStateSubscription.remove();
      };
    } else {
      console.log('[DataContext] No user, skipping data fetch');
    }
  // refreshAll is stable via useCallback — safe to include
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tryDailyAutoSync, user]);

  return (
    <DataContext.Provider
      value={{
        dashboard,
        investments,
        accounts,
        categories,
        emis,
        goals,
        subscriptions,
        loading,
        error,
        refreshDashboard,
        refreshInvestments,
        refreshAccounts,
        refreshCategories,
        refreshEmis,
        refreshGoals,
        refreshSubscriptions,
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
