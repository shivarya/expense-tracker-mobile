import 'react-native-gesture-handler';
import React from 'react';
import { Linking } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme, DarkTheme, LinkingOptions, getStateFromPath, createNavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
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
    // Set by the native transaction notification (SmsNotifier). A raw
    // NotificationManagerCompat notify never reaches the expo-notifications
    // response listener below, so native taps arrive as a deep link instead.
    focusTransactionId: parseNumberParam(params.get('focusTransactionId')),
    focusCategoryId: parseNumberParam(params.get('focusCategoryId')),
    focusAmount: parseNumberParam(params.get('focusAmount')),
    focusMerchant: params.get('focusMerchant') || undefined,
    focusDescription: params.get('focusDescription') || undefined,
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

const linkingConfig = {
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
};

const linkingGetStateFromPath: LinkingOptions<any>['getStateFromPath'] = (path, options) => {
  const state = getStateFromPath(path, options);
  if (!state) return state;

  if (path.includes('expenses/current')) {
    const parsedParams = parseWidgetQueryParams(path);
    mergeTransactionsParams(state, parsedParams);
  }

  return state;
};

export const navigationRef = createNavigationContainerRef<any>();

function AppContent() {
  const { isDark } = useTheme();
  const { locked, covered } = useAppLock();

  // Deep links (from the native SmsNotifier transaction notification, or a
  // widget tap) frequently arrive on a warm re-entry -- app process alive but
  // backgrounded -- while RootNavigator is still showing its bare loading
  // view (auth/permissions checks in flight, zero navigators mounted yet).
  // React Navigation's own built-in 'url' listener has no retry: it calls
  // navigation.dispatch() immediately, which silently no-ops (just a
  // console.error) when nothing has registered a focus listener yet, so the
  // link is dropped and the app just opens to whatever screen it defaults
  // to. Providing `subscribe` lets us hold the URL and replay it once the
  // container actually becomes ready, instead of relying on that no-retry
  // listener catching every case a cold start's blocking getInitialURL()
  // wait already handles fine.
  //
  // This must be a QUEUE, not a single slot: a burst of bank SMS produces one
  // notification each, and if a second one arrives (or is tapped) before nav
  // is ready, a single-slot "latest wins" ref silently discards the first tap
  // -- which is exactly what caused category changes to land on the wrong
  // transaction, since whichever link survived is the one that opened.
  const isNavigationReadyRef = React.useRef(false);
  const pendingActionsQueueRef = React.useRef<Array<() => void>>([]);

  const handleNavigationReady = React.useCallback(() => {
    isNavigationReadyRef.current = true;
    const queued = pendingActionsQueueRef.current;
    pendingActionsQueueRef.current = [];
    queued.forEach((action) => action());
  }, []);

  const runOrQueue = React.useCallback((action: () => void) => {
    if (isNavigationReadyRef.current) {
      action();
    } else {
      pendingActionsQueueRef.current.push(action);
    }
  }, []);

  const linking = React.useMemo<LinkingOptions<any>>(() => ({
    prefixes: ['expensetracker://'],
    config: linkingConfig,
    getStateFromPath: linkingGetStateFromPath,
    subscribe(listener) {
      const subscription = Linking.addEventListener('url', ({ url }) => {
        runOrQueue(() => listener(url));
      });

      return () => subscription.remove();
    },
  }), [runOrQueue]);

  React.useEffect(() => {
    // Same queue as the deep-link path above -- this listener used to bail
    // out and drop the tap entirely when navigation wasn't ready yet instead
    // of retrying, which is a second way an earlier notification tap could
    // go missing while a later one (or an unrelated screen) took its place.
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, any> | undefined;
      if (!data?.transactionId) return;

      runOrQueue(() => {
        navigationRef.navigate('Main', {
          screen: 'Expenses',
          params: {
            screen: 'Transactions',
            params: {
              focusTransactionId: Number(data.transactionId),
              focusMerchant: data.merchant ?? undefined,
              focusAmount: data.amount !== undefined ? Number(data.amount) : undefined,
              focusCategoryId: data.categoryId !== undefined ? Number(data.categoryId) : undefined,
              focusDescription: data.description ?? undefined,
            },
          },
        } as never);
      });
    });

    return () => subscription.remove();
  }, [runOrQueue]);

  return (
    <>
      <NavigationContainer
        ref={navigationRef}
        theme={isDark ? DarkTheme : DefaultTheme}
        linking={linking}
        onReady={handleNavigationReady}
      >
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
