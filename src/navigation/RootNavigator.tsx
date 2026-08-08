import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { usePermissionsGate } from '../hooks/usePermissionsGate';

const Stack = createStackNavigator();

const RootNavigator = () => {
  const { user, loading } = useAuth();
  const { allGranted, isChecking } = usePermissionsGate();

  if (loading || (user && isChecking)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        <Stack.Screen name="Login" component={require('../screens/LoginScreen').default} />
      ) : !allGranted ? (
        <Stack.Screen name="PermissionsGate" component={require('../screens/PermissionsGateScreen').default} />
      ) : (
        <Stack.Screen name="Main" component={require('./AppNavigator').default} />
      )}
    </Stack.Navigator>
  );
};

export default RootNavigator;
