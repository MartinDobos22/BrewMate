import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from '../screens/HomeScreen';
import CoffeeScannerScreen from '../screens/CoffeeScannerScreen';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

function AppNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'BrewMate',
          headerBackVisible: false,
        }}
      />
      <Stack.Screen
        name="CoffeeScanner"
        component={CoffeeScannerScreen}
        options={{
          title: 'Coffee Scanner',
        }}
      />
    </Stack.Navigator>
  );
}

export default AppNavigator;
