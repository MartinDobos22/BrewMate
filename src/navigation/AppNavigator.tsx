import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import AuthLoadingScreen from '../screens/AuthLoadingScreen';
import { AuthStackParamList } from './types';
import { useAuth } from '../context/AuthContext';
import { appTheme } from '../theme/theme';
import MainTabNavigator from './MainTabNavigator';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: appTheme.colors.surface },
        headerTintColor: appTheme.colors.primary,
        headerTitleStyle: { ...appTheme.typography.title, color: appTheme.colors.text },
        contentStyle: { backgroundColor: appTheme.colors.background },
      }}
    >
      <AuthStack.Screen
        name="Login"
        component={LoginScreen}
        options={{ headerShown: false }}
      />
      <AuthStack.Screen
        name="Register"
        component={RegisterScreen}
        options={{ headerShown: false }}
      />
    </AuthStack.Navigator>
  );
}

function AppNavigator() {
  const { user, initializing } = useAuth();

  if (initializing) {
    return <AuthLoadingScreen />;
  }

  return user ? <MainTabNavigator /> : <AuthNavigator />;
}

export default AppNavigator;
