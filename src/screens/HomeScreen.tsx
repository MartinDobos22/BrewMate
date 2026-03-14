import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/types';
import {apiFetch, DEFAULT_API_HOST} from '../utils/api';
import {useAuth} from '../context/AuthContext';
import TasteProfileBars from '../components/TasteProfileBars';
import {DEFAULT_TASTE_VECTOR, normalizeTasteVector, TasteVector,} from '../utils/tasteVector';
import {
  CoffeeProfilePayload,
  loadLatestCoffeeProfile,
  loadLatestQuestionnaireResult,
  QuestionnaireResultPayload,
} from '../utils/localSave';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

type InventoryStatus = 'active' | 'empty' | 'archived';

type HomeInventoryItem = {
  id: string;
  rawText: string | null;
  correctedText: string | null;
  coffeeProfile: {
    origin?: string;
    roastLevel?: string;
    flavorNotes?: string[];
  };
  remainingG: number | null;
  status: InventoryStatus;
  openedAt: string | null;
  createdAt: string;
};

type RecipeItem = {
  id: string;
  title: string;
  method: string;
  likeScore: number;
  createdAt: string;
};

function HomeScreen({ navigation }: Props) {
  const { clearSession } = useAuth();
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
  const [inventoryItems, setInventoryItems] = useState<HomeInventoryItem[]>([]);
  const [recipes, setRecipes] = useState<RecipeItem[]>([]);
  const [dashboardState, setDashboardState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [dashboardError, setDashboardError] = useState('');

  const handleScanPress = () => {
    navigation.navigate('CoffeeScanner');
  };

  const handleQuestionnairePress = () => {
    navigation.navigate('CoffeeQuestionnaire');
  };

  const handlePhotoRecipePress = () => {
    navigation.navigate('CoffeePhotoRecipe');
  };

  const handleInventoryPress = () => {
    navigation.navigate('CoffeeInventory');
  };

  const handleSavedRecipesPress = () => {
    navigation.navigate('CoffeeRecipesSaved');
  };

  const handleLogout = async () => {
    try {
      const response = await apiFetch(
        `${DEFAULT_API_HOST}/auth/logout`,
        {
          method: 'POST',
          credentials: 'include',
        },
        {
          feature: 'Auth',
          action: 'logout',
        },
      );

      if (!response.ok) {
        console.warn('[Auth] Logout failed.', response.status);
        return;
      }

      await clearSession();
    } catch (error) {
      console.warn('[Auth] Logout failed.', error);
    }
  };

  useEffect(() => {
    loadSavedProfiles();
    return navigation.addListener('focus', loadSavedProfiles);
  }, [loadSavedProfiles, navigation]);

  const loadDashboardData = useCallback(async () => {
    setDashboardState('loading');
    setDashboardError('');

    try {
      const [inventoryResponse, recipesResponse] = await Promise.all([
        apiFetch(
          `${DEFAULT_API_HOST}/api/user-coffee?includeInactive=true`,
          { method: 'GET', credentials: 'include' },
          {
            feature: 'HomeDashboard',
            action: 'load-inventory',
          },
        ),
        apiFetch(
          `${DEFAULT_API_HOST}/api/coffee-recipes?days=90`,
          { method: 'GET', credentials: 'include' },
          {
            feature: 'HomeDashboard',
            action: 'load-recipes',
          },
        ),
      ]);

      const inventoryPayload = await inventoryResponse.json().catch(() => null);
      const recipesPayload = await recipesResponse.json().catch(() => null);

      if (!inventoryResponse.ok) {
        throw new Error(inventoryPayload?.error || 'Nepodarilo sa načítať inventár pre home page.');
      }

      if (!recipesResponse.ok) {
        throw new Error(recipesPayload?.error || 'Nepodarilo sa načítať recepty pre home page.');
      }

      setInventoryItems(Array.isArray(inventoryPayload?.items) ? inventoryPayload.items : []);
      setRecipes(Array.isArray(recipesPayload?.items) ? recipesPayload.items : []);
      setDashboardState('ready');
    } catch (error) {
      setDashboardState('error');
      setDashboardError(
        error instanceof Error ? error.message : 'Nepodarilo sa načítať dashboard dáta.',
      );
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
    return navigation.addListener('focus', loadDashboardData);
  }, [loadDashboardData, navigation]);

  const userVector = useMemo<TasteVector>(
    () => normalizeTasteVector(userProfile?.tasteVector ?? DEFAULT_TASTE_VECTOR),
    [userProfile],
  );

  const matchScore = useMemo(() => {
    if (!userProfile?.tasteVector || !coffeeProfile?.tasteVector) {
      return null;
    }

    const user = normalizeTasteVector(userProfile.tasteVector);
    const coffee = normalizeTasteVector(coffeeProfile.tasteVector);
    type TasteAxis = Exclude<keyof TasteVector, 'confidence'>;
    const axes: TasteAxis[] = [
      'acidity',
      'sweetness',
      'bitterness',
      'body',
      'fruity',
      'roast',
    ];
    const avgDiff =
      axes.reduce((sum, key) => sum + Math.abs(user[key] - coffee[key]), 0)
      / axes.length;
    return Math.round(100 - avgDiff);
  }, [coffeeProfile?.tasteVector, userProfile?.tasteVector]);

  const inventoryTotals = useMemo(() => {
    const active = inventoryItems.filter((item) => item.status === 'active');
    const empty = inventoryItems.filter((item) => item.status === 'empty');
    const archived = inventoryItems.filter((item) => item.status === 'archived');
    const lowStock = active.filter(
      (item) => typeof item.remainingG === 'number' && item.remainingG > 0 && item.remainingG <= 60,
    );

    const gramsAvailable = active.reduce(
      (sum, item) => sum + (typeof item.remainingG === 'number' ? item.remainingG : 0),
      0,
    );

    return {
      active,
      empty,
      archived,
      lowStock,
      gramsAvailable,
    };
  }, [inventoryItems]);

  const activeCoffeePreview = useMemo(
    () => inventoryTotals.active.slice(0, 4),
    [inventoryTotals.active],
  );

  const recipeHighlights = useMemo(() => {
    const sorted = [...recipes].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return sorted.slice(0, 3);
  }, [recipes]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>BrewMate</Text>
        </View>

        {/* Quick Overview Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rýchly prehľad</Text>
          {dashboardState === 'loading' ? (
            <ActivityIndicator color="#8B7355" style={styles.loader} />
          ) : null}
          {dashboardState === 'error' ? (
            <Text style={styles.errorText}>{dashboardError}</Text>
          ) : null}

          <View style={styles.metricsWrap}>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{inventoryTotals.active.length}</Text>
              <Text style={styles.metricLabel}>Aktívne kávy</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{inventoryTotals.gramsAvailable} g</Text>
              <Text style={styles.metricLabel}>Aktuálne gramy</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{recipes.length}</Text>
              <Text style={styles.metricLabel}>Uložené recepty</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{inventoryTotals.lowStock.length}</Text>
              <Text style={styles.metricLabel}>Takmer minuté</Text>
            </View>
          </View>

          <Text style={styles.summaryText}>
            Inventár: {inventoryTotals.active.length} aktívnych • {inventoryTotals.empty.length} dopitých
            {' '}• {inventoryTotals.archived.length} archivovaných.
          </Text>
        </View>

        {/* Active Coffees Section */}
        <View style={styles.section}>
          <View style={styles.inlineHeader}>
            <Text style={styles.sectionTitle}>Aktuálne kávy</Text>
            <Pressable onPress={handleInventoryPress}>
              <Text style={styles.link}>Celý inventár</Text>
            </Pressable>
          </View>
          {activeCoffeePreview.length === 0 ? (
            <Text style={styles.placeholder}>Zatiaľ nemáš aktívne kávy. Pridaj prvý balík do inventára.</Text>
          ) : (
            activeCoffeePreview.map((item) => {
              const name = item.correctedText || item.rawText || 'Neznáma káva';
              const remaining = item.remainingG === null ? 'Neznáme' : `${item.remainingG} g`;
              return (
                <View key={item.id} style={styles.previewCard}>
                  <Text style={styles.previewTitle}>{name}</Text>
                  <Text style={styles.previewMeta}>Zostáva: {remaining}</Text>
                </View>
              );
            })
          )}
        </View>

        {/* Recipes Section */}
        <View style={styles.section}>
          <View style={styles.inlineHeader}>
            <Text style={styles.sectionTitle}>Recepty na rýchly štart</Text>
            <Pressable onPress={handleSavedRecipesPress}>
              <Text style={styles.link}>Všetky recepty</Text>
            </Pressable>
          </View>
          {recipeHighlights.length === 0 ? (
            <Text style={styles.placeholder}>Zatiaľ nemáš uložené recepty. Vytvor ich cez Foto recept.</Text>
          ) : (
            recipeHighlights.map((recipe) => (
              <View key={recipe.id} style={styles.previewCard}>
                <Text style={styles.previewTitle}>{recipe.title || 'Recipe'}</Text>
                <Text style={styles.previewMeta}>{recipe.method} • Predikcia chuti {recipe.likeScore}%</Text>
              </View>
            ))
          )}
        </View>

        {/* Taste Profile Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tvoj chuťový profil</Text>
          {!userProfile ? (
            <Text style={styles.placeholder}>
              Vyplňte dotazník, aby sme nastavili váš chuťový profil.
            </Text>
          ) : null}
          <TasteProfileBars vector={userVector} />
          {matchScore !== null ? (
            <Text style={styles.matchScore}>Zhoda: {matchScore}%</Text>
          ) : null}
        </View>

        {/* Actions Section */}
        <View style={styles.actionsSection}>
          <Pressable style={styles.buttonPrimary} onPress={handleScanPress}>
            <Text style={styles.buttonPrimaryText}>Scan Coffee</Text>
          </Pressable>

          <View style={styles.secondaryButtonsRow}>
            <Pressable style={[styles.buttonSecondary, styles.buttonSecondaryFlex]} onPress={handlePhotoRecipePress}>
              <Text style={styles.buttonSecondaryText}>Foto recept</Text>
            </Pressable>
            <Pressable style={[styles.buttonSecondary, styles.buttonSecondaryFlex]} onPress={handleQuestionnairePress}>
              <Text style={styles.buttonSecondaryText}>Chuťový dotazník</Text>
            </Pressable>
          </View>

          <View style={styles.secondaryButtonsRow}>
            <Pressable style={[styles.buttonSecondary, styles.buttonSecondaryFlex]} onPress={handleInventoryPress}>
              <Text style={styles.buttonSecondaryText}>Coffee inventár</Text>
            </Pressable>
            <Pressable style={[styles.buttonSecondary, styles.buttonSecondaryFlex]} onPress={handleSavedRecipesPress}>
              <Text style={styles.buttonSecondaryText}>Saved coffee recipes</Text>
            </Pressable>
          </View>

          <Pressable style={styles.buttonLogout} onPress={handleLogout}>
            <Text style={styles.buttonLogoutText}>Odhlásiť sa</Text>
          </Pressable>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 48,
    backgroundColor: '#FAFAFA',
  },

  // Header
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: -0.5,
  },

  // Section card
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },

  // Inline header (title + link row)
  inlineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  // Section title — no bottom margin when inside inlineHeader
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },

  // Link text ("Celý inventár", "Všetky recepty")
  link: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8B7355',
  },

  // Loading indicator spacing
  loader: {
    marginVertical: 8,
    alignSelf: 'flex-start',
  },

  // Error text
  errorText: {
    fontSize: 13,
    color: '#D64545',
    marginTop: 4,
    marginBottom: 8,
  },

  // Metrics grid
  metricsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    padding: 16,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B6B6B',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Summary text below metrics
  summaryText: {
    fontSize: 13,
    color: '#6B6B6B',
    lineHeight: 18,
  },

  // Placeholder text (empty states)
  placeholder: {
    fontSize: 14,
    color: '#999999',
    lineHeight: 20,
    marginBottom: 4,
  },

  // Preview cards (inventory + recipes)
  previewCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  previewMeta: {
    fontSize: 12,
    color: '#6B6B6B',
    marginTop: 3,
    lineHeight: 16,
  },

  // Match score
  matchScore: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '600',
    color: '#8B7355',
  },

  // Actions section
  actionsSection: {
    marginTop: 4,
    gap: 10,
  },

  // Primary button (Scan Coffee)
  buttonPrimary: {
    backgroundColor: '#2C2C2C',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  buttonPrimaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },

  // Secondary buttons row
  secondaryButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  buttonSecondaryFlex: {
    flex: 1,
  },

  // Secondary button
  buttonSecondary: {
    backgroundColor: '#F5F5F5',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonSecondaryText: {
    color: '#2C2C2C',
    fontSize: 15,
    fontWeight: '600',
  },

  // Logout button
  buttonLogout: {
    backgroundColor: 'transparent',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonLogoutText: {
    color: '#D64545',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default HomeScreen;
