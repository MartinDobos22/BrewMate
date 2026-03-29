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
import {apiFetch, DEFAULT_API_HOST} from '../utils/api';
import {useAuth} from '../context/AuthContext';
import TasteProfileBars from '../components/TasteProfileBars';
import {
  DEFAULT_TASTE_VECTOR,
  normalizeTasteVector,
  TasteVector,
} from '../utils/tasteVector';
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

function HomeScreen({navigation}: Props) {
  const {clearSession} = useAuth();
  const [userProfile, setUserProfile] = useState<QuestionnaireResultPayload['profile'] | null>(
    null,
  );
  const [coffeeProfile, setCoffeeProfile] = useState<CoffeeProfilePayload['coffeeProfile'] | null>(
    null,
  );

  const [inventoryItems, setInventoryItems] = useState<HomeInventoryItem[]>([]);
  const [recipes, setRecipes] = useState<RecipeItem[]>([]);
  const [dashboardState, setDashboardState] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    'idle',
  );
  const [dashboardError, setDashboardError] = useState('');

  const loadSavedProfiles = useCallback(async () => {
    const [latestQuestionnaire, latestCoffee] = await Promise.all([
      loadLatestQuestionnaireResult(),
      loadLatestCoffeeProfile(),
    ]);

    setUserProfile(latestQuestionnaire?.payload?.profile ?? null);
    setCoffeeProfile(latestCoffee?.payload?.coffeeProfile ?? null);
  }, []);

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
          {method: 'GET', credentials: 'include'},
          {
            feature: 'HomeDashboard',
            action: 'load-inventory',
          },
        ),
        apiFetch(
          `${DEFAULT_API_HOST}/api/coffee-recipes?days=90`,
          {method: 'GET', credentials: 'include'},
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
    const axes: TasteAxis[] = ['acidity', 'sweetness', 'bitterness', 'body', 'fruity', 'roast'];
    const avgDiff =
      axes.reduce((sum, key) => sum + Math.abs(user[key] - coffee[key]), 0) / axes.length;
    return Math.round(100 - avgDiff);
  }, [coffeeProfile?.tasteVector, userProfile?.tasteVector]);

  const inventoryTotals = useMemo(() => {
    const active = inventoryItems.filter(item => item.status === 'active');
    const empty = inventoryItems.filter(item => item.status === 'empty');
    const archived = inventoryItems.filter(item => item.status === 'archived');
    const lowStock = active.filter(
      item => typeof item.remainingG === 'number' && item.remainingG > 0 && item.remainingG <= 60,
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

  const activeCoffeePreview = useMemo(() => inventoryTotals.active.slice(0, 4), [inventoryTotals.active]);

  const recipeHighlights = useMemo(() => {
    const sorted = [...recipes].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return sorted.slice(0, 3);
  }, [recipes]);

  const metricCards = [
    {label: 'Aktívne kávy', value: String(inventoryTotals.active.length), tone: 'primary'},
    {label: 'Dostupné gramy', value: `${inventoryTotals.gramsAvailable} g`, tone: 'secondary'},
    {label: 'Uložené recepty', value: String(recipes.length), tone: 'tertiary'},
    {label: 'Nízke zásoby', value: String(inventoryTotals.lowStock.length), tone: 'warning'},
  ] as const;

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
        <View style={styles.heroCard}>
          <Text style={styles.overline}>BrewMate Home</Text>
          <Text style={styles.title}>Tvoj coffee dashboard</Text>
          <Text style={styles.heroSubtitle}>
            Material 3 štýl: čisté karty, prehľadná typografia a dôležité dáta na prvý pohľad.
          </Text>

          <View style={styles.heroActionsRow}>
            <Pressable style={[styles.chip, styles.primaryChip]} onPress={handleScanPress}>
              <Text style={styles.primaryChipLabel}>Scan coffee</Text>
            </Pressable>
            <Pressable style={styles.chip} onPress={handlePhotoRecipePress}>
              <Text style={styles.chipLabel}>Foto recept</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Rýchly prehľad</Text>
            {dashboardState === 'loading' ? <ActivityIndicator color="#5B4332" /> : null}
          </View>
          {dashboardState === 'error' ? <Text style={styles.errorText}>{dashboardError}</Text> : null}

          <View style={styles.metricsGrid}>
            {metricCards.map(metric => (
              <View
                key={metric.label}
                style={[
                  styles.metricCard,
                  metric.tone === 'primary' && styles.metricCardPrimary,
                  metric.tone === 'secondary' && styles.metricCardSecondary,
                  metric.tone === 'tertiary' && styles.metricCardTertiary,
                  metric.tone === 'warning' && styles.metricCardWarning,
                ]}>
                <Text style={styles.metricValue}>{metric.value}</Text>
                <Text style={styles.metricLabel}>{metric.label}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.summaryText}>
            Inventár: {inventoryTotals.active.length} aktívnych • {inventoryTotals.empty.length} dopitých •{' '}
            {inventoryTotals.archived.length} archivovaných
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Aktuálne kávy</Text>
            <Pressable onPress={handleInventoryPress}>
              <Text style={styles.textButton}>Celý inventár</Text>
            </Pressable>
          </View>

          {activeCoffeePreview.length === 0 ? (
            <Text style={styles.placeholder}>Zatiaľ nemáš aktívne kávy. Pridaj prvý balík do inventára.</Text>
          ) : (
            activeCoffeePreview.map(item => {
              const name = item.correctedText || item.rawText || 'Neznáma káva';
              const remaining = item.remainingG === null ? 'Neznáme' : `${item.remainingG} g`;
              return (
                <View key={item.id} style={styles.listTile}>
                  <View style={styles.dot} />
                  <View style={styles.listTextWrap}>
                    <Text style={styles.listTitle}>{name}</Text>
                    <Text style={styles.listMeta}>Zostáva: {remaining}</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recepty na rýchly štart</Text>
            <Pressable onPress={handleSavedRecipesPress}>
              <Text style={styles.textButton}>Všetky recepty</Text>
            </Pressable>
          </View>

          {recipeHighlights.length === 0 ? (
            <Text style={styles.placeholder}>Zatiaľ nemáš uložené recepty. Vytvor ich cez Foto recept.</Text>
          ) : (
            recipeHighlights.map(recipe => (
              <View key={recipe.id} style={styles.listTile}>
                <View style={[styles.dot, styles.dotRecipe]} />
                <View style={styles.listTextWrap}>
                  <Text style={styles.listTitle}>{recipe.title || 'Recipe'}</Text>
                  <Text style={styles.listMeta}>
                    {recipe.method} • Predikcia chuti {recipe.likeScore}%
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

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
          {matchScore !== null ? <Text style={styles.matchScore}>Zhoda profilu: {matchScore}%</Text> : null}
        </View>

        <View style={styles.bottomActions}>
          <Pressable style={styles.secondaryAction} onPress={handleInventoryPress}>
            <Text style={styles.secondaryActionText}>Coffee inventár</Text>
          </Pressable>
          <Pressable style={styles.secondaryAction} onPress={handleSavedRecipesPress}>
            <Text style={styles.secondaryActionText}>Saved coffee recipes</Text>
          </Pressable>
        </View>

        <Pressable style={styles.outlineAction} onPress={handleLogout}>
          <Text style={styles.outlineActionText}>Odhlásiť sa</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F3EE',
  },
  scrollView: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    backgroundColor: '#F8F3EE',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 48,
  },
  heroCard: {
    borderRadius: 28,
    padding: 20,
    marginBottom: 16,
    backgroundColor: '#EEDFCF',
    borderWidth: 1,
    borderColor: '#D7C2AB',
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
  heroActionsRow: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 10,
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: '#FFFFFFAA',
    borderWidth: 1,
    borderColor: '#D1BCAB',
  },
  primaryChip: {
    backgroundColor: '#5B4332',
    borderColor: '#5B4332',
  },
  chipLabel: {
    color: '#4C4137',
    fontWeight: '600',
  },
  primaryChipLabel: {
    color: '#FFFFFF',
    fontWeight: '600',
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
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    width: '48%',
    borderRadius: 18,
    padding: 12,
    minHeight: 82,
    borderWidth: 1,
  },
  metricCardPrimary: {
    backgroundColor: '#F8EDE1',
    borderColor: '#E5D2BF',
  },
  metricCardSecondary: {
    backgroundColor: '#F2F0E9',
    borderColor: '#DBD8CD',
  },
  metricCardTertiary: {
    backgroundColor: '#F5EDEE',
    borderColor: '#E5D2D4',
  },
  metricCardWarning: {
    backgroundColor: '#FAEEE5',
    borderColor: '#E8D4C3',
  },
  metricValue: {
    color: '#2C1F13',
    fontWeight: '700',
    fontSize: 20,
  },
  metricLabel: {
    color: '#65584E',
    marginTop: 4,
    fontSize: 13,
  },
  summaryText: {
    marginTop: 12,
    color: '#65584E',
    fontSize: 13,
  },
  placeholder: {
    color: '#6A5B50',
    fontSize: 14,
    lineHeight: 20,
  },
  listTile: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5D8CC',
    backgroundColor: '#FFF8F3',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 99,
    backgroundColor: '#795548',
    marginRight: 10,
  },
  dotRecipe: {
    backgroundColor: '#8B6D4B',
  },
  listTextWrap: {
    flex: 1,
  },
  listTitle: {
    color: '#2C1F13',
    fontWeight: '600',
    fontSize: 14,
  },
  listMeta: {
    color: '#66584D',
    marginTop: 2,
    fontSize: 12,
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
  bottomActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  secondaryAction: {
    flex: 1,
    backgroundColor: '#2C2218',
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryActionText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  outlineAction: {
    marginTop: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#70523D',
    paddingVertical: 13,
    alignItems: 'center',
  },
  outlineActionText: {
    color: '#70523D',
    fontWeight: '600',
    fontSize: 15,
  },
});

export default HomeScreen;
