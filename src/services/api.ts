import axios, { AxiosInstance, AxiosError } from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiResponse, DashboardData } from '../types/dashboard';
import { Investments } from '../types/investments';
import { Transaction, BankAccount, EMI, Category, TrustedContact } from '../types/transactions';

class ApiService {
  private api: AxiosInstance;
  private baseURL: string;
  private debug: boolean = false;

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
      (error: AxiosError) => {
        const cfg = (error.config || {}) as any;
        const method = cfg.method?.toUpperCase();
        const url = cfg.url;
        const status = error.response?.status;
        if (this.debug) {
          console.debug('[API ← error]', { method, url, status, message: error.message, response: safeStringify(error.response?.data, 800) });
        }
        if (error.response?.status === 401) {
          // Handle unauthorized - clear token
          AsyncStorage.removeItem('auth_token');
        }
        return Promise.reject(error);
      }
    );

    // expose runtime toggle (useful from dev console)
    (this as any).setDebug = (v: boolean) => { this.debug = !!v; return this; };
  }

  // Dashboard
  async getDashboard(): Promise<DashboardData> {
    const response = await this.api.get<ApiResponse<DashboardData>>('/dashboard');
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch dashboard');
    }
    return response.data.data;
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

  // Transactions
  async getTransactions(params?: {
    start_date?: string;
    end_date?: string;
    account_id?: number;
    category_id?: number;
    type?: string;
    limit?: number;
  }): Promise<{ transactions: Transaction[]; summary: any }> {
    const response = await this.api.get<ApiResponse<any>>('/transactions', { params });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch transactions');
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

  // Expense Analytics
  async getExpenseSummary(period: '1m' | '3m' | '6m' | '1y' = '6m') {
    const response = await this.api.get(`/api/expenses/summary`, {
      params: { period }
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

  // SMS Sync
  async parseSMS(messages: Array<{ sender: string; body: string; date: string }>) {
    return await this.api.post('/parse/sms', { messages });
  }

  async login() {
    const response = await this.api.post('/auth/login', {});
    if (response.data.success && response.data.data.token) {
      await AsyncStorage.setItem('auth_token', response.data.data.token);
    }
    return response.data;
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
