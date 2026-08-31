import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ExpensesScreen from '../screens/ExpensesScreen';
import TransactionsScreen from '../screens/TransactionsScreen';
import CategoriesSpendScreen from '../screens/CategoriesSpendScreen';
import MasterCategoriesScreen from '../screens/MasterCategoriesScreen';

export type ExpensesStackParamList = {
  ExpensesOverview: undefined;
  Transactions: {
    categoryId?: number;
    categoryIds?: number[];
    categoryName?: string;
    categoryFilterLabel?: string;
    groupId?: number;
    manualGroupId?: number;
    groupName?: string;
    type?: 'debit' | 'credit';
    headerTitle?: string;
    startDate?: string;
    endDate?: string;
    initialMonthKey?: 'current';
    respectCapExclusions?: boolean;
  } | undefined;
  CategoriesSpend: {
    period?: 'cm' | '1m' | '3m' | '6m' | '1y';
    groupId?: number;
  } | undefined;
  MasterCategories: undefined;
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
      <Stack.Screen
        name="MasterCategories"
        component={MasterCategoriesScreen}
        options={{ title: 'Master Categories' }}
      />
    </Stack.Navigator>
  );
};

export default ExpensesStackNavigator;
