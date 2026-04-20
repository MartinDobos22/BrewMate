import React, {ReactNode, useMemo} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {RootStackParamList} from '../navigation/types';
import {useTheme} from '../theme/useTheme';
import {elevation} from '../theme/theme';
import { HomeIcon, CoffeeBeanIcon, CoffeeCupIcon, ProfileIcon } from './icons';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

type TabKey = 'home' | 'inventory' | 'recipes' | 'profile';

type Tab = {
  key: TabKey;
  label: string;
  route: keyof RootStackParamList;
};

const TABS: Tab[] = [
  {key: 'home', label: 'Domov', route: 'Home'},
  {key: 'inventory', label: 'Inventár', route: 'CoffeeInventory'},
  {key: 'recipes', label: 'Recepty', route: 'CoffeeRecipesSaved'},
  {key: 'profile', label: 'Profil', route: 'Profile'},
];

const ROUTE_TO_TAB: Record<string, TabKey> = {
  Home: 'home',
  CoffeeInventory: 'inventory',
  CoffeeRecipesSaved: 'recipes',
  Profile: 'profile',
  CoffeeQuestionnaire: 'profile',
  CoffeeQuestionnaireResult: 'profile',
};

type BottomNavBarProps = {
  onBeforeNavigate?: (
    target: keyof RootStackParamList,
  ) => boolean | Promise<boolean>;
};

function BottomNavBar({onBeforeNavigate}: BottomNavBarProps = {}) {
  const navigation = useNavigation<NavProp>();
  const route = useRoute();
  const activeTab = ROUTE_TO_TAB[route.name] ?? null;
  const {colors, typescale, shape} = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        bottomNav: {
          position: 'absolute',
          left: 14,
          right: 14,
          bottom: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderRadius: shape.extraLarge,
          backgroundColor: colors.surfaceContainer,
          paddingHorizontal: 8,
          paddingVertical: 8,
          ...elevation.level2.shadow,
        },
        navItem: {
          flex: 1,
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 6,
          borderRadius: shape.full,
          paddingVertical: 10,
          paddingHorizontal: 6,
        },
        navItemActive: {
          backgroundColor: colors.secondaryContainer,
        },
        navLabel: {
          ...typescale.labelSmall,
          color: colors.onSurfaceVariant,
        },
        navLabelActive: {
          color: colors.onSecondaryContainer,
        },
      }),
    [colors, shape.extraLarge, shape.full, typescale],
  );

  const renderIcon = (key: TabKey, isActive: boolean): ReactNode => {
    const color = isActive ? colors.onSecondaryContainer : colors.onSurfaceVariant;
    const props = {size: 20, color, filled: isActive};
    switch (key) {
      case 'home':
        return <HomeIcon {...props} />;
      case 'inventory':
        return <CoffeeBeanIcon {...props} />;
      case 'recipes':
        return <CoffeeCupIcon {...props} />;
      case 'profile':
        return <ProfileIcon {...props} />;
    }
  };

  return (
    <View style={styles.bottomNav}>
      {TABS.map(tab => {
        const isActive = tab.key === activeTab;
        return (
          <Pressable
            key={tab.key}
            style={[styles.navItem, isActive && styles.navItemActive]}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{selected: isActive}}
            onPress={async () => {
              if (isActive) {
                return;
              }
              if (onBeforeNavigate) {
                const canNavigate = await onBeforeNavigate(tab.route);
                if (!canNavigate) {
                  return;
                }
              }
              navigation.navigate(tab.route as never);
            }}>
            {renderIcon(tab.key, isActive)}
            {isActive ? (
              <Text style={[styles.navLabel, styles.navLabelActive]}>{tab.label}</Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export default BottomNavBar;
