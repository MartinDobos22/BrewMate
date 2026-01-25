import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from '../screens/HomeScreen';
import CoffeeScannerScreen from '../screens/CoffeeScannerScreen';
import CoffeePhotoRecipeScreen from '../screens/CoffeePhotoRecipeScreen';
import CoffeePhotoRecipeResultScreen from '../screens/CoffeePhotoRecipeResultScreen';
import OcrResultScreen from '../screens/OcrResultScreen';
import CoffeeQuestionnaireScreen from '../screens/CoffeeQuestionnaireScreen';
import CoffeeQuestionnaireResultScreen from '../screens/CoffeeQuestionnaireResultScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import AuthLoadingScreen from '../screens/AuthLoadingScreen';
import { AuthStackParamList, RootStackParamList } from './types';
import { useAuth } from '../context/AuthContext';

const AppStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator>
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

function MainNavigator() {
  return (
    <AppStack.Navigator>
      <AppStack.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'BrewMate',
          headerBackVisible: false,
        }}
      />
      <AppStack.Screen
        name="CoffeeScanner"
        component={CoffeeScannerScreen}
        options={{
          title: 'Coffee Scanner',
        }}
      />
      <AppStack.Screen
        name="CoffeePhotoRecipe"
        component={CoffeePhotoRecipeScreen}
        options={{
          title: 'Foto recept',
        }}
      />
      <AppStack.Screen
        name="CoffeePhotoRecipeResult"
        component={CoffeePhotoRecipeResultScreen}
        options={{
          title: 'Barista recept',
        }}
      />
      <AppStack.Screen
        name="CoffeeQuestionnaire"
        component={CoffeeQuestionnaireScreen}
        options={{
          title: 'Chuťový dotazník',
        }}
      />
      <AppStack.Screen
        name="CoffeeQuestionnaireResult"
        component={CoffeeQuestionnaireResultScreen}
        options={{
          title: 'Výsledok dotazníka',
        }}
      />
      <AppStack.Screen
        name="OcrResult"
        component={OcrResultScreen}
        options={{
          title: 'OCR Result',
        }}
      />
    </AppStack.Navigator>
  );
}

function AppNavigator() {
  const { user, initializing } = useAuth();

  if (initializing) {
    return <AuthLoadingScreen />;
  }

  return (
    user ? <MainNavigator /> : <AuthNavigator />
  );
}

export default AppNavigator;
