import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiResponse, DashboardData } from '../types/dashboard';
import { Investments } from '../types/investments';
import { WidgetSummary } from '../types/widget';
import {
  Transaction,
  TransactionSplitLine,
  TransactionSplitsResponse,
  RefundAllocationsResponse,
  BankAccount,
  EMI,
  Category,
  TrustedContact,
  TransactionGroup,
  ManualTransactionGroup,
  StatementPasswordPayload,
  StatementPasswordResponse,
  StatementPasswordCandidate,
  StatementUploadResult,
  GmailSyncRange,
  GmailSyncJob,
  BillingStatus,
} from '../types/transactions';

interface StatementUploadPayload {
  bank: string;
  account_type: 'savings' | 'current' | 'credit_card';
  card_last_four?: string;
  fileUri: string;
  fileName: string;
  mimeType?: string;
}

// Decode JWT payload without a library (works in React Native)
function parseJwtExpiry(token: string): number | null {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
    );
    const payload = JSON.parse(json);
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

class ApiService {
  private api: AxiosInstance;
  private baseURL: string;
  private debug: boolean = false;

  // Silent token refresh state
  private isRefreshing = false;
  private refreshQueue: Array<{ resolve: (token: string) => void; reject: (err: any) => void }> = [];
  private logoutCallback: (() => void) | null = null;

  private extractApiError(error: any, fallbackMessage: string): string {
    const responseError = error?.response?.data?.error;
    if (typeof responseError === 'string' && responseError.trim().length > 0) {
      return responseError;
    }

    const responseMessage = error?.response?.data?.message;
    if (typeof responseMessage === 'string' && responseMessage.trim().length > 0) {
      return responseMessage;
    }

    return error?.message || fallbackMessage;
  }

  constructor() {
    // Configuration precedence (development):
    // 1. `app.config.js` / `.env` exposed via `Constants.expoConfig.extra`
    // 2. Platform-aware defaults (Android emulator -> 10.0.2.2)
    // 3. Production URL when not __DEV__
    let extra: any = {};
    try {
      extra = Constants.expoConfig?.extra || Constants.manifest?.extra || {};
    } catch (e) {
      console.warn('[ApiService] Failed to read Constants:', e);
    }
    
    const envDevUrl: string | undefined = extra.apiUrlDev;
    const envProdUrl: string | undefined = extra.apiUrlProd;

    // enableApiDebug is exposed as a boolean from app.config.js
    this.debug = !!extra.enableApiDebug;

    this.baseURL = __DEV__
      ? (envDevUrl ?? (Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000'))
      : (envProdUrl ?? 'https://your-production-url.com/api');

    console.log('[ApiService] Initialized with baseURL:', this.baseURL, 'debug:', this.debug);

    this.api = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token + debug logging
    const safeStringify = (obj: any, max = 1200) => {
      try {
        const s = typeof obj === 'string' ? obj : JSON.stringify(obj);
        return s.length > max ? s.slice(0, max) + '...[truncated]' : s;
      } catch (e) {
        return '[unserializable]';
      }
    };

    this.api.interceptors.request.use(
      async (config) => {
        const token = await AsyncStorage.getItem('auth_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // attach start time for elapsed measurement
        (config as any).__startTime = Date.now();

        if (this.debug) {
          const safeHeaders = { ...config.headers } as any;
          if (safeHeaders.Authorization) safeHeaders.Authorization = 'Bearer [REDACTED]';
          console.debug(`[API → request] ${config.method?.toUpperCase()} ${config.url} params=${safeStringify(config.params)} body=${safeStringify(config.data)} headers=${safeStringify(safeHeaders)}`);
        }

        return config;
      },
      (error) => {
        if (this.debug) console.debug('[API → request error]', error?.message || error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling + debug logging
    this.api.interceptors.response.use(
      (response) => {
        if (this.debug) {
          const start = (response.config as any).__startTime;
          const elapsed = start ? Date.now() - start : undefined;
          console.debug(`[API ← response] ${response.config.method?.toUpperCase()} ${response.config.url} status=${response.status} time=${elapsed}ms data=${safeStringify(response.data, 800)}`);
        }
        return response;
      },
      async (error: AxiosError) => {
        const cfg = (error.config || {}) as any;
        const method = cfg.method?.toUpperCase();
        const url = cfg.url;
        const status = error.response?.status;
        if (this.debug) {
          console.debug('[API ← error]', { method, url, status, message: error.message, response: safeStringify(error.response?.data, 800) });
        }

        if (status === 401) {
          // Never retry auth endpoints or already-retried requests
          if (cfg._isRetry || url?.includes('/auth/')) {
            await this.clearAuthAndLogout();
            return Promise.reject(error);
          }

          // Queue concurrent requests while a refresh is in progress
          if (this.isRefreshing) {
            return new Promise<string>((resolve, reject) => {
              this.refreshQueue.push({ resolve, reject });
            }).then(newToken => {
              cfg.headers = cfg.headers || {};
              cfg.headers.Authorization = `Bearer ${newToken}`;
              return this.api(cfg);
            }).catch(() => Promise.reject(error));
          }

          cfg._isRetry = true;
          this.isRefreshing = true;

          try {
            const newToken = await this.silentRefreshToken();
            // Unblock queued requests
            this.refreshQueue.forEach(q => q.resolve(newToken));
            this.refreshQueue = [];
            // Retry original request
            cfg.headers = cfg.headers || {};
            cfg.headers.Authorization = `Bearer ${newToken}`;
            return this.api(cfg);
          } catch (refreshError) {
            this.refreshQueue.forEach(q => q.reject(refreshError));
            this.refreshQueue = [];
            await this.clearAuthAndLogout();
            return Promise.reject(error);
          } finally {
            this.isRefreshing = false;
          }
        }

        return Promise.reject(error);
      }
    );

    // expose runtime toggle (useful from dev console)
    (this as any).setDebug = (v: boolean) => { this.debug = !!v; return this; };
  }

  /** Register a callback that fires when silent refresh fails and the user must log in again. */
  setLogoutCallback(fn: () => void) {
    this.logoutCallback = fn;
  }

  /** Decode the stored JWT and return ms-since-epoch expiry, or null if unreadable. */
  async getTokenExpiry(): Promise<number | null> {
    const token = await AsyncStorage.getItem('auth_token');
    if (!token) return null;
    return parseJwtExpiry(token);
  }

  /** Attempt silent Google re-auth and exchange for a fresh server JWT. */
  private async silentRefreshToken(): Promise<string> {
    const googleSigninModule = require('@react-native-google-signin/google-signin');
    const GoogleSignin = googleSigninModule?.GoogleSignin;
    if (!GoogleSignin) throw new Error('GoogleSignin module unavailable');

    const Constants = require('expo-constants').default;
    const extra = Constants.expoConfig?.extra || {};
    GoogleSignin.configure({
      webClientId: extra.googleClientId || '',
      offlineAccess: false,
    });

    console.log('[ApiService] Attempting silent token refresh...');
    await GoogleSignin.signInSilently();
    const tokens = await GoogleSignin.getTokens();

    if (!tokens.idToken) throw new Error('No ID token returned from silent sign-in');

    const response = await axios.post(`${this.baseURL}/auth/google`, { id_token: tokens.idToken });
    if (!response.data.success || !response.data.data?.token) {
      throw new Error('Server token exchange failed');
    }

    const newToken: string = response.data.data.token;
    await AsyncStorage.setItem('auth_token', newToken);
    if (response.data.data.user) {
      await AsyncStorage.setItem('user_data', JSON.stringify(response.data.data.user));
    }
    console.log('[ApiService] Token refreshed silently ✓');
    return newToken;
  }

  /** Clear local auth state and fire the logout callback so the UI navigates to login. */
  private async clearAuthAndLogout() {
    await AsyncStorage.removeItem('auth_token');
    await AsyncStorage.removeItem('user_data');
    this.logoutCallback?.();
  }

  // Dashboard
  async getDashboard(): Promise<DashboardData> {
    const response = await this.api.get<ApiResponse<DashboardData>>('/dashboard');
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch dashboard');
    }
    return response.data.data;
  }

  async getWidgetSummary(): Promise<WidgetSummary> {
    const response = await this.api.get<ApiResponse<WidgetSummary>>('/widget/summary');
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch widget summary');
    }
    return response.data.data;
  }

  getBaseURL(): string {
    return this.baseURL;
  }

  // Investments
  async getAllInvestments(): Promise<Investments> {
    const response = await this.api.get<ApiResponse<Investments>>('/investments');
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch investments');
    }
    return response.data.data;
  }

  async getStocks() {
    const response = await this.api.get('/investments/stocks');
    return response.data.data;
  }

  async getMutualFunds() {
    const response = await this.api.get('/investments/mutual-funds');
    return response.data.data;
  }

  async getFixedDeposits() {
    const response = await this.api.get('/investments/fixed-deposits');
    return response.data.data;
  }

  async getLongTermFunds() {
    const response = await this.api.get('/investments/long-term');
    return response.data.data;
  }

  // Manual entry (FD / PF / NPS / PPF) — replaces the dropped portal scrapers
  async createFixedDeposit(payload: Record<string, any>): Promise<number> {
    const response = await this.api.post('/investments/fixed-deposits', payload);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to save fixed deposit');
    }
    return response.data.data?.id;
  }

  async createLongTermFund(payload: Record<string, any>): Promise<number> {
    const response = await this.api.post('/investments/long-term', payload);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to save long-term fund');
    }
    return response.data.data?.id;
  }

  // Transactions
  async getTransactions(params?: {
    start_date?: string;
    end_date?: string;
    account_id?: number;
    category_id?: number;
    group_id?: number;
    manual_group_id?: number;
    type?: string;
    keyword?: string;
    min_amount?: number;
    max_amount?: number;
    limit?: number;
    offset?: number;
  }): Promise<{ transactions: Transaction[]; summary: any }> {
    try {
      const response = await this.api.get<ApiResponse<any>>('/transactions', { params });
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error || 'Failed to fetch transactions');
      }
      return response.data.data;
    } catch (error: any) {
      throw new Error(this.extractApiError(error, 'Failed to fetch transactions'));
    }
  }

  // Transaction Groups
  async getTransactionGroups(): Promise<TransactionGroup[]> {
    const response = await this.api.get<ApiResponse<TransactionGroup[]>>('/groups');
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch groups');
    }
    return response.data.data;
  }

  async createTransactionGroup(payload: {
    name: string;
    description?: string;
    icon?: string;
    color?: string;
    rules: Array<{ rule_type: string; rule_value: string }>;
    is_preset?: boolean;
  }): Promise<{ id: number }> {
    const response = await this.api.post<ApiResponse<{ id: number }>>('/groups', payload);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to create group');
    }
    return response.data.data;
  }

  async updateTransactionGroup(groupId: number, payload: {
    name?: string;
    description?: string;
    icon?: string;
    color?: string;
    rules?: Array<{ rule_type: string; rule_value: string }>;
  }): Promise<{ id: number }> {
    const response = await this.api.put<ApiResponse<{ id: number }>>(`/groups/${groupId}`, payload);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to update group');
    }
    return response.data.data;
  }

  async deleteTransactionGroup(groupId: number): Promise<boolean> {
    const response = await this.api.delete<ApiResponse<null>>(`/groups/${groupId}`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to delete group');
    }
    return true;
  }

  async createGroupPresets(): Promise<{ created: number; skipped: number }> {
    const response = await this.api.post<ApiResponse<{ created: number; skipped: number }>>('/groups/presets', {});
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to create preset groups');
    }
    return response.data.data;
  }

  async getManualTransactionGroups(): Promise<ManualTransactionGroup[]> {
    const response = await this.api.get<ApiResponse<ManualTransactionGroup[]>>('/manual-groups');
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch manual groups');
    }
    return response.data.data;
  }

  async createManualTransactionGroup(payload: {
    name: string;
    description?: string;
    icon?: string;
    color?: string;
  }): Promise<{ id: number }> {
    const response = await this.api.post<ApiResponse<{ id: number }>>('/manual-groups', payload);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to create manual group');
    }
    return response.data.data;
  }

  async updateManualTransactionGroup(groupId: number, payload: {
    name?: string;
    description?: string;
    icon?: string;
    color?: string;
  }): Promise<{ id: number }> {
    const response = await this.api.put<ApiResponse<{ id: number }>>(`/manual-groups/${groupId}`, payload);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to update manual group');
    }
    return response.data.data;
  }

  async deleteManualTransactionGroup(groupId: number): Promise<boolean> {
    const response = await this.api.delete<ApiResponse<null>>(`/manual-groups/${groupId}`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to delete manual group');
    }
    return true;
  }

  async getTransactionManualGroups(transactionId: number): Promise<{
    transaction_id: number;
    manual_groups: ManualTransactionGroup[];
  }> {
    const response = await this.api.get<ApiResponse<{
      transaction_id: number;
      manual_groups: ManualTransactionGroup[];
    }>>(`/transactions/${transactionId}/manual-groups`);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch transaction manual groups');
    }

    return response.data.data;
  }

  async updateTransactionManualGroups(transactionId: number, groupIds: number[]): Promise<{
    transaction_id: number;
    manual_groups: ManualTransactionGroup[];
  }> {
    const response = await this.api.put<ApiResponse<{
      transaction_id: number;
      manual_groups: ManualTransactionGroup[];
    }>>(`/transactions/${transactionId}/manual-groups`, {
      group_ids: groupIds,
    });

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to save transaction manual groups');
    }

    return response.data.data;
  }

  async createTransaction(transaction: Partial<Transaction>) {
    const response = await this.api.post('/transactions', transaction);
    return response.data;
  }

  async deleteTransaction(id: number) {
    const response = await this.api.delete(`/transactions/${id}`);
    return response.data;
  }

  async updateTransactionName(transactionId: number, merchant: string): Promise<{ id: number; merchant: string }> {
    try {
      const response = await this.api.patch<ApiResponse<{ id: number; merchant: string }>>(`/transactions/${transactionId}`, {
        merchant,
      });

      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error || 'Failed to update transaction name');
      }

      return response.data.data;
    } catch (error: any) {
      throw new Error(this.extractApiError(error, 'Failed to update transaction name'));
    }
  }

  async updateTransactionCategory(transactionId: number, categoryId: number): Promise<{
    id: number;
    category_id: number;
    category_name: string;
    category_color: string;
    category_icon: string;
  }> {
    const response = await this.api.patch(`/transactions/${transactionId}/category`, {
      category_id: categoryId,
    });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to update category');
    }
    return response.data.data;
  }

  async getTransactionSplits(transactionId: number): Promise<TransactionSplitsResponse> {
    try {
      const response = await this.api.get<ApiResponse<TransactionSplitsResponse>>(`/transactions/${transactionId}/splits`);
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error || 'Failed to fetch transaction splits');
      }
      return response.data.data;
    } catch (error: any) {
      throw new Error(this.extractApiError(error, 'Failed to fetch transaction splits'));
    }
  }

  async updateTransactionSplits(
    transactionId: number,
    splits: Array<Pick<TransactionSplitLine, 'category_id' | 'amount' | 'notes'>>,
  ): Promise<TransactionSplitsResponse> {
    try {
      const response = await this.api.put<ApiResponse<TransactionSplitsResponse>>(`/transactions/${transactionId}/splits`, {
        splits,
      });

      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error || 'Failed to save transaction splits');
      }
      return response.data.data;
    } catch (error: any) {
      throw new Error(this.extractApiError(error, 'Failed to save transaction splits'));
    }
  }

  async getRefundAllocations(transactionId: number): Promise<RefundAllocationsResponse> {
    try {
      const response = await this.api.get<ApiResponse<RefundAllocationsResponse>>(`/transactions/${transactionId}/refund-allocations`);
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error || 'Failed to fetch refund allocations');
      }
      return response.data.data;
    } catch (error: any) {
      throw new Error(this.extractApiError(error, 'Failed to fetch refund allocations'));
    }
  }

  async updateRefundAllocations(
    transactionId: number,
    allocations: Array<{ expense_transaction_id: number; amount: number; notes?: string }>,
  ): Promise<RefundAllocationsResponse> {
    try {
      const response = await this.api.put<ApiResponse<RefundAllocationsResponse>>(`/transactions/${transactionId}/refund-allocations`, {
        allocations,
      });

      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error || 'Failed to save refund allocations');
      }
      return response.data.data;
    } catch (error: any) {
      throw new Error(this.extractApiError(error, 'Failed to save refund allocations'));
    }
  }

  // Bank Accounts
  async getAccounts(): Promise<BankAccount[]> {
    const response = await this.api.get<ApiResponse<BankAccount[]>>('/accounts');
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch accounts');
    }
    return response.data.data;
  }

  async getAccountDetails(id: number) {
    const response = await this.api.get(`/accounts/${id}`);
    return response.data.data;
  }

  async createAccount(account: Partial<BankAccount>) {
    const response = await this.api.post('/accounts', account);
    return response.data;
  }

  async updateAccount(id: number, account: Partial<BankAccount>) {
    const response = await this.api.put(`/accounts/${id}`, account);
    return response.data;
  }

  // EMIs
  async getEMIs(): Promise<EMI[]> {
    const response = await this.api.get<ApiResponse<EMI[]>>('/emis');
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch EMIs');
    }
    return response.data.data;
  }

  async createEMI(emi: Partial<EMI>) {
    const response = await this.api.post('/emis', emi);
    return response.data;
  }

  async updateEMI(id: number, emi: Partial<EMI>) {
    const response = await this.api.put(`/emis/${id}`, emi);
    return response.data;
  }

  // Categories
  async getCategories(): Promise<Category[]> {
    const response = await this.api.get<ApiResponse<Category[]>>('/categories');
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch categories');
    }
    return response.data.data;
  }

  async createCategory(payload: Partial<Category> & { name: string; type: Category['type'] }) {
    const response = await this.api.post<ApiResponse<{ id: number }>>('/categories', payload);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to create category');
    }
    return response.data.data;
  }

  async updateCategory(categoryId: number, payload: Partial<Category>) {
    const response = await this.api.put<ApiResponse<{ id: number }>>(`/categories/${categoryId}`, payload);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to update category');
    }
    return response.data.data;
  }

  async deleteCategory(categoryId: number) {
    const response = await this.api.delete<ApiResponse<null>>(`/categories/${categoryId}`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to delete category');
    }
    return true;
  }

  async consolidateCategories(): Promise<{ merged_categories: number; duplicate_groups: number }> {
    const response = await this.api.post<ApiResponse<{ merged_categories: number; duplicate_groups: number }>>('/categories/consolidate', {});
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to consolidate categories');
    }
    return response.data.data;
  }

  async autoFixCategories(): Promise<{ fixed: number; deleted: number; details: any[] }> {
    const response = await this.api.post<ApiResponse<{ fixed: number; deleted: number; details: any[] }>>('/categories/auto-fix', {});
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Auto-fix failed');
    }
    return response.data.data;
  }

  // Sync
  async getSyncLogs(limit: number = 50) {
    const response = await this.api.get(`/sync/logs?limit=${limit}`);
    return response.data.data;
  }

  async getSyncJobStatus(jobId: number) {
    const response = await this.api.get<ApiResponse<any>>(`/sync/status/${jobId}`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch sync job status');
    }
    return response.data.data;
  }

  async getLatestSyncJob() {
    const response = await this.api.get<ApiResponse<any>>('/sync/latest');
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch latest sync job');
    }
    return response.data.data;
  }

  // Expense Analytics
  async getExpenseSummary(period: 'cm' | '1m' | '3m' | '6m' | '1y' = '6m', groupId?: number) {
    const response = await this.api.get(`/api/expenses/summary`, {
      params: {
        period,
        group_id: groupId,
      }
    });

    // Debug/log the exact response in development to diagnose unexpected shapes
    if (this.debug) {
      console.debug('[ApiService] getExpenseSummary response:', JSON.stringify(response.data));
    }

    // Be tolerant of different response shapes coming from dev servers / proxies
    const successFlag = (typeof response.data.success === 'boolean') ? response.data.success : undefined;
    const payload = response.data.data ?? response.data;

    if (successFlag === false) {
      throw new Error(response.data.error || 'Failed to fetch expense summary');
    }

    if (!payload) {
      throw new Error(response.data.error || 'Failed to fetch expense summary');
    }

    return payload as any;
  }

  // Auth
  async googleLogin(idToken: string) {
    const response = await this.api.post('/auth/google', { id_token: idToken });
    if (response.data.success && response.data.data?.token) {
      await AsyncStorage.setItem('auth_token', response.data.data.token);
      if (response.data.data.user) {
        await AsyncStorage.setItem('user_data', JSON.stringify(response.data.data.user));
      }
    }
    return response.data;
  }

  // Gmail integration — connect read-only Gmail so the server can auto-fetch statements
  async connectGmail(): Promise<{ connected: boolean; email?: string }> {
    const googleSigninModule = require('@react-native-google-signin/google-signin');
    const GoogleSignin = googleSigninModule?.GoogleSignin;
    if (!GoogleSignin) throw new Error('GoogleSignin module unavailable');

    const Constants = require('expo-constants').default;
    const extra = Constants.expoConfig?.extra || {};
    const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

    // offlineAccess + forceCodeForRefreshToken => a one-time serverAuthCode the
    // backend exchanges for a refresh token.
    GoogleSignin.configure({
      webClientId: extra.googleClientId || '',
      offlineAccess: true,
      forceCodeForRefreshToken: true,
      scopes: ['openid', 'profile', 'email', GMAIL_SCOPE],
    });

    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    const readCode = (res: any): string | undefined =>
      res?.data?.serverAuthCode ?? res?.serverAuthCode;

    let serverAuthCode: string | undefined;
    try {
      serverAuthCode = readCode(await GoogleSignin.signIn());
    } catch (e) {
      // If already signed in without the scope, fall through to addScopes below.
    }

    // Incremental authorization: ensure the gmail scope + a fresh code.
    if (!serverAuthCode && typeof GoogleSignin.addScopes === 'function') {
      serverAuthCode = readCode(await GoogleSignin.addScopes({ scopes: [GMAIL_SCOPE] }));
    }

    if (!serverAuthCode) {
      throw new Error('Could not obtain Google authorization code for Gmail access');
    }

    const response = await this.api.post('/gmail/connect', { server_auth_code: serverAuthCode });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to connect Gmail');
    }
    return response.data.data;
  }

  async getGmailStatus(): Promise<{ connected: boolean; authorized_at: string | null }> {
    const response = await this.api.get('/gmail/status');
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to get Gmail status');
    }
    return response.data.data;
  }

  async disconnectGmail(): Promise<boolean> {
    const response = await this.api.post('/gmail/disconnect', {});
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to disconnect Gmail');
    }
    return true;
  }

  // Queue a server-side Gmail fetch for the given range; drained by the cron worker.
  async triggerGmailSync(
    range: GmailSyncRange,
    types?: string[]
  ): Promise<{ job_id: number; status: string; already_queued: boolean }> {
    const response = await this.api.post('/gmail/sync', { range, ...(types ? { types } : {}) });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to queue Gmail sync');
    }
    return response.data.data;
  }

  async getGmailJobs(): Promise<GmailSyncJob[]> {
    const response = await this.api.get('/gmail/jobs');
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to load Gmail sync jobs');
    }
    return response.data.data.jobs ?? [];
  }

  // Billing / premium
  async getBillingStatus(): Promise<BillingStatus> {
    const response = await this.api.get('/billing/status');
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to get billing status');
    }
    return response.data.data;
  }

  async verifyPurchase(productId: string, purchaseToken: string): Promise<BillingStatus> {
    const response = await this.api.post('/billing/verify', {
      product_id: productId,
      purchase_token: purchaseToken,
    });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to verify purchase');
    }
    return response.data.data;
  }

  // SMS Sync
  async parseSMS(
    messages: Array<{ sender: string; body: string; date: string }>,
    options?: { async?: boolean; mode?: 'manual' | 'auto_daily' | 'auto_realtime'; forceLookbackDays?: number }
  ) {
    const payload: Record<string, any> = { messages };
    if (options?.async !== undefined) {
      payload.async = options.async;
    }
    if (options?.mode) {
      payload.mode = options.mode;
    }
    if (options?.forceLookbackDays !== undefined) {
      payload.force_lookback_days = options.forceLookbackDays;
    }

    return await this.api.post('/parse/sms', payload);
  }

  async parseSMSWebhook(message: { sender: string; body: string; date: string }) {
    return await this.api.post('/parse/sms/webhook', message);
  }

  // Free-tier path: app-parsed (on-device) transactions; server categorizes + dedupes without AI.
  async parseStructuredSMS(transactions: any[]) {
    return await this.api.post('/parse/sms/structured', { transactions });
  }

  async saveStatementPassword(payload: StatementPasswordPayload): Promise<StatementPasswordResponse> {
    const response = await this.api.post<ApiResponse<StatementPasswordResponse>>('/statements/password', payload);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to save statement password');
    }
    return response.data.data;
  }

  async deleteStatementPassword(payload: {
    bank: string;
    account_type: 'savings' | 'current' | 'credit_card';
    card_last_four?: string;
  }): Promise<boolean> {
    const response = await this.api.delete<ApiResponse<{ deleted: boolean }>>('/statements/password', { data: payload });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to delete statement password');
    }
    return !!response.data.data?.deleted;
  }

  // Candidate password pool — a per-user list of passwords the server tries
  // when decrypting protected statement PDFs (uploads + Gmail-fetched).
  async getStatementPasswordCandidates(): Promise<StatementPasswordCandidate[]> {
    const response = await this.api.get<ApiResponse<{ candidates: StatementPasswordCandidate[] }>>(
      '/statements/password-candidates'
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to load password candidates');
    }
    return response.data.data.candidates ?? [];
  }

  async addStatementPasswordCandidates(
    passwords: Array<{ password: string; label?: string }>
  ): Promise<{ added: number; skipped_duplicates: number; invalid: number }> {
    const response = await this.api.post<ApiResponse<{ added: number; skipped_duplicates: number; invalid: number }>>(
      '/statements/password-candidates',
      { passwords }
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to save password candidates');
    }
    return response.data.data;
  }

  async deleteStatementPasswordCandidate(payload: { id?: number; all?: boolean }): Promise<boolean> {
    const response = await this.api.delete<ApiResponse<{ deleted: boolean | number }>>(
      '/statements/password-candidates',
      { data: payload }
    );
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to delete password candidate');
    }
    return !!response.data.data?.deleted;
  }

  async uploadStatementPdf(payload: StatementUploadPayload): Promise<StatementUploadResult> {
    const formData = new FormData();
    formData.append('bank', payload.bank);
    formData.append('account_type', payload.account_type);
    if (payload.card_last_four) {
      formData.append('card_last_four', payload.card_last_four);
    }

    formData.append('statement_pdf', {
      uri: payload.fileUri,
      name: payload.fileName,
      type: payload.mimeType || 'application/pdf',
    } as any);

    const response = await this.api.post<ApiResponse<StatementUploadResult>>('/statements/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 120000,
    });

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to upload statement PDF');
    }

    return response.data.data;
  }

  // Trusted Contacts
  async getTrustedContacts(): Promise<TrustedContact[]> {
    const response = await this.api.get<ApiResponse<TrustedContact[]>>('/contacts');
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch trusted contacts');
    }
    return response.data.data;
  }

  async createTrustedContact(data: { name: string; upi_id?: string; notes?: string }): Promise<TrustedContact> {
    const response = await this.api.post<ApiResponse<TrustedContact>>('/contacts', data);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to create trusted contact');
    }
    return response.data.data;
  }

  async updateTrustedContact(id: number, data: { name?: string; upi_id?: string | null; notes?: string | null }): Promise<TrustedContact> {
    const response = await this.api.put<ApiResponse<TrustedContact>>(`/contacts/${id}`, data);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to update trusted contact');
    }
    return response.data.data;
  }

  async deleteTrustedContact(id: number): Promise<boolean> {
    const response = await this.api.delete<ApiResponse<null>>(`/contacts/${id}`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to delete trusted contact');
    }
    return true;
  }

  async deleteAccount() {
    const response = await this.api.delete<ApiResponse<null>>('/auth/account');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to delete account');
    }
    // Clear local auth tokens
    await AsyncStorage.removeItem('auth_token');
    await AsyncStorage.removeItem('user_data');
    return true;
  }
}

export default new ApiService();
