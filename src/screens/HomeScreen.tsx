import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';

import {RootStackParamList} from '../navigation/types';
import BottomNavBar from '../components/BottomNavBar';
import HomeGreetingHeader from '../components/home/HomeGreetingHeader';
import BrewSuggestionCard from '../components/home/BrewSuggestionCard';
import BentoQuickActions from '../components/home/BentoQuickActions';
import CoffeeShelfScroller from '../components/home/CoffeeShelfScroller';
import DailyTipCard from '../components/home/DailyTipCard';
import StatsRow from '../components/home/StatsRow';
import TasteProfileCard from '../components/home/TasteProfileCard';
import RecentActivitySection, {
  RecentActivityEntry,
} from '../components/home/RecentActivitySection';
import { FAB } from '../components/md3';
import { PlusIcon } from '../components/icons';
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
import {useAuth} from '../context/AuthContext';
import {useTheme} from '../theme/useTheme';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

function HomeScreen({navigation}: Props) {
  const {user} = useAuth();
  const {colors, typescale} = useTheme();
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
  const handleRecentScansPress = useCallback(
    () => navigation.navigate('RecentScans'),
    [navigation],
  );
  const handleProfilePress = useCallback(() => navigation.navigate('Profile'), [navigation]);

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

  const matchTierLabel = useMemo(
    () => (matchScore !== null ? MATCH_TIER_LABELS[matchScoreToTier(matchScore)] : null),
    [matchScore],
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
        iconKind: 'bean' as const,
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
        iconKind: 'recipe' as const,
        title: recipe.title || 'Nový recept',
        meta: `${recipe.method} • Predikcia ${recipe.likeScore}%`,
        createdAt: recipe.createdAt,
      }));

    const combined = [...recentInventory, ...recentRecipe].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return combined.slice(0, HOME_RECENT_ACTIVITY_LIMIT).map(({id, iconKind, title, meta}) => ({
      id,
      iconKind,
      title,
      meta,
    }));
  }, [inventoryTotals.active, recipeHighlights]);

  const featuredCoffee = inventoryTotals.active[0] ?? null;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safeArea: {
          flex: 1,
          backgroundColor: colors.background,
        },
        scrollView: {
          flex: 1,
        },
        container: {
          flexGrow: 1,
          backgroundColor: colors.background,
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: BOTTOM_NAV_SAFE_PADDING + 24,
        },
        loadingRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginTop: 8,
        },
        loadingText: {
          ...typescale.bodySmall,
          color: colors.onSurfaceVariant,
        },
        errorBanner: {
          backgroundColor: colors.errorContainer,
          borderRadius: 12,
          padding: 12,
          marginBottom: 12,
        },
        errorText: {
          ...typescale.bodySmall,
          color: colors.onErrorContainer,
        },
        sectionGap: {
          marginTop: 24,
        },
        fab: {
          position: 'absolute',
          right: 24,
          bottom: BOTTOM_NAV_SAFE_PADDING - 4,
        },
      }),
    [colors, typescale],
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
        <HomeGreetingHeader
          userName={user?.name ?? null}
          userEmail={user?.email ?? null}
          onPressAvatar={handleProfilePress}
        />

        {dashboardState === 'error' ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{dashboardError}</Text>
          </View>
        ) : null}

        <BrewSuggestionCard
          highlightedCoffee={featuredCoffee}
          matchScore={matchScore}
          matchTierLabel={matchTierLabel ?? undefined}
          onPress={handlePhotoRecipePress}
        />

        {dashboardState === 'loading' ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Načítavam tvoj dashboard…</Text>
          </View>
        ) : null}

        <View style={styles.sectionGap}>
          <BentoQuickActions
            activeCount={inventoryTotals.active.length}
            recipeCount={recipes.length}
            onPressInventory={handleInventoryPress}
            onPressScan={handleScanPress}
            onPressRecipes={handleSavedRecipesPress}
            onPressGenerate={handlePhotoRecipePress}
            onPressRecentScans={handleRecentScansPress}
          />
        </View>

        <StatsRow
          activeCoffeeCount={inventoryTotals.active.length}
          gramsAvailable={inventoryTotals.gramsAvailable}
          recipeCount={recipes.length}
        />

        <CoffeeShelfScroller
          items={inventoryTotals.active}
          onOpenInventory={handleInventoryPress}
        />

        <DailyTipCard
          body="Skús pomer 1:16 pre čistejší filter a sladší profil šálky."
          ctaLabel="Zobraziť recepty"
          onPressCta={handleSavedRecipesPress}
        />

        <RecentActivitySection entries={recentActivity} />

        <TasteProfileCard
          vector={userVector}
          hasProfile={userProfile !== null}
          matchScore={matchScore}
          matchTierLabel={matchTierLabel}
          onEdit={handleQuestionnairePress}
        />
      </ScrollView>

      <FAB
        icon={<PlusIcon size={26} color={colors.onPrimaryContainer} />}
        onPress={handleScanPress}
        accessibilityLabel="Naskenovať novú kávu"
        style={styles.fab}
      />

      <BottomNavBar />
    </SafeAreaView>
  );
}

export default HomeScreen;
