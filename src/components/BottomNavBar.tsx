import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/types';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

type TabKey = 'home' | 'inventory' | 'recipes' | 'profile';

const TABS: Array<{
  key: TabKey;
  label: string;
  icon: string;
  route: keyof RootStackParamList;
}> = [
  {key: 'home', label: 'Home', icon: '\u{1F3E0}', route: 'Home'},
  {key: 'inventory', label: 'Invent\u00E1r', icon: '\u{1F9FA}', route: 'CoffeeInventory'},
  {key: 'recipes', label: 'Recepty', icon: '\u{1F4DA}', route: 'CoffeeRecipesSaved'},
  {key: 'profile', label: 'Profil', icon: '\u{1F464}', route: 'Profile'},
];

const ROUTE_TO_TAB: Record<string, TabKey> = {
  Home: 'home',
  CoffeeInventory: 'inventory',
  CoffeeRecipesSaved: 'recipes',
  Profile: 'profile',
  CoffeeQuestionnaire: 'profile',
  CoffeeQuestionnaireResult: 'profile',
};

function BottomNavBar() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute();
  const activeTab = ROUTE_TO_TAB[route.name] ?? null;

  return (
    <View style={styles.bottomNav}>
      {TABS.map(tab => {
        const isActive = tab.key === activeTab;
        return (
          <Pressable
            key={tab.key}
            style={[styles.navItem, isActive && styles.navItemActive]}
            onPress={() => {
              if (!isActive) {
                navigation.navigate(tab.route as never);
              }
            }}>
            <Text style={styles.navIcon}>{tab.icon}</Text>
            <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNav: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E3D5C8',
    backgroundColor: '#FFFCF9',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: 8,
  },
  navItemActive: {
    backgroundColor: '#F1E6DB',
  },
  navIcon: {
    fontSize: 17,
  },
  navLabel: {
    marginTop: 4,
    fontSize: 11,
    color: '#6C5B4D',
    fontWeight: '600',
  },
  navLabelActive: {
    color: '#4B3325',
  },
});

export default BottomNavBar;
