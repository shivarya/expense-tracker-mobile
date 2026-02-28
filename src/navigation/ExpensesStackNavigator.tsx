import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ExpensesScreen from '../screens/ExpensesScreen';
import TransactionsScreen from '../screens/TransactionsScreen';
import CategoriesSpendScreen from '../screens/CategoriesSpendScreen';

export type ExpensesStackParamList = {
  ExpensesOverview: undefined;
  Transactions: {
    categoryId?: number;
    categoryName?: string;
    headerTitle?: string;
    startDate?: string;
    endDate?: string;
  } | undefined;
  CategoriesSpend: {
    period?: '1m' | '3m' | '6m' | '1y';
  } | undefined;
};

const Stack = createNativeStackNavigator<ExpensesStackParamList>();

const ExpensesStackNavigator = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="ExpensesOverview"
        component={ExpensesScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Transactions"
        component={TransactionsScreen}
        options={({ route }) => ({ title: route.params?.headerTitle ?? 'Transactions' })}
      />
      <Stack.Screen
        name="CategoriesSpend"
        component={CategoriesSpendScreen}
        options={{ title: 'All Categories' }}
      />
    </Stack.Navigator>
  );
};

export default ExpensesStackNavigator;
