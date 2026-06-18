import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MoreScreen from '../screens/MoreScreen';
import TrustedContactsScreen from '../screens/TrustedContactsScreen';
import MasterCategoriesScreen from '../screens/MasterCategoriesScreen';
import GroupsScreen from '../screens/GroupsScreen';
import ManualGroupsScreen from '../screens/ManualGroupsScreen';
import StatementSyncScreen from '../screens/StatementSyncScreen';
import GmailSyncScreen from '../screens/GmailSyncScreen';
import PaywallScreen from '../screens/PaywallScreen';
import AddInvestmentScreen from '../screens/AddInvestmentScreen';

export type MoreStackParamList = {
  MoreHome: undefined;
  TrustedContacts: undefined;
  Categories: undefined;
  Groups: undefined;
  ManualGroups: undefined;
  StatementSync: undefined;
  GmailSync: undefined;
  Paywall: undefined;
  AddInvestment: undefined;
};

const Stack = createNativeStackNavigator<MoreStackParamList>();

const MoreStackNavigator = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="MoreHome"
        component={MoreScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="TrustedContacts"
        component={TrustedContactsScreen}
        options={{ title: 'Trusted Contacts' }}
      />
      <Stack.Screen
        name="Categories"
        component={MasterCategoriesScreen}
        options={{ title: 'Master Categories' }}
      />
      <Stack.Screen
        name="Groups"
        component={GroupsScreen}
        options={{ title: 'Transaction Groups' }}
      />
      <Stack.Screen
        name="ManualGroups"
        component={ManualGroupsScreen}
        options={{ title: 'Manual Groups' }}
      />
      <Stack.Screen
        name="StatementSync"
        component={StatementSyncScreen}
        options={{ title: 'Statement Sync' }}
      />
      <Stack.Screen
        name="GmailSync"
        component={GmailSyncScreen}
        options={{ title: 'Gmail Auto-Sync' }}
      />
      <Stack.Screen
        name="Paywall"
        component={PaywallScreen}
        options={{ title: 'Premium' }}
      />
      <Stack.Screen
        name="AddInvestment"
        component={AddInvestmentScreen}
        options={{ title: 'Add FD / PF / NPS' }}
      />
    </Stack.Navigator>
  );
};

export default MoreStackNavigator;
