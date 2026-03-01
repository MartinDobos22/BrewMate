import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/types';
import {apiFetch, DEFAULT_API_HOST} from '../utils/api';
import {useAuth} from '../context/AuthContext';
import TasteProfileBars from '../components/TasteProfileBars';
import {DEFAULT_TASTE_VECTOR, normalizeTasteVector, TasteVector} from '../utils/tasteVector';
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
  const [dashboardState, setDashboardState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [dashboardError, setDashboardError] = useState('');

  const loadSavedProfiles = useCallback(async () => {
    const [latestQuestionnaire, latestCoffee] = await Promise.all([
      loadLatestQuestionnaireResult(),
      loadLatestCoffeeProfile(),
    ]);
    setUserProfile(latestQuestionnaire?.payload?.profile ?? null);
    setCoffeeProfile(latestCoffee?.payload?.coffeeProfile ?? null);
  }, []);

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
    const avgDiff = axes.reduce((sum, key) => sum + Math.abs(user[key] - coffee[key]), 0) / axes.length;
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

  const activeCoffeePreview = useMemo(() => inventoryTotals.active.slice(0, 4), [inventoryTotals.active]);

  const recipeHighlights = useMemo(() => {
    const sorted = [...recipes].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return sorted.slice(0, 3);
  }, [recipes]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>🌅 Dobré ráno</Text>
          <Text style={styles.heroTitle}>Čo dnes uvaríš?</Text>
          <Text style={styles.heroSubtitle}>Prehľad zásob, chutí a odporúčaných receptov na jednom mieste.</Text>
          <Pressable style={styles.heroButton} onPress={() => navigation.navigate('CoffeeRecipesSaved')}>
            <Text style={styles.heroButtonText}>Odporúčané recepty</Text>
          </Pressable>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statTile}>
            <Text style={styles.statValue}>{inventoryTotals.active.length}</Text>
            <Text style={styles.statLabel}>Aktívne kávy</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statValue}>{inventoryTotals.gramsAvailable} g</Text>
            <Text style={styles.statLabel}>Zostáva spolu</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statValue}>{recipes.length}</Text>
            <Text style={styles.statLabel}>Uložené recepty</Text>
          </View>
        </View>

        {inventoryTotals.lowStock.length > 0 ? (
          <View style={styles.banner}>
            <Text style={styles.bannerTitle}>⚠️ Nízky stav zásob</Text>
            <Text style={styles.bannerText}>{inventoryTotals.lowStock.length} kávy sú takmer minuté.</Text>
          </View>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Môj chuťový profil</Text>
          <Pressable onPress={() => navigation.navigate('CoffeeQuestionnaire')}>
            <Text style={styles.link}>Upraviť</Text>
          </Pressable>
        </View>
        <View style={styles.sectionCard}>
          {!userProfile ? (
            <Text style={styles.placeholder}>Vyplň dotazník, aby sme nastavili tvoj chuťový profil.</Text>
          ) : null}
          <TasteProfileBars vector={userVector} />
          <View style={styles.tagRow}>
            <Text style={styles.tag}>☕ Pour Over</Text>
            <Text style={styles.tag}>🍫 Tmavšie chute</Text>
            <Text style={styles.tag}>🌍 Single origin</Text>
          </View>
          {matchScore !== null ? <Text style={styles.matchScore}>Zhoda posledného skenu: {matchScore}%</Text> : null}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Moje kávy</Text>
          <Pressable onPress={() => navigation.navigate('CoffeeInventory')}>
            <Text style={styles.link}>Všetky</Text>
          </Pressable>
        </View>
        {dashboardState === 'loading' ? <ActivityIndicator color="#6B4F3A" style={styles.loader} /> : null}
        {dashboardState === 'error' ? <Text style={styles.errorText}>{dashboardError}</Text> : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
          {activeCoffeePreview.length === 0 ? (
            <View style={styles.emptyHorizontalCard}>
              <Text style={styles.placeholder}>Zatiaľ nemáš aktívne kávy v zásobníku.</Text>
            </View>
          ) : (
            activeCoffeePreview.map((item) => {
              const name = item.correctedText || item.rawText || 'Neznáma káva';
              const remaining = item.remainingG === null ? 'Neznáme množstvo' : `${item.remainingG} g`;
              return (
                <View key={item.id} style={styles.coffeeCard}>
                  <Text style={styles.coffeeTitle}>{name}</Text>
                  <Text style={styles.coffeeMeta}>{item.coffeeProfile.origin || 'Neznámy pôvod'}</Text>
                  <Text style={styles.coffeeRemaining}>{remaining}</Text>
                </View>
              );
            })
          )}
        </ScrollView>

        <View style={styles.actionStack}>
          <Pressable style={[styles.actionCard, styles.actionCardPrimary]} onPress={() => navigation.navigate('CoffeeScanner')}>
            <Text style={styles.actionTitle}>📷 Coffee Scanner</Text>
            <Text style={styles.actionText}>Naskenuj etiketu a doplň profil kávy.</Text>
          </Pressable>
          <Pressable style={[styles.actionCard, styles.actionCardSecondary]} onPress={() => navigation.navigate('CoffeePhotoRecipe')}>
            <Text style={styles.actionTitle}>🍃 Foto recept</Text>
            <Text style={styles.actionText}>Ofoť balenie a nechaj AI navrhnúť recept.</Text>
          </Pressable>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Posledné recepty</Text>
          <Pressable onPress={() => navigation.navigate('CoffeeRecipesSaved')}>
            <Text style={styles.link}>Všetky</Text>
          </Pressable>
        </View>
        <View style={styles.recipeList}>
          {recipeHighlights.length === 0 ? (
            <Text style={styles.placeholder}>Zatiaľ nemáš uložené recepty.</Text>
          ) : (
            recipeHighlights.map((recipe) => (
              <View key={recipe.id} style={styles.recipeCard}>
                <Text style={styles.recipeTitle}>{recipe.title || 'Recept'}</Text>
                <Text style={styles.recipeMeta}>{recipe.method} • Predikcia chuti {recipe.likeScore}%</Text>
              </View>
            ))
          )}
        </View>

        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Odhlásiť sa</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {flex: 1, backgroundColor: '#F5F1EC'},
  scrollView: {flex: 1},
  container: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 40,
    backgroundColor: '#F5F1EC',
    gap: 14,
  },
  heroCard: {
    borderRadius: 28,
    backgroundColor: '#EDE0D4',
    padding: 20,
    borderWidth: 1,
    borderColor: '#DDD3C9',
  },
  heroLabel: {fontSize: 12, fontWeight: '700', color: '#6B4F3A', marginBottom: 8},
  heroTitle: {fontSize: 30, fontWeight: '700', color: '#271508'},
  heroSubtitle: {fontSize: 14, color: '#6B5C52', marginTop: 8, lineHeight: 20},
  heroButton: {
    marginTop: 14,
    alignSelf: 'flex-start',
    backgroundColor: '#6B4F3A',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  heroButtonText: {color: '#FFFFFF', fontWeight: '700', fontSize: 13},
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  statTile: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DDD3C9',
    backgroundColor: '#FFFFFF',
    padding: 12,
  },
  statValue: {fontSize: 21, fontWeight: '700', color: '#271508'},
  statLabel: {fontSize: 12, color: '#6B5C52', marginTop: 2},
  banner: {
    borderRadius: 16,
    backgroundColor: '#F2DEC4',
    borderWidth: 1,
    borderColor: '#DDD3C9',
    padding: 12,
  },
  bannerTitle: {fontSize: 14, fontWeight: '700', color: '#2B1800'},
  bannerText: {fontSize: 13, color: '#6B5C52', marginTop: 4},
  sectionHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6},
  sectionTitle: {fontSize: 17, fontWeight: '700', color: '#271508'},
  link: {fontSize: 13, fontWeight: '700', color: '#6B4F3A'},
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DDD3C9',
    padding: 14,
  },
  placeholder: {fontSize: 13, color: '#6B5C52'},
  matchScore: {marginTop: 8, color: '#6B4F3A', fontWeight: '700'},
  tagRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10},
  tag: {
    backgroundColor: '#EDE7DF',
    color: '#271508',
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  loader: {marginTop: 8},
  errorText: {color: '#BA1A1A', fontSize: 13, marginTop: 6},
  horizontalList: {gap: 8, paddingVertical: 4},
  emptyHorizontalCard: {
    width: 210,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#DDD3C9',
    backgroundColor: '#FFFFFF',
  },
  coffeeCard: {
    width: 170,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DDD3C9',
    backgroundColor: '#FFFFFF',
    padding: 12,
  },
  coffeeTitle: {fontSize: 15, fontWeight: '700', color: '#271508'},
  coffeeMeta: {marginTop: 2, fontSize: 12, color: '#6B5C52'},
  coffeeRemaining: {marginTop: 8, fontSize: 13, fontWeight: '700', color: '#6B4F3A'},
  actionStack: {gap: 10},
  actionCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
  },
  actionCardPrimary: {
    backgroundColor: '#6B4F3A',
    borderColor: '#6B4F3A',
  },
  actionCardSecondary: {
    backgroundColor: '#7A9255',
    borderColor: '#7A9255',
  },
  actionTitle: {fontSize: 18, fontWeight: '700', color: '#FFFFFF'},
  actionText: {marginTop: 4, color: 'rgba(255,255,255,0.9)', fontSize: 13},
  recipeList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DDD3C9',
    padding: 12,
    gap: 8,
  },
  recipeCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EDE7DF',
    backgroundColor: '#F9F6F2',
    padding: 10,
  },
  recipeTitle: {fontSize: 14, fontWeight: '700', color: '#271508'},
  recipeMeta: {marginTop: 2, fontSize: 12, color: '#6B5C52'},
  logoutButton: {
    marginTop: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#6B4F3A',
    paddingVertical: 12,
    alignItems: 'center',
  },
  logoutText: {color: '#6B4F3A', fontWeight: '700'},
});

export default HomeScreen;
