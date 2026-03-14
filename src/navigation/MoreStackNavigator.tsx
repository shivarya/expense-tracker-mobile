import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MoreScreen from '../screens/MoreScreen';
import TrustedContactsScreen from '../screens/TrustedContactsScreen';
import MasterCategoriesScreen from '../screens/MasterCategoriesScreen';
import GroupsScreen from '../screens/GroupsScreen';

export type MoreStackParamList = {
  MoreHome: undefined;
  TrustedContacts: undefined;
  Categories: undefined;
  Groups: undefined;
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
    </Stack.Navigator>
  );
};

export default MoreStackNavigator;
