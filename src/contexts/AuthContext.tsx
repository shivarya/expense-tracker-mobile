import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { clearWidgetSession, syncWidgetSession } from '../services/widget';

interface User {
  id: number;
  email: string;
  name: string;
  picture?: string;
  google_id?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  loginWithGoogle: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (userData: Partial<User>) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Check if user is logged in on app start + register logout callback
  useEffect(() => {
    // Register logout callback so ApiService can trigger logout when silent refresh fails
    import('../services/api').then(({ default: ApiService }) => {
      ApiService.setLogoutCallback(() => {
        setUser(null);
        clearWidgetSession();
      });
    });
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const userData = await AsyncStorage.getItem('user_data');

      if (token && userData) {
        // Proactively refresh if token has expired or expires within the next 5 minutes
        const { default: ApiService } = await import('../services/api');
        const expiry = await ApiService.getTokenExpiry();
        const fiveMinutes = 5 * 60 * 1000;
        const isExpiredOrSoon = expiry !== null && expiry < Date.now() + fiveMinutes;

        if (isExpiredOrSoon) {
          console.log('[AuthContext] Token expired or expiring soon — attempting silent refresh');
          try {
            // Trigger a lightweight authenticated request; the interceptor will refresh the token
            await ApiService.getDashboard();
          } catch {
            // If refresh fails the interceptor fires the logout callback — nothing more to do here
            return;
          }
        }

        setUser(JSON.parse(userData));
        await syncWidgetSession();
      } else {
        await clearWidgetSession();
      }
    } catch (error) {
      console.error('[AuthContext] checkAuth error:', error);
      // Silent fail - user will be logged out
      await clearWidgetSession();
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async (idToken: string) => {
    try {
      const ApiService = (await import('../services/api')).default;
      const response = await ApiService.googleLogin(idToken) as any;

      if (response.success && response.data) {
        const { token, user: userData } = response.data;

        await AsyncStorage.setItem('auth_token', token);
        await AsyncStorage.setItem('user_data', JSON.stringify(userData));

        setUser(userData);
        await syncWidgetSession();
      } else {
        throw new Error(response.error || 'Login failed');
      }
    } catch (error) {
      console.error('[AuthContext] Login error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('auth_token');
      await AsyncStorage.removeItem('user_data');
      await clearWidgetSession();
      setUser(null);
    } catch (error) {
      console.error('[AuthContext] Logout error:', error);
    }
  };

  const updateUser = (userData: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...userData };
      setUser(updatedUser);
      AsyncStorage.setItem('user_data', JSON.stringify(updatedUser));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        loginWithGoogle,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export type { User };
