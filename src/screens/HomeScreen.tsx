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

  const recommendedCoffee = useMemo(() => {
    const withScore = inventoryTotals.active.map((item) => {
      const openedPenalty = item.openedAt
        ? Math.floor((Date.now() - new Date(item.openedAt).getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      const lowStockBonus = typeof item.remainingG === 'number' && item.remainingG <= 80 ? 12 : 0;
      return {
        item,
        score: openedPenalty + lowStockBonus,
      };
    });

    return withScore.sort((a, b) => b.score - a.score).slice(0, 3);
  }, [inventoryTotals.active]);

  const recipeHighlights = useMemo(() => {
    const sorted = [...recipes].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return sorted.slice(0, 3);
  }, [recipes]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
        <Text style={styles.title}>BrewMate</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rýchly prehľad</Text>
          {dashboardState === 'loading' ? <ActivityIndicator color="#6B4F3A" /> : null}
          {dashboardState === 'error' ? <Text style={styles.errorText}>{dashboardError}</Text> : null}

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
                  <Text style={styles.previewMeta}>
                    {item.coffeeProfile?.origin || 'Neznámy pôvod'} • {item.coffeeProfile?.roastLevel || 'Neznáme praženie'}
                  </Text>
                  <Text style={styles.previewMeta}>Zostáva: {remaining}</Text>
                </View>
              );
            })
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Odporúčame vypiť najskôr</Text>
          {recommendedCoffee.length === 0 ? (
            <Text style={styles.placeholder}>Keď pridáš aktívne kávy, ukážeme ktoré otvoriť ako prvé.</Text>
          ) : (
            recommendedCoffee.map(({item}) => {
              const coffeeName = item.correctedText || item.rawText || 'Neznáma káva';
              const openDays = item.openedAt
                ? Math.max(
                  1,
                  Math.floor((Date.now() - new Date(item.openedAt).getTime()) / (1000 * 60 * 60 * 24)),
                )
                : null;
              return (
                <View key={`${item.id}-recommendation`} style={styles.recommendCard}>
                  <Text style={styles.previewTitle}>{coffeeName}</Text>
                  <Text style={styles.previewMeta}>
                    {openDays ? `Otvorená ${openDays} dní` : 'Bez dátumu otvorenia'}
                    {typeof item.remainingG === 'number' ? ` • Zostáva ${item.remainingG} g` : ''}
                  </Text>
                </View>
              );
            })
          )}
        </View>

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

        <Pressable style={styles.button} onPress={handleScanPress}>
          <Text style={styles.buttonText}>Scan Coffee</Text>
        </Pressable>
        <Pressable style={styles.buttonSecondary} onPress={handlePhotoRecipePress}>
          <Text style={styles.buttonText}>Foto recept</Text>
        </Pressable>
        <Pressable style={styles.buttonSecondary} onPress={handleQuestionnairePress}>
          <Text style={styles.buttonText}>Chuťový dotazník</Text>
        </Pressable>
        <Pressable style={styles.buttonSecondary} onPress={handleInventoryPress}>
          <Text style={styles.buttonText}>Coffee inventár</Text>
        </Pressable>
        <Pressable style={styles.buttonSecondary} onPress={handleSavedRecipesPress}>
          <Text style={styles.buttonText}>Saved coffee recipes</Text>
        </Pressable>
        <Pressable style={styles.buttonOutline} onPress={handleLogout}>
          <Text style={styles.buttonOutlineText}>Odhlásiť sa</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    padding: 24,
    paddingBottom: 48,
    backgroundColor: '#F6F3EE',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 24,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E3DED6',
    marginBottom: 20,
  },
  inlineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    color: '#3E2F25',
  },
  placeholder: {
    fontSize: 14,
    color: '#6F6A64',
    marginBottom: 12,
  },
  matchScore: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '700',
    color: '#6B4F3A',
  },
  metricsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  metricCard: {
    minWidth: '47%',
    backgroundColor: '#EDE8E0',
    borderRadius: 16,
    padding: 12,
  },
  metricValue: {
    color: '#3E2F25',
    fontSize: 18,
    fontWeight: '700',
  },
  metricLabel: {
    color: '#6F6A64',
    marginTop: 3,
    fontSize: 13,
  },
  summaryText: {
    marginTop: 10,
    color: '#6F6A64',
  },
  previewCard: {
    borderWidth: 1,
    borderColor: '#E3DED6',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    backgroundColor: '#F6F3EE',
  },
  previewTitle: {
    color: '#3E2F25',
    fontWeight: '700',
    fontSize: 14,
  },
  previewMeta: {
    color: '#6F6A64',
    marginTop: 3,
    fontSize: 12,
  },
  recommendCard: {
    backgroundColor: '#EEF1E5',
    borderWidth: 1,
    borderColor: '#D8DECA',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  link: {
    color: '#6B4F3A',
    fontWeight: '700',
  },
  errorText: {
    color: '#B3261E',
    marginTop: 6,
  },
  button: {
    backgroundColor: '#6B4F3A',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginBottom: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  buttonSecondary: {
    backgroundColor: '#3E2F25',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
    minWidth: 200,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonOutline: {
    borderColor: '#6B4F3A',
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
    minWidth: 200,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonOutlineText: {
    color: '#6B4F3A',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default HomeScreen;
