import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme, DarkTheme, LinkingOptions } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DataProvider } from './src/contexts/DataContext';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { AuthProvider } from './src/contexts/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';

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
};

function AppContent() {
  const { isDark } = useTheme();
  
  return (
    <NavigationContainer theme={isDark ? DarkTheme : DefaultTheme} linking={linking}>
      <RootNavigator />
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <DataProvider>
            <AppContent />
          </DataProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
