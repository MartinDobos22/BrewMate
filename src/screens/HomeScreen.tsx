import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';

import {RootStackParamList} from '../navigation/types';
import TasteProfileBars from '../components/TasteProfileBars';
import BottomNavBar from '../components/BottomNavBar';
import QuickActionsGrid, {QuickAction} from '../components/home/QuickActionsGrid';
import InventorySummarySection from '../components/home/InventorySummarySection';
import RecentActivitySection, {
  RecentActivityEntry,
} from '../components/home/RecentActivitySection';
import {
  calculateMatchScore,
  DEFAULT_TASTE_VECTOR,
  matchScoreToTier,
  MATCH_TIER_LABELS,
  normalizeTasteVector,
} from '../utils/tasteVector';
import {
  HOME_RECENT_ACTIVITY_LIMIT,
  HOME_RECENT_INVENTORY_LIMIT,
  HOME_RECENT_RECIPE_LIMIT,
} from '../constants/business';
import {BOTTOM_NAV_SAFE_PADDING} from '../constants/ui';
import {
  CoffeeProfilePayload,
  loadLatestCoffeeProfile,
  loadLatestQuestionnaireResult,
  QuestionnaireResultPayload,
} from '../utils/localSave';
import {useHomeDashboard} from '../hooks/useHomeDashboard';
import {useLogout} from '../hooks/useLogout';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

function IconBadge({icon}: {icon: string}) {
  return (
    <View style={styles.iconBadge}>
      <Text style={styles.iconEmoji}>{icon}</Text>
    </View>
  );
}

function HomeScreen({navigation}: Props) {
  const {logout, isLoggingOut} = useLogout();
  const {
    state: dashboardState,
    error: dashboardError,
    recipes,
    inventoryTotals,
    reload: reloadDashboard,
  } = useHomeDashboard();

  const [userProfile, setUserProfile] = useState<QuestionnaireResultPayload['profile'] | null>(
    null,
  );
  const [coffeeProfile, setCoffeeProfile] = useState<CoffeeProfilePayload['coffeeProfile'] | null>(
    null,
  );

  const loadSavedProfiles = useCallback(async () => {
    const [latestQuestionnaire, latestCoffee] = await Promise.all([
      loadLatestQuestionnaireResult(),
      loadLatestCoffeeProfile(),
    ]);

    setUserProfile(latestQuestionnaire?.payload?.profile ?? null);
    setCoffeeProfile(latestCoffee?.payload?.coffeeProfile ?? null);
  }, []);

  useEffect(() => {
    loadSavedProfiles();
    return navigation.addListener('focus', loadSavedProfiles);
  }, [loadSavedProfiles, navigation]);

  // Refresh dashboard data whenever the screen regains focus.
  useEffect(() => navigation.addListener('focus', reloadDashboard), [navigation, reloadDashboard]);

  const handleScanPress = useCallback(() => navigation.navigate('CoffeeScanner'), [navigation]);
  const handleQuestionnairePress = useCallback(
    () => navigation.navigate('CoffeeQuestionnaire'),
    [navigation],
  );
  const handlePhotoRecipePress = useCallback(
    () => navigation.navigate('CoffeePhotoRecipe'),
    [navigation],
  );
  const handleInventoryPress = useCallback(
    () => navigation.navigate('CoffeeInventory'),
    [navigation],
  );
  const handleSavedRecipesPress = useCallback(
    () => navigation.navigate('CoffeeRecipesSaved'),
    [navigation],
  );

  const userVector = useMemo(
    () => normalizeTasteVector(userProfile?.tasteVector ?? DEFAULT_TASTE_VECTOR),
    [userProfile],
  );

  const matchScore = useMemo(
    () =>
      calculateMatchScore(
        userProfile?.tasteVector,
        coffeeProfile?.tasteVector,
        userProfile?.toleranceVector,
      ),
    [coffeeProfile?.tasteVector, userProfile?.tasteVector, userProfile?.toleranceVector],
  );

  const recipeHighlights = useMemo(() => {
    const sorted = [...recipes].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return sorted.slice(0, HOME_RECENT_ACTIVITY_LIMIT);
  }, [recipes]);

  const recentActivity = useMemo<RecentActivityEntry[]>(() => {
    type Sortable = RecentActivityEntry & {createdAt: string};

    const recentInventory: Sortable[] = inventoryTotals.active
      .slice(0, HOME_RECENT_INVENTORY_LIMIT)
      .map(item => ({
        id: `inventory-${item.id}`,
        icon: '🫘',
        title: item.correctedText || item.rawText || 'Pridaná káva',
        meta:
          typeof item.remainingG === 'number'
            ? `Inventár • ${item.remainingG} g zostáva`
            : 'Inventár • aktualizované',
        createdAt: item.createdAt,
      }));

    const recentRecipe: Sortable[] = recipeHighlights
      .slice(0, HOME_RECENT_RECIPE_LIMIT)
      .map(recipe => ({
        id: `recipe-${recipe.id}`,
        icon: '📘',
        title: recipe.title || 'Nový recept',
        meta: `${recipe.method} • Predikcia ${recipe.likeScore}%`,
        createdAt: recipe.createdAt,
      }));

    const combined = [...recentInventory, ...recentRecipe].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return combined.slice(0, HOME_RECENT_ACTIVITY_LIMIT).map(({id, icon, title, meta}) => ({
      id,
      icon,
      title,
      meta,
    }));
  }, [inventoryTotals.active, recipeHighlights]);

  const quickActions = useMemo<QuickAction[]>(
    () => [
      {key: 'inventory', label: 'Môj inventár kávy', icon: '🫘', onPress: handleInventoryPress},
      {key: 'brew', label: 'Skenovať kávu', icon: '📷', onPress: handleScanPress},
      {key: 'recipes', label: 'Obľúbené recepty', icon: '☕', onPress: handleSavedRecipesPress},
      {key: 'log', label: 'Generovať recept', icon: '✨', onPress: handlePhotoRecipePress},
    ],
    [handleInventoryPress, handleScanPress, handleSavedRecipesPress, handlePhotoRecipePress],
  );

  const lowStockItem = inventoryTotals.lowStock[0];

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
        <View style={styles.heroCard}>
          <View style={styles.heroDecorTop}>
            <Text style={styles.heroDecorLeaf}>🍃</Text>
            <Text style={styles.heroDecorCherry}>🍒</Text>
          </View>
          <Text style={styles.overline}>BrewMate Home</Text>
          <Text style={styles.title}>Vitaj v BrewMate</Text>
          <Text style={styles.heroSubtitle}>Tvoja káva, zásoby a recepty na jednom mieste.</Text>

          <View style={styles.heroBadgeRow}>
            <IconBadge icon="☕" />
            <IconBadge icon="🫘" />
            <IconBadge icon="🍃" />
            <IconBadge icon="🍒" />
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Rýchle akcie</Text>
            {dashboardState === 'loading' ? <ActivityIndicator color="#5B4332" /> : null}
          </View>
          {dashboardState === 'error' ? (
            <Text style={styles.errorText}>{dashboardError}</Text>
          ) : null}
          <QuickActionsGrid actions={quickActions} />
        </View>

        <InventorySummarySection
          activeItems={inventoryTotals.active}
          emptyCount={inventoryTotals.empty.length}
          gramsAvailable={inventoryTotals.gramsAvailable}
          lowStockItem={lowStockItem}
          onOpenInventory={handleInventoryPress}
        />

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Dnešný tip</Text>
            <Text style={styles.tipTag}>🍃 Specialty</Text>
          </View>
          <Text style={styles.tipText}>
            Skús pomer 1:16 pre čistejší filter a sladší profil šálky.
          </Text>
          <Pressable style={styles.inlineAction} onPress={handleSavedRecipesPress}>
            <Text style={styles.inlineActionText}>Zobraziť recepty</Text>
          </Pressable>
        </View>

        <RecentActivitySection entries={recentActivity} />

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Tvoj chuťový profil</Text>
            <Pressable onPress={handleQuestionnairePress}>
              <Text style={styles.textButton}>Upraviť</Text>
            </Pressable>
          </View>

          {!userProfile ? (
            <Text style={styles.placeholder}>
              Vyplň dotazník a získaš personalizované párovanie kávy aj receptov.
            </Text>
          ) : null}
          <TasteProfileBars vector={userVector} />
          {matchScore !== null ? (
            <Text style={styles.matchScore}>
              Zhoda profilu: {matchScore}% — {MATCH_TIER_LABELS[matchScoreToTier(matchScore)]}
            </Text>
          ) : null}
        </View>

        <Pressable
          style={({pressed}) => [
            styles.outlineAction,
            (pressed || isLoggingOut) && styles.outlineActionPressed,
          ]}
          onPress={logout}
          disabled={isLoggingOut}>
          <Text style={styles.outlineActionText}>
            {isLoggingOut ? 'Odhlasujem…' : 'Odhlásiť sa'}
          </Text>
        </Pressable>
      </ScrollView>

      <BottomNavBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F6F1EB',
  },
  scrollView: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    backgroundColor: '#F6F1EB',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: BOTTOM_NAV_SAFE_PADDING,
  },
  heroCard: {
    borderRadius: 30,
    padding: 20,
    marginBottom: 16,
    backgroundColor: '#EEDFCF',
    borderWidth: 1,
    borderColor: '#D7C2AB',
    overflow: 'hidden',
  },
  heroDecorTop: {
    position: 'absolute',
    right: 12,
    top: 8,
    flexDirection: 'row',
    gap: 6,
  },
  heroDecorLeaf: {
    fontSize: 18,
    opacity: 0.8,
  },
  heroDecorCherry: {
    fontSize: 18,
    opacity: 0.85,
  },
  overline: {
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#6D5D4C',
    marginBottom: 8,
    fontWeight: '700',
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    color: '#23180E',
    fontWeight: '700',
  },
  heroSubtitle: {
    marginTop: 8,
    color: '#4C4137',
    fontSize: 15,
    lineHeight: 22,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 10,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFFAA',
    borderColor: '#D5BDA9',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: {
    fontSize: 18,
  },
  sectionCard: {
    borderRadius: 24,
    padding: 16,
    marginBottom: 14,
    backgroundColor: '#FFFBFF',
    borderWidth: 1,
    borderColor: '#E7DCD1',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 19,
    color: '#2C1F13',
    fontWeight: '700',
  },
  textButton: {
    color: '#71533D',
    fontWeight: '700',
    fontSize: 13,
  },
  errorText: {
    color: '#BA1A1A',
    marginBottom: 8,
  },
  placeholder: {
    color: '#6A5B50',
    fontSize: 14,
    lineHeight: 20,
  },
  tipTag: {
    color: '#416B43',
    backgroundColor: '#EAF6EA',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: 'hidden',
    fontSize: 11,
    fontWeight: '700',
  },
  tipText: {
    color: '#4F4439',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  inlineAction: {
    alignSelf: 'flex-start',
    borderRadius: 16,
    backgroundColor: '#2C2218',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  inlineActionText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  matchScore: {
    marginTop: 12,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#E6F3E7',
    color: '#214D28',
    fontWeight: '700',
  },
  outlineAction: {
    marginTop: 2,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#70523D',
    paddingVertical: 13,
    alignItems: 'center',
  },
  outlineActionPressed: {
    opacity: 0.7,
  },
  outlineActionText: {
    color: '#70523D',
    fontWeight: '600',
    fontSize: 15,
  },
});

export default HomeScreen;
