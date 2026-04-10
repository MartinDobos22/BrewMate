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
import BottomNavBar from '../components/BottomNavBar';
import {
  DEFAULT_TASTE_VECTOR,
  DEFAULT_TOLERANCE_VECTOR,
  normalizeTasteVector,
  TasteVector,
  ToleranceVector,
  MATCH_TIER_LABELS,
  MatchTier,
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

function IconBadge({icon}: {icon: string}) {
  return (
    <View style={styles.iconBadge}>
      <Text style={styles.iconEmoji}>{icon}</Text>
    </View>
  );
}

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
    const tolerance: ToleranceVector = userProfile.toleranceVector ?? DEFAULT_TOLERANCE_VECTOR;
    type TasteAxis = Exclude<keyof TasteVector, 'confidence'>;
    const axes: TasteAxis[] = ['acidity', 'sweetness', 'bitterness', 'body', 'fruity', 'roast'];

    const toleranceWeight = (axis: TasteAxis): number => {
      const level = tolerance[axis];
      if (level === 'tolerant') { return 0.4; }
      if (level === 'neutral') { return 0.7; }
      return 1.0;
    };

    let totalWeight = 0;
    let weightedDiff = 0;
    for (const axis of axes) {
      const w = toleranceWeight(axis);
      totalWeight += w;
      weightedDiff += Math.abs(user[axis] - coffee[axis]) * w;
    }

    const avgDiff = totalWeight > 0 ? weightedDiff / totalWeight : 0;
    return Math.round(100 - avgDiff);
  }, [coffeeProfile?.tasteVector, userProfile?.tasteVector, userProfile?.toleranceVector]);

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

  const activeCoffeePreview = useMemo(() => inventoryTotals.active.slice(0, 3), [inventoryTotals.active]);

  const recipeHighlights = useMemo(() => {
    const sorted = [...recipes].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return sorted.slice(0, 3);
  }, [recipes]);

  const recentActivity = useMemo(() => {
    const recentInventory = inventoryTotals.active
      .slice(0, 2)
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

    const recentRecipe = recipeHighlights.slice(0, 2).map(recipe => ({
      id: `recipe-${recipe.id}`,
      icon: '📘',
      title: recipe.title || 'Nový recept',
      meta: `${recipe.method} • Predikcia ${recipe.likeScore}%`,
      createdAt: recipe.createdAt,
    }));

    return [...recentInventory, ...recentRecipe]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3);
  }, [inventoryTotals.active, recipeHighlights]);

  const quickActions = [
    {key: 'inventory', label: 'Môj inventár kávy', icon: '🫘', onPress: handleInventoryPress},
    {key: 'brew', label: 'Skenovať kávu', icon: '📷', onPress: handleScanPress},
    {key: 'recipes', label: 'Obľúbené recepty', icon: '☕', onPress: handleSavedRecipesPress},
    {key: 'log', label: 'Generovať recept', icon: '✨', onPress: handlePhotoRecipePress},
  ];

  const inventoryAlert = inventoryTotals.lowStock[0];

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
          {dashboardState === 'error' ? <Text style={styles.errorText}>{dashboardError}</Text> : null}
          <View style={styles.quickGrid}>
            {quickActions.map(action => (
              <Pressable key={action.key} style={styles.quickCard} onPress={action.onPress}>
                <Text style={styles.quickIcon}>{action.icon}</Text>
                <Text style={styles.quickLabel}>{action.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Stav inventára</Text>
            <Pressable onPress={handleInventoryPress}>
              <Text style={styles.textButton}>Doplniť inventár</Text>
            </Pressable>
          </View>
          <Text style={styles.summaryText}>
            Aktívne: {inventoryTotals.active.length} • Dostupné: {inventoryTotals.gramsAvailable} g • Dopité:{' '}
            {inventoryTotals.empty.length}
          </Text>
          {inventoryAlert ? (
            <View style={styles.alertRow}>
              <Text style={styles.alertIcon}>⚠️</Text>
              <Text style={styles.alertText}>
                Dochádza {inventoryAlert.correctedText || inventoryAlert.rawText || 'káva'} ({inventoryAlert.remainingG} g)
              </Text>
            </View>
          ) : (
            <Text style={styles.goodStateText}>Super, zatiaľ nemáš žiadnu nízku zásobu.</Text>
          )}

          {activeCoffeePreview.length === 0 ? (
            <Text style={styles.placeholder}>Zatiaľ nemáš aktívne kávy. Pridaj prvý balík do inventára.</Text>
          ) : (
            activeCoffeePreview.map(item => {
              const name = item.correctedText || item.rawText || 'Neznáma káva';
              const remaining = item.remainingG === null ? 'Neznáme' : `${item.remainingG} g`;
              return (
                <View key={item.id} style={styles.listTile}>
                  <Text style={styles.listTileIcon}>🫘</Text>
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
            <Text style={styles.sectionTitle}>Dnešný tip</Text>
            <Text style={styles.tipTag}>🍃 Specialty</Text>
          </View>
          <Text style={styles.tipText}>Skús pomer 1:16 pre čistejší filter a sladší profil šálky.</Text>
          <Pressable style={styles.inlineAction} onPress={handleSavedRecipesPress}>
            <Text style={styles.inlineActionText}>Zobraziť recepty</Text>
          </Pressable>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Posledná aktivita</Text>
          </View>
          {recentActivity.length === 0 ? (
            <Text style={styles.placeholder}>Zatiaľ tu nič nie je. Začni skenom alebo pridaním zásoby.</Text>
          ) : (
            recentActivity.map(item => (
              <View key={item.id} style={styles.listTile}>
                <Text style={styles.listTileIcon}>{item.icon}</Text>
                <View style={styles.listTextWrap}>
                  <Text style={styles.listTitle}>{item.title}</Text>
                  <Text style={styles.listMeta}>{item.meta}</Text>
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
          {matchScore !== null ? (
            <Text style={styles.matchScore}>
              Zhoda profilu: {matchScore}% — {
                MATCH_TIER_LABELS[
                  (matchScore >= 85 ? 'perfect_match'
                    : matchScore >= 70 ? 'great_choice'
                    : matchScore >= 50 ? 'worth_trying'
                    : matchScore >= 30 ? 'interesting_experiment'
                    : 'not_for_you') as MatchTier
                ]
              }
            </Text>
          ) : null}
        </View>

        <Pressable style={styles.outlineAction} onPress={handleLogout}>
          <Text style={styles.outlineActionText}>Odhlásiť sa</Text>
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
    paddingBottom: 106,
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
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickCard: {
    width: '48%',
    borderRadius: 18,
    padding: 12,
    minHeight: 82,
    borderWidth: 1,
    borderColor: '#E5D8CC',
    backgroundColor: '#FFF8F3',
    justifyContent: 'space-between',
  },
  quickIcon: {
    fontSize: 20,
  },
  quickLabel: {
    marginTop: 6,
    color: '#2C1F13',
    fontWeight: '600',
    fontSize: 14,
  },
  summaryText: {
    marginBottom: 10,
    color: '#65584E',
    fontSize: 13,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF1E7',
    borderColor: '#F1D5BC',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  alertIcon: {
    marginRight: 8,
    fontSize: 14,
  },
  alertText: {
    color: '#7A4622',
    fontSize: 13,
    flex: 1,
  },
  goodStateText: {
    color: '#3A6A3D',
    backgroundColor: '#EAF6EA',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
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
  listTileIcon: {
    marginRight: 10,
    fontSize: 16,
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
  outlineActionText: {
    color: '#70523D',
    fontWeight: '600',
    fontSize: 15,
  },
});

export default HomeScreen;
