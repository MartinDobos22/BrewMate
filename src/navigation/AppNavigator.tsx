import React from 'react';
import { StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTheme } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import type { MD3Theme } from 'react-native-paper';

import HomeScreen from '../screens/HomeScreen';
import CoffeeScannerScreen from '../screens/CoffeeScannerScreen';
import CoffeePhotoRecipeScreen from '../screens/CoffeePhotoRecipeScreen';
import CoffeePhotoRecipeResultScreen from '../screens/CoffeePhotoRecipeResultScreen';
import OcrResultScreen from '../screens/OcrResultScreen';
import CoffeeQuestionnaireScreen from '../screens/CoffeeQuestionnaireScreen';
import CoffeeQuestionnaireResultScreen from '../screens/CoffeeQuestionnaireResultScreen';
import CoffeeInventoryScreen from '../screens/CoffeeInventoryScreen';
import CoffeeRecipesSavedScreen from '../screens/CoffeeRecipesSavedScreen';
import CoffeeJournalScreen from '../screens/CoffeeJournalScreen';
import ProfileHomeScreen from '../screens/ProfileHomeScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import AuthLoadingScreen from '../screens/AuthLoadingScreen';

import { useAuth } from '../context/AuthContext';
import type {
  AuthStackParamList,
  BottomTabParamList,
  HomeStackParamList,
  TestStackParamList,
  InventoryStackParamList,
  ProfileStackParamList,
  RecipesStackParamList,
} from './types';
import spacing from '../styles/spacing';

// Stack navigators
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const TestStack = createNativeStackNavigator<TestStackParamList>();
const InventoryStack = createNativeStackNavigator<InventoryStackParamList>();
const RecipesStack = createNativeStackNavigator<RecipesStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();
const AuthStackNav = createNativeStackNavigator<AuthStackParamList>();

// Bottom Tabs
const BottomTab = createBottomTabNavigator<BottomTabParamList>();

function useScreenOptions() {
  const theme = useTheme<MD3Theme>();

  return {
    headerStyle: {
      backgroundColor: theme.colors.background,
      elevation: 0,
      shadowOpacity: 0,
    },
    headerTintColor: theme.colors.onSurface,
    headerTitleStyle: {
      fontSize: 22,
      fontWeight: '400' as const,
      color: theme.colors.onSurface,
    },
    headerShadowVisible: false,
    contentStyle: { backgroundColor: theme.colors.background },
  };
}

function HomeNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <HomeStack.Navigator screenOptions={screenOptions}>
      <HomeStack.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: 'BrewMate', headerShown: false }}
      />
      <HomeStack.Screen
        name="CoffeeScanner"
        component={CoffeeScannerScreen}
        options={{ title: 'Coffee Scanner' }}
      />
      <HomeStack.Screen
        name="CoffeePhotoRecipe"
        component={CoffeePhotoRecipeScreen}
        options={{ title: 'Foto recept' }}
      />
      <HomeStack.Screen
        name="CoffeePhotoRecipeResult"
        component={CoffeePhotoRecipeResultScreen}
        options={{ title: 'Barista recept' }}
      />
      <HomeStack.Screen
        name="OcrResult"
        component={OcrResultScreen}
        options={{ title: 'Výsledok skenu' }}
      />
    </HomeStack.Navigator>
  );
}

function TestNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <TestStack.Navigator screenOptions={screenOptions}>
      <TestStack.Screen
        name="CoffeeQuestionnaire"
        component={CoffeeQuestionnaireScreen}
        options={{ title: 'Chuťový test' }}
      />
      <TestStack.Screen
        name="CoffeeQuestionnaireResult"
        component={CoffeeQuestionnaireResultScreen}
        options={{ title: 'Výsledok testu' }}
      />
    </TestStack.Navigator>
  );
}

function InventoryNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <InventoryStack.Navigator screenOptions={screenOptions}>
      <InventoryStack.Screen
        name="CoffeeInventory"
        component={CoffeeInventoryScreen}
        options={{ title: 'Zásobník' }}
      />
    </InventoryStack.Navigator>
  );
}

function RecipesNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <RecipesStack.Navigator screenOptions={screenOptions}>
      <RecipesStack.Screen
        name="CoffeeRecipesSaved"
        component={CoffeeRecipesSavedScreen}
        options={{ title: 'Recepty' }}
      />
    </RecipesStack.Navigator>
  );
}

function ProfileNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <ProfileStack.Navigator screenOptions={screenOptions}>
      <ProfileStack.Screen
        name="ProfileHome"
        component={ProfileHomeScreen}
        options={{ title: 'Profil' }}
      />
      <ProfileStack.Screen
        name="CoffeeQuestionnaire"
        component={CoffeeQuestionnaireScreen}
        options={{ title: 'Chuťový dotazník' }}
      />
      <ProfileStack.Screen
        name="CoffeeQuestionnaireResult"
        component={CoffeeQuestionnaireResultScreen}
        options={{ title: 'Výsledok dotazníka' }}
      />
      <ProfileStack.Screen
        name="CoffeeJournal"
        component={CoffeeJournalScreen}
        options={{ title: 'Denník' }}
      />
    </ProfileStack.Navigator>
  );
}

function MainNavigator() {
  const theme = useTheme<MD3Theme>();

  return (
    <BottomTab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'rgba(255,248,245,0.94)',
          borderTopColor: theme.colors.outlineVariant,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 80,
          paddingBottom: spacing.sm,
          paddingTop: 10,
          elevation: 0,
        },
        tabBarActiveTintColor: theme.colors.onSurface,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
          marginTop: 4,
          letterSpacing: 0.3,
        },
        tabBarItemStyle: {
          gap: 4,
        },
      }}
    >
      <BottomTab.Screen
        name="HomeTab"
        component={HomeNavigator}
        options={{
          tabBarLabel: 'Prehľad',
          tabBarIcon: ({ color, size }) => (
            <Icon name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <BottomTab.Screen
        name="TestTab"
        component={TestNavigator}
        options={{
          tabBarLabel: 'Test',
          tabBarIcon: ({ color, size }) => (
            <Icon name="star-outline" size={size} color={color} />
          ),
        }}
      />
      <BottomTab.Screen
        name="InventoryTab"
        component={InventoryNavigator}
        options={{
          tabBarLabel: 'Zásobník',
          tabBarIcon: ({ color, size }) => (
            <Icon name="package-variant" size={size} color={color} />
          ),
        }}
      />
      <BottomTab.Screen
        name="RecipesTab"
        component={RecipesNavigator}
        options={{
          tabBarLabel: 'Recepty',
          tabBarIcon: ({ color, size }) => (
            <Icon name="file-document-outline" size={size} color={color} />
          ),
        }}
      />
      <BottomTab.Screen
        name="ProfileTab"
        component={ProfileNavigator}
        options={{
          tabBarLabel: 'Profil',
          tabBarIcon: ({ color, size }) => (
            <Icon name="account-outline" size={size} color={color} />
          ),
        }}
      />
    </BottomTab.Navigator>
  );
}

function AuthNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <AuthStackNav.Navigator screenOptions={screenOptions}>
      <AuthStackNav.Screen
        name="Login"
        component={LoginScreen}
        options={{ headerShown: false }}
      />
      <AuthStackNav.Screen
        name="Register"
        component={RegisterScreen}
        options={{ headerShown: false }}
      />
    </AuthStackNav.Navigator>
  );
}

function AppNavigator() {
  const { user, initializing } = useAuth();

  if (initializing) {
    return <AuthLoadingScreen />;
  }

  return user ? <MainNavigator /> : <AuthNavigator />;
}

export default AppNavigator;
