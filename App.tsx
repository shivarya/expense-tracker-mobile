import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme, DarkTheme, LinkingOptions, getStateFromPath } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DataProvider } from './src/contexts/DataContext';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { AuthProvider } from './src/contexts/AuthContext';
import { AppLockProvider, useAppLock } from './src/contexts/AppLockContext';
import RootNavigator from './src/navigation/RootNavigator';
import AppLockOverlay from './src/components/AppLockOverlay';

const parseNumberParam = (value: string | null): number | undefined => {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
};

const parseWidgetQueryParams = (path: string) => {
  const queryIndex = path.indexOf('?');
  if (queryIndex < 0) return {};
  const query = path.slice(queryIndex + 1);
  const params = new URLSearchParams(query);

  return {
    initialMonthKey: params.get('initialMonthKey') === 'current' ? 'current' : undefined,
    headerTitle: params.get('headerTitle') || undefined,
    type: params.get('type') as 'debit' | 'credit' | undefined,
    categoryId: parseNumberParam(params.get('categoryId')),
    groupId: parseNumberParam(params.get('groupId')),
    manualGroupId: parseNumberParam(params.get('manualGroupId')),
    startDate: params.get('startDate') || undefined,
    endDate: params.get('endDate') || undefined,
  };
};

const mergeTransactionsParams = (state: any, extraParams: Record<string, unknown>) => {
  if (!state || !Array.isArray(state.routes)) return;

  state.routes.forEach((route: any) => {
    if (route?.name === 'Transactions') {
      route.params = { ...(route.params || {}), ...extraParams };
    }

    if (route?.state) {
      mergeTransactionsParams(route.state, extraParams);
    }
  });
};

const linking: LinkingOptions<any> = {
  prefixes: ['expensetracker://'],
  config: {
    screens: {
      Login: 'login',
      Main: {
        screens: {
          Dashboard: 'dashboard',
          Investments: 'investments',
          Expenses: {
            screens: {
              ExpensesOverview: 'expenses',
              Transactions: 'expenses/current',
              CategoriesSpend: 'expenses/categories',
              MasterCategories: 'expenses/master-categories',
            },
          },
          Accounts: 'accounts',
          More: 'more',
        },
      },
    },
  },
  getStateFromPath: (path, options) => {
    const state = getStateFromPath(path, options);
    if (!state) return state;

    if (path.includes('expenses/current')) {
      const parsedParams = parseWidgetQueryParams(path);
      mergeTransactionsParams(state, parsedParams);
    }

    return state;
  },
};

function AppContent() {
  const { isDark } = useTheme();
  const { locked, covered } = useAppLock();

  return (
    <>
      <NavigationContainer theme={isDark ? DarkTheme : DefaultTheme} linking={linking}>
        <RootNavigator />
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </NavigationContainer>
      {(locked || covered) && <AppLockOverlay />}
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <AppLockProvider>
            <DataProvider>
              <AppContent />
            </DataProvider>
          </AppLockProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
