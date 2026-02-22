import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

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
import {
  HomeStackParamList,
  InventoryStackParamList,
  MainTabParamList,
  ProfileStackParamList,
  QuizStackParamList,
  RecipesStackParamList,
} from './types';
import { appTheme } from '../theme/theme';

const Tab = createBottomTabNavigator<MainTabParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const QuizStack = createNativeStackNavigator<QuizStackParamList>();
const InventoryStack = createNativeStackNavigator<InventoryStackParamList>();
const RecipesStack = createNativeStackNavigator<RecipesStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

const stackScreenOptions = {
  headerStyle: { backgroundColor: appTheme.colors.surface },
  headerTintColor: appTheme.colors.primary,
  headerTitleStyle: { ...appTheme.typography.title, color: appTheme.colors.text },
  contentStyle: { backgroundColor: appTheme.colors.background },
};

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={stackScreenOptions}>
      <HomeStack.Screen name="Home" component={HomeScreen} options={{ title: 'BrewMate' }} />
      <HomeStack.Screen name="CoffeeScanner" component={CoffeeScannerScreen} options={{ title: 'Coffee Scanner' }} />
      <HomeStack.Screen name="CoffeePhotoRecipe" component={CoffeePhotoRecipeScreen} options={{ title: 'Coffee Recipe Generator' }} />
      <HomeStack.Screen name="CoffeePhotoRecipeResult" component={CoffeePhotoRecipeResultScreen} options={{ title: 'Barista recept' }} />
      <HomeStack.Screen name="OcrResult" component={OcrResultScreen} options={{ title: 'OCR Result' }} />
    </HomeStack.Navigator>
  );
}

function QuizStackNavigator() {
  return (
    <QuizStack.Navigator screenOptions={stackScreenOptions}>
      <QuizStack.Screen name="CoffeeQuestionnaire" component={CoffeeQuestionnaireScreen} options={{ title: 'Chuťový dotazník' }} />
      <QuizStack.Screen name="CoffeeQuestionnaireResult" component={CoffeeQuestionnaireResultScreen} options={{ title: 'Výsledok dotazníka' }} />
    </QuizStack.Navigator>
  );
}

function InventoryStackNavigator() {
  return (
    <InventoryStack.Navigator screenOptions={stackScreenOptions}>
      <InventoryStack.Screen name="CoffeeInventory" component={CoffeeInventoryScreen} options={{ title: 'Coffee inventár' }} />
    </InventoryStack.Navigator>
  );
}

function RecipesStackNavigator() {
  return (
    <RecipesStack.Navigator screenOptions={stackScreenOptions}>
      <RecipesStack.Screen name="CoffeeRecipesSaved" component={CoffeeRecipesSavedScreen} options={{ title: 'Coffee Recipes Saved' }} />
    </RecipesStack.Navigator>
  );
}

function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={stackScreenOptions}>
      <ProfileStack.Screen name="Profile" component={CoffeeJournalScreen} options={{ title: 'Profil' }} />
    </ProfileStack.Navigator>
  );
}


function TabIcon({ icon, color }: { icon: string; color: string }) {
  return <Text style={[styles.tabIcon, { color }]}>{icon}</Text>;
}

const TAB_META: Record<keyof MainTabParamList, { label: string; icon: string }> = {
  HomeTab: { label: 'Prehľad', icon: '☕' },
  QuizTab: { label: 'Test', icon: '🧪' },
  InventoryTab: { label: 'Zásobník', icon: '📦' },
  RecipesTab: { label: 'Recepty', icon: '📖' },
  ProfileTab: { label: 'Profil', icon: '👤' },
};

function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: appTheme.colors.primary,
        tabBarInactiveTintColor: appTheme.colors.mutedText,
        tabBarStyle: { backgroundColor: appTheme.colors.surface },
        tabBarLabel: TAB_META[route.name as keyof MainTabParamList].label,
        tabBarIcon: ({ color }) => (
          <TabIcon
            color={color}
            icon={TAB_META[route.name as keyof MainTabParamList].icon}
          />
        ),
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeStackNavigator} />
      <Tab.Screen name="QuizTab" component={QuizStackNavigator} />
      <Tab.Screen name="InventoryTab" component={InventoryStackNavigator} />
      <Tab.Screen name="RecipesTab" component={RecipesStackNavigator} />
      <Tab.Screen name="ProfileTab" component={ProfileStackNavigator} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabIcon: {
    fontSize: 16,
  },
});

export default MainTabNavigator;
