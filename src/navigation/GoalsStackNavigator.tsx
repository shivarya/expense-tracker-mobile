import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import GoalsScreen from '../screens/GoalsScreen';
import AddGoalScreen from '../screens/AddGoalScreen';

export type GoalsStackParamList = {
  GoalsOverview: undefined;
  AddGoal: { goalId?: number; mode?: 'contribution' } | undefined;
};

const Stack = createNativeStackNavigator<GoalsStackParamList>();

const GoalsStackNavigator = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="GoalsOverview"
        component={GoalsScreen}
        options={{ title: 'Goals' }}
      />
      <Stack.Screen
        name="AddGoal"
        component={AddGoalScreen}
        options={({ route }) => ({
          title: route.params?.mode === 'contribution'
            ? 'Log Contribution'
            : route.params?.goalId
            ? 'Edit Goal'
            : 'Add Goal',
        })}
      />
    </Stack.Navigator>
  );
};

export default GoalsStackNavigator;
