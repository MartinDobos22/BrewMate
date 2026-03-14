import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, ScrollView, FlatList } from 'react-native';
import {
  Text,
  Card,
  Surface,
  Button,
  ActivityIndicator,
  useTheme,
  Appbar,
  Divider,
} from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { HomeStackParamList } from '../navigation/types';
import { apiFetch, DEFAULT_API_HOST } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import TasteProfileBars from '../components/TasteProfileBars';
import TileCard from '../components/TileCard';
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
import spacing from '../styles/spacing';

type Props = NativeStackScreenProps<HomeStackParamList, 'Home'>;

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

type MetricTile = {
  key: string;
  value: string;
  label: string;
};

function HomeScreen({ navigation }: Props) {
  const { clearSession } = useAuth();
  const theme = useTheme<MD3Theme>();

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

  const handlePhotoRecipePress = () => {
    navigation.navigate('CoffeePhotoRecipe');
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

  const metricTiles: MetricTile[] = useMemo(() => [
    { key: 'active', value: String(inventoryTotals.active.length), label: 'Aktívne kávy' },
    { key: 'grams', value: `${inventoryTotals.gramsAvailable} g`, label: 'Aktuálne gramy' },
    { key: 'recipes', value: String(recipes.length), label: 'Uložené recepty' },
    { key: 'lowstock', value: String(inventoryTotals.lowStock.length), label: 'Takmer minuté' },
  ], [inventoryTotals, recipes]);

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header
        style={{ backgroundColor: theme.colors.background }}
        elevated={false}
      >
        <Appbar.Content title="BrewMate" titleStyle={{ color: theme.colors.onSurface }} />
      </Appbar.Header>

      <ScrollView
        style={[styles.scroll, { backgroundColor: theme.colors.background }]}
        contentContainerStyle={styles.content}
      >
        {/* Quick Overview Section */}
        <Card mode="elevated" elevation={1} style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content style={styles.cardContent}>
            <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
              Rýchly prehľad
            </Text>

            {dashboardState === 'loading' ? (
              <ActivityIndicator
                animating
                color={theme.colors.primary}
                style={styles.loader}
              />
            ) : null}

            {dashboardState === 'error' ? (
              <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors.error }]}>
                {dashboardError}
              </Text>
            ) : null}

            <FlatList
              data={metricTiles}
              keyExtractor={(item) => item.key}
              numColumns={2}
              scrollEnabled={false}
              columnWrapperStyle={styles.tileRow}
              contentContainerStyle={styles.tileGrid}
              renderItem={({ item }) => (
                <View style={styles.tileWrapper}>
                  <Card
                    mode="contained"
                    style={[styles.metricTile, { backgroundColor: theme.colors.surfaceVariant }]}
                  >
                    <Card.Content style={styles.metricContent}>
                      <Text variant="headlineMedium" style={{ color: theme.colors.onSurface }}>
                        {item.value}
                      </Text>
                      <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                        {item.label}
                      </Text>
                    </Card.Content>
                  </Card>
                </View>
              )}
            />

            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              Inventár: {inventoryTotals.active.length} aktívnych • {inventoryTotals.empty.length} dopitých
              {' '}• {inventoryTotals.archived.length} archivovaných.
            </Text>
          </Card.Content>
        </Card>

        {/* Active Coffees Section */}
        <Card mode="elevated" elevation={1} style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content style={styles.cardContent}>
            <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
              Aktuálne kávy
            </Text>

            {activeCoffeePreview.length === 0 ? (
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                Zatiaľ nemáš aktívne kávy. Pridaj prvý balík do inventára.
              </Text>
            ) : (
              activeCoffeePreview.map((item) => {
                const name = item.correctedText || item.rawText || 'Neznáma káva';
                const remaining = item.remainingG === null ? 'Neznáme' : `${item.remainingG} g`;
                return (
                  <Card
                    key={item.id}
                    mode="contained"
                    style={[styles.previewCard, { backgroundColor: theme.colors.surfaceVariant }]}
                  >
                    <Card.Content style={styles.previewContent}>
                      <Text variant="titleSmall" style={{ color: theme.colors.onSurface }}>
                        {name}
                      </Text>
                      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                        Zostáva: {remaining}
                      </Text>
                    </Card.Content>
                  </Card>
                );
              })
            )}
          </Card.Content>
        </Card>

        {/* Recipes Section */}
        <Card mode="elevated" elevation={1} style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content style={styles.cardContent}>
            <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
              Recepty na rýchly štart
            </Text>

            {recipeHighlights.length === 0 ? (
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                Zatiaľ nemáš uložené recepty. Vytvor ich cez Foto recept.
              </Text>
            ) : (
              recipeHighlights.map((recipe) => (
                <Card
                  key={recipe.id}
                  mode="contained"
                  style={[styles.previewCard, { backgroundColor: theme.colors.surfaceVariant }]}
                >
                  <Card.Content style={styles.previewContent}>
                    <Text variant="titleSmall" style={{ color: theme.colors.onSurface }}>
                      {recipe.title || 'Recipe'}
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      {recipe.method} • Predikcia chuti {recipe.likeScore}%
                    </Text>
                  </Card.Content>
                </Card>
              ))
            )}
          </Card.Content>
        </Card>

        {/* Taste Profile Section */}
        <Card mode="elevated" elevation={1} style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content style={styles.cardContent}>
            <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
              Tvoj chuťový profil
            </Text>

            {!userProfile ? (
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                Vyplňte dotazník, aby sme nastavili váš chuťový profil.
              </Text>
            ) : null}

            <TasteProfileBars vector={userVector} />

            {matchScore !== null ? (
              <Text variant="titleSmall" style={[styles.matchScore, { color: theme.colors.primary }]}>
                Zhoda: {matchScore}%
              </Text>
            ) : null}
          </Card.Content>
        </Card>

        {/* Actions Section */}
        <View style={styles.actionsSection}>
          <Button
            mode="contained"
            onPress={handleScanPress}
            style={styles.actionButton}
            contentStyle={styles.actionButtonContent}
          >
            Scan Coffee
          </Button>

          <Button
            mode="contained-tonal"
            onPress={handlePhotoRecipePress}
            style={styles.actionButton}
            contentStyle={styles.actionButtonContent}
          >
            Foto recept
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  sectionCard: {
    borderRadius: spacing.lg,
  },
  cardContent: {
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  sectionTitle: {
    fontWeight: '600',
  },
  loader: {
    alignSelf: 'flex-start',
  },
  errorText: {
    marginTop: spacing.xs,
  },
  tileGrid: {
    gap: spacing.sm,
  },
  tileRow: {
    gap: spacing.sm,
  },
  tileWrapper: {
    flex: 1,
  },
  metricTile: {
    borderRadius: spacing.lg,
  },
  metricContent: {
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  previewCard: {
    borderRadius: spacing.md,
  },
  previewContent: {
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  matchScore: {
    marginTop: spacing.sm,
  },
  actionsSection: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  actionButton: {
    borderRadius: spacing.md,
  },
  actionButtonContent: {
    paddingVertical: spacing.sm,
  },
});

export default HomeScreen;
