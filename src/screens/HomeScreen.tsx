import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  FlatList,
  Pressable,
} from 'react-native';
import {
  Text,
  Button,
  ActivityIndicator,
  Chip,
  useTheme,
  Appbar,
  Divider,
  ProgressBar,
} from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { HomeStackParamList, BottomTabParamList } from '../navigation/types';
import { apiFetch, DEFAULT_API_HOST } from '../utils/api';
import { useAuth } from '../context/AuthContext';
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
import spacing, { radii } from '../styles/spacing';
import { extraColors } from '../theme/theme';

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
  totalG: number | null;
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

/* ════════════════════════════════════════
   Helper: time-based greeting
════════════════════════════════════════ */
function getGreeting(): { text: string; emoji: string } {
  const h = new Date().getHours();
  if (h < 12) return { text: 'Dobré ráno', emoji: '🌅' };
  if (h < 18) return { text: 'Dobré popoludnie', emoji: '☀️' };
  return { text: 'Dobrý večer', emoji: '🌙' };
}

/* ════════════════════════════════════════
   Helper: remaining percentage
════════════════════════════════════════ */
function remainPct(item: HomeInventoryItem): number {
  if (item.remainingG == null || item.totalG == null || item.totalG === 0) return 0;
  return Math.round((item.remainingG / item.totalG) * 100);
}

/* ════════════════════════════════════════
   COMPONENT
════════════════════════════════════════ */
function HomeScreen({ navigation }: Props) {
  const { clearSession, user } = useAuth();
  const theme = useTheme<MD3Theme>();
  const tabNav = useNavigation<BottomTabNavigationProp<BottomTabParamList>>();

  // ── State ──
  const [userProfile, setUserProfile] = useState<QuestionnaireResultPayload['profile'] | null>(null);
  const [coffeeProfile, setCoffeeProfile] = useState<CoffeeProfilePayload['coffeeProfile'] | null>(null);
  const [inventoryItems, setInventoryItems] = useState<HomeInventoryItem[]>([]);
  const [recipes, setRecipes] = useState<RecipeItem[]>([]);
  const [dashboardState, setDashboardState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [dashboardError, setDashboardError] = useState('');

  // ── Load saved profiles ──
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

  // ── Load dashboard data ──
  const loadDashboardData = useCallback(async () => {
    setDashboardState('loading');
    setDashboardError('');
    try {
      const [inventoryResponse, recipesResponse] = await Promise.all([
        apiFetch(
          `${DEFAULT_API_HOST}/api/user-coffee?includeInactive=true`,
          { method: 'GET', credentials: 'include' },
          { feature: 'HomeDashboard', action: 'load-inventory' },
        ),
        apiFetch(
          `${DEFAULT_API_HOST}/api/coffee-recipes?days=90`,
          { method: 'GET', credentials: 'include' },
          { feature: 'HomeDashboard', action: 'load-recipes' },
        ),
      ]);

      const inventoryPayload = await inventoryResponse.json().catch(() => null);
      const recipesPayload = await recipesResponse.json().catch(() => null);

      if (!inventoryResponse.ok) {
        throw new Error(inventoryPayload?.error || 'Nepodarilo sa načítať inventár.');
      }
      if (!recipesResponse.ok) {
        throw new Error(recipesPayload?.error || 'Nepodarilo sa načítať recepty.');
      }

      setInventoryItems(Array.isArray(inventoryPayload?.items) ? inventoryPayload.items : []);
      setRecipes(Array.isArray(recipesPayload?.items) ? recipesPayload.items : []);
      setDashboardState('ready');
    } catch (error) {
      setDashboardState('error');
      setDashboardError(error instanceof Error ? error.message : 'Nepodarilo sa načítať dashboard dáta.');
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
    return navigation.addListener('focus', loadDashboardData);
  }, [loadDashboardData, navigation]);

  // ── Computed data ──
  const userVector = useMemo<TasteVector>(
    () => normalizeTasteVector(userProfile?.tasteVector ?? DEFAULT_TASTE_VECTOR),
    [userProfile],
  );

  const inventoryTotals = useMemo(() => {
    const active = inventoryItems.filter((i) => i.status === 'active');
    const lowStock = active.filter(
      (i) => typeof i.remainingG === 'number' && i.remainingG > 0 && i.remainingG <= 60,
    );
    return {
      active,
      lowStock,
      gramsAvailable: active.reduce(
        (sum, i) => sum + (typeof i.remainingG === 'number' ? i.remainingG : 0),
        0,
      ),
    };
  }, [inventoryItems]);

  const activeCoffeePreview = useMemo(
    () => inventoryTotals.active.slice(0, 6),
    [inventoryTotals.active],
  );

  const recipeHighlights = useMemo(() => {
    const sorted = [...recipes].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return sorted.slice(0, 3);
  }, [recipes]);

  const lowStockItem = useMemo(() => {
    if (inventoryTotals.lowStock.length === 0) return null;
    return inventoryTotals.lowStock[0];
  }, [inventoryTotals.lowStock]);

  const greeting = useMemo(() => getGreeting(), []);

  const displayName = useMemo(() => {
    if (user?.displayName) return user.displayName.split(' ')[0];
    return 'Martin';
  }, [user]);

  // ── Handlers ──
  const handleScanPress = () => navigation.navigate('CoffeeScanner');
  const handlePhotoRecipePress = () => navigation.navigate('CoffeePhotoRecipe');
  const goToInventory = () => tabNav.navigate('InventoryTab');
  const goToRecipes = () => tabNav.navigate('RecipesTab');

  // ── Color assignments for coffee tiles cycle ──
  const tileColorCycle = useMemo(() => [
    { accent: theme.colors.secondary, container: extraColors.secondaryContainer, onContainer: extraColors.onSecondaryContainer },
    { accent: theme.colors.error, container: extraColors.errorContainer, onContainer: extraColors.onErrorContainer },
    { accent: theme.colors.primary, container: extraColors.primaryContainer, onContainer: extraColors.onPrimaryContainer },
    { accent: theme.colors.tertiary, container: extraColors.tertiaryContainer, onContainer: extraColors.onTertiaryContainer },
  ], [theme]);

  /* ═══════════════════════════
     RENDER
  ═══════════════════════════ */
  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      {/* ── Top App Bar ── */}
      <Appbar.Header style={{ backgroundColor: theme.colors.background }} elevated={false}>
        <Appbar.Content
          title="BrewMate"
          titleStyle={[styles.appBarTitle, { color: theme.colors.onSurface }]}
        />
        <Appbar.Action icon="magnify" color={theme.colors.onSurfaceVariant} onPress={() => {}} />
        <Appbar.Action icon="bell-outline" color={theme.colors.onSurfaceVariant} onPress={() => {}} />
      </Appbar.Header>

      <ScrollView
        style={{ backgroundColor: theme.colors.background }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ══════════ BENTO GRID ══════════ */}
        <View style={styles.bento}>

          {/* ──────────────────────
             TILE 1: Greeting (span-2)
          ────────────────────── */}
          <View style={[styles.span2, styles.tileGreeting, { backgroundColor: theme.colors.primaryContainer }]}>
            {/* Decorative circles */}
            <View style={[styles.greetCircle1, { backgroundColor: 'rgba(107,66,38,0.09)' }]} />
            <View style={[styles.greetCircle2, { backgroundColor: 'rgba(107,66,38,0.06)' }]} />

            <View style={styles.greetingLine}>
              <View style={[styles.greetingPill, { backgroundColor: 'rgba(107,66,38,0.12)' }]}>
                <Text style={[styles.greetingPillText, { color: theme.colors.primary }]}>
                  {greeting.emoji} {greeting.text}, {displayName}
                </Text>
              </View>
            </View>

            <Text style={[styles.greetingHeading, { color: theme.colors.onPrimaryContainer }]}>
              Čo dnes{' '}
              <Text style={styles.greetingBold}>uvareš?</Text>
            </Text>

            {/* Daily recommendation row */}
            {activeCoffeePreview.length > 0 ? (
              <View style={[styles.recRow, { borderColor: 'rgba(255,255,255,0.75)' }]}>
                <View style={[styles.recIco, { backgroundColor: theme.colors.primaryContainer }]}>
                  <Icon name="coffee" size={20} color={theme.colors.primary} />
                </View>
                <View style={styles.recInfo}>
                  <Text style={[styles.recLabel, { color: theme.colors.onSurfaceVariant }]}>
                    Odporúčanie dňa
                  </Text>
                  <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
                    {activeCoffeePreview[0].correctedText || activeCoffeePreview[0].rawText || 'Neznáma káva'}
                  </Text>
                  <Text style={[styles.recMeta, { color: theme.colors.onSurfaceVariant }]}>
                    {activeCoffeePreview[0].coffeeProfile?.roastLevel ?? 'Stredné'} · {(activeCoffeePreview[0].coffeeProfile?.flavorNotes ?? []).slice(0, 2).join(' · ') || 'Klasická'} · 93 °C
                  </Text>
                </View>
                <Button
                  mode="contained"
                  compact
                  style={styles.brewBtn}
                  labelStyle={styles.brewBtnLabel}
                  onPress={handlePhotoRecipePress}
                >
                  Uvariť
                </Button>
              </View>
            ) : null}
          </View>

          {/* ──────────────────────
             TILE 2: Stat tiles (4x span-1)
          ────────────────────── */}
          {/* 2a: Varení */}
          <View style={[styles.span1, styles.tileStat, { backgroundColor: theme.colors.primaryContainer }]}>
            <View style={[styles.statIcoWrap, { backgroundColor: 'rgba(107,66,38,0.16)' }]}>
              <Icon name="coffee" size={15} color={theme.colors.primary} />
            </View>
            <Text style={[styles.statNum, { color: theme.colors.onPrimaryContainer }]}>
              {recipes.length}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.onPrimaryContainer }]}>Varení</Text>
          </View>

          {/* 2b: Zásobník */}
          <View style={[styles.span1, styles.tileStat, { backgroundColor: theme.colors.secondaryContainer }]}>
            <View style={[styles.statIcoWrap, { backgroundColor: 'rgba(119,87,74,0.16)' }]}>
              <Icon name="package-variant" size={15} color={theme.colors.secondary} />
            </View>
            <Text style={[styles.statNum, { color: extraColors.onSecondaryContainer }]}>
              {inventoryTotals.active.length}
            </Text>
            <Text style={[styles.statLabel, { color: extraColors.onSecondaryContainer }]}>Zásobník</Text>
          </View>

          {/* 2c: Recepty */}
          <View style={[styles.span1, styles.tileStat, { backgroundColor: theme.colors.tertiaryContainer }]}>
            <View style={[styles.statIcoWrap, { backgroundColor: 'rgba(74,97,48,0.18)' }]}>
              <Icon name="file-document-outline" size={15} color={theme.colors.tertiary} />
            </View>
            <Text style={[styles.statNum, { color: extraColors.onTertiaryContainer }]}>
              {recipes.length}
            </Text>
            <Text style={[styles.statLabel, { color: extraColors.onTertiaryContainer }]}>Receptov</Text>
          </View>

          {/* 2d: Warning (low stock) */}
          <View style={[styles.span1, styles.tileStatWarn, { backgroundColor: theme.colors.errorContainer }]}>
            <View style={styles.warnHeader}>
              <Icon name="alert" size={14} color={theme.colors.error} />
              <Text style={[styles.warnTitle, { color: theme.colors.error }]}>Upozornenie</Text>
            </View>
            {lowStockItem ? (
              <Text style={[styles.warnBody, { color: extraColors.onErrorContainer }]}>
                {lowStockItem.correctedText || lowStockItem.rawText || 'Káva'}{'\n'}
                ~{lowStockItem.remainingG ?? 0} g zostatok
              </Text>
            ) : (
              <Text style={[styles.warnBody, { color: extraColors.onErrorContainer }]}>
                {inventoryTotals.lowStock.length === 0
                  ? 'Žiadne upozornenia'
                  : `${inventoryTotals.lowStock.length} kávy dochádza`}
              </Text>
            )}
          </View>

          {/* ──────────────────────
             TILE 3: Taste Profile (span-2)
          ────────────────────── */}
          <View
            style={[
              styles.span2,
              styles.tileTaste,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.outlineVariant,
              },
            ]}
          >
            {/* User header row */}
            <View style={[styles.tasteHeader, { borderBottomColor: theme.colors.outlineVariant }]}>
              <View style={[styles.userAvatar, { backgroundColor: theme.colors.primaryContainer, borderColor: 'rgba(107,66,38,0.1)' }]}>
                <Icon name="account" size={20} color={theme.colors.primary} />
              </View>
              <View style={styles.tasteHeaderInfo}>
                <Text variant="titleSmall" style={{ color: theme.colors.onSurface }}>
                  {user?.displayName || 'Používateľ'}
                </Text>
                <Text style={[styles.tasteHeaderSub, { color: theme.colors.onSurfaceVariant }]}>
                  {userProfile?.archetypeName ?? 'Nový kávičkár'} · Level {userProfile?.level ?? 1}
                </Text>
              </View>
              <View style={[styles.badge, { backgroundColor: theme.colors.primaryContainer }]}>
                <Text style={[styles.badgeText, { color: theme.colors.onPrimaryContainer }]}>
                  {recipes.length} varení
                </Text>
              </View>
            </View>

            {/* Taste bars */}
            <TasteBarRow label="Intenzita" value={userVector.body ?? 50} theme={theme} />
            <TasteBarRow label="Kyslosť" value={userVector.acidity ?? 50} theme={theme} />
            <TasteBarRow label="Sladkosť" value={userVector.sweetness ?? 50} theme={theme} />
            <TasteBarRow label="Horkosť" value={userVector.bitterness ?? 50} theme={theme} />

            {/* Chips */}
            <View style={[styles.chipsSection, { borderTopColor: theme.colors.outlineVariant }]}>
              <View style={styles.chipsRow}>
                <Chip
                  mode="flat"
                  selected
                  style={[styles.chip, { backgroundColor: theme.colors.secondaryContainer }]}
                  textStyle={{ color: extraColors.onSecondaryContainer, fontSize: 13 }}
                >
                  Pour Over
                </Chip>
                <Chip
                  mode="outlined"
                  style={[styles.chipOutlined, { borderColor: theme.colors.outlineVariant }]}
                  textStyle={{ color: theme.colors.onSurfaceVariant, fontSize: 13 }}
                >
                  {userProfile?.preferredRoast ?? 'Stredné'}
                </Chip>
                <Chip
                  mode="outlined"
                  style={[styles.chipOutlined, { borderColor: theme.colors.outlineVariant }]}
                  textStyle={{ color: theme.colors.onSurfaceVariant, fontSize: 13 }}
                >
                  {userProfile?.preferredOrigin ?? 'Afrika'}
                </Chip>
              </View>
            </View>
          </View>

          {/* ──────────────────────
             TILE 4: Coffee Cards horizontal scroll (span-2)
          ────────────────────── */}
          <View
            style={[
              styles.span2,
              styles.tileScroll,
              {
                backgroundColor: theme.colors.surfaceVariant,
                borderColor: theme.colors.outlineVariant,
              },
            ]}
          >
            <View style={styles.tileScrollHeader}>
              <Text variant="titleSmall" style={{ color: theme.colors.onSurface }}>Moje kávy</Text>
              <Pressable onPress={goToInventory}>
                <Text style={[styles.linkText, { color: theme.colors.primary }]}>Všetky →</Text>
              </Pressable>
            </View>

            {dashboardState === 'loading' ? (
              <ActivityIndicator
                animating
                color={theme.colors.primary}
                style={styles.scrollLoader}
              />
            ) : activeCoffeePreview.length === 0 ? (
              <View style={styles.emptyScroll}>
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                  Zatiaľ nemáš aktívne kávy
                </Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.hScroll}
              >
                {activeCoffeePreview.map((item, idx) => {
                  const colors = tileColorCycle[idx % tileColorCycle.length];
                  const pct = remainPct(item);
                  const isLow = typeof item.remainingG === 'number' && item.remainingG <= 60;
                  const name = item.correctedText || item.rawText || 'Neznáma';
                  const origin = item.coffeeProfile?.origin ?? '';
                  const total = item.totalG ? `${item.totalG} g` : '';

                  return (
                    <View
                      key={item.id}
                      style={[
                        styles.cofTile,
                        {
                          backgroundColor: theme.colors.surface,
                          borderColor: theme.colors.outlineVariant,
                        },
                      ]}
                    >
                      {/* Top accent bar */}
                      <View style={[styles.cofTileTop, { backgroundColor: colors.accent }]} />

                      {/* Icon */}
                      <View style={[styles.cofTileIco, { backgroundColor: colors.container }]}>
                        <Icon name="coffee" size={16} color={colors.accent} />
                      </View>

                      <Text variant="titleSmall" style={{ color: theme.colors.onSurface }} numberOfLines={1}>
                        {name}
                      </Text>
                      <Text style={[styles.cofTileSub, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
                        {origin}{origin && total ? ' · ' : ''}{total}
                      </Text>

                      {/* Progress bar */}
                      <View style={[styles.pbar, { backgroundColor: extraColors.surfaceContainerHigh }]}>
                        <View
                          style={[
                            styles.pbarFill,
                            {
                              width: `${Math.min(pct, 100)}%`,
                              backgroundColor: isLow ? theme.colors.error : colors.accent,
                            },
                          ]}
                        />
                      </View>

                      {isLow ? (
                        <View style={[styles.badgeSmall, { backgroundColor: theme.colors.errorContainer }]}>
                          <Text style={[styles.badgeSmallText, { color: theme.colors.error }]}>Málo</Text>
                        </View>
                      ) : (
                        <Text style={[styles.cofPct, { color: colors.accent }]}>{pct} %</Text>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>

          {/* ──────────────────────
             TILE 5: Action tiles (2x span-1)
          ────────────────────── */}
          {/* 5a: Coffee Scanner */}
          <Pressable
            style={[styles.span1, styles.tileAction, { backgroundColor: theme.colors.secondaryContainer }]}
            onPress={handleScanPress}
          >
            <View style={[styles.actIcoWrap, { backgroundColor: 'rgba(119,87,74,0.18)' }]}>
              <Icon name="camera" size={19} color={theme.colors.secondary} />
            </View>
            <View>
              <Text variant="titleSmall" style={[styles.actTitle, { color: extraColors.onSecondaryContainer }]}>
                Coffee{'\n'}Scanner
              </Text>
              <Text style={[styles.actSub, { color: 'rgba(44,21,16,0.6)' }]}>Naskenuj etiketu</Text>
            </View>
            <View style={styles.actArrow}>
              <View style={[styles.actArrowBtn, { backgroundColor: theme.colors.primary }]}>
                <Icon name="arrow-right" size={13} color={theme.colors.onPrimary} />
              </View>
            </View>
          </Pressable>

          {/* 5b: AI Recept */}
          <Pressable
            style={[
              styles.span1,
              styles.tileAction,
              {
                backgroundColor: extraColors.surfaceContainerHigh,
                borderColor: theme.colors.outlineVariant,
                borderWidth: 1,
              },
            ]}
            onPress={handlePhotoRecipePress}
          >
            <View style={[styles.actIcoWrap, { backgroundColor: 'rgba(107,66,38,0.12)' }]}>
              <Icon name="star" size={19} color={theme.colors.primary} />
            </View>
            <View>
              <Text variant="titleSmall" style={[styles.actTitle, { color: theme.colors.onSurface }]}>
                AI{'\n'}Recept
              </Text>
              <Text style={[styles.actSub, { color: theme.colors.onSurfaceVariant }]}>Ofoť, AI navrhne</Text>
            </View>
            <View style={styles.actArrow}>
              <View style={[styles.actArrowBtn, { backgroundColor: theme.colors.primary }]}>
                <Icon name="arrow-right" size={13} color={theme.colors.onPrimary} />
              </View>
            </View>
          </Pressable>

          {/* ──────────────────────
             TILE 6: Recent Recipes (span-2)
          ────────────────────── */}
          <View
            style={[
              styles.span2,
              styles.tileRecipes,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.outlineVariant,
              },
            ]}
          >
            <View style={[styles.recipesHeader, { borderBottomColor: theme.colors.outlineVariant }]}>
              <Text variant="titleSmall" style={{ color: theme.colors.onSurface }}>Posledné recepty</Text>
              <Pressable onPress={goToRecipes}>
                <Text style={[styles.linkText, { color: theme.colors.primary }]}>Všetky →</Text>
              </Pressable>
            </View>

            {recipeHighlights.length === 0 ? (
              <View style={styles.emptyRecipes}>
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                  Zatiaľ nemáš uložené recepty
                </Text>
              </View>
            ) : (
              recipeHighlights.map((recipe, idx) => {
                const isFirst = idx === 0;
                const leadColor = isFirst ? theme.colors.primaryContainer : theme.colors.secondaryContainer;
                const leadIcon = isFirst ? theme.colors.primary : theme.colors.secondary;

                return (
                  <React.Fragment key={recipe.id}>
                    {idx > 0 ? (
                      <View style={[styles.recipeDivider, { backgroundColor: theme.colors.outlineVariant }]} />
                    ) : null}
                    <View style={styles.recipeItem}>
                      <View style={[styles.recipeLead, { backgroundColor: leadColor }]}>
                        <Icon name="coffee" size={20} color={leadIcon} />
                      </View>
                      <View style={styles.recipeInfo}>
                        <Text variant="titleSmall" style={{ color: theme.colors.onSurface }}>
                          {recipe.title || 'Recept'}
                        </Text>
                        <Text style={[styles.recipeMeta, { color: theme.colors.onSurfaceVariant }]}>
                          {recipe.method} · Predikcia {recipe.likeScore}%
                        </Text>
                      </View>
                      {isFirst ? (
                        <View style={[styles.badge, { backgroundColor: theme.colors.primaryContainer }]}>
                          <Text style={[styles.badgeText, { color: theme.colors.onPrimaryContainer }]}>Obľúbené</Text>
                        </View>
                      ) : (
                        <Icon name="chevron-right" size={16} color={theme.colors.outline} />
                      )}
                    </View>
                  </React.Fragment>
                );
              })
            )}
          </View>

          {/* Bottom spacer for safe scrolling */}
          <View style={styles.bottomSpacer} />
        </View>
      </ScrollView>

      {/* Loading overlay */}
      {dashboardState === 'loading' && dashboardError === '' ? null : null}
      {dashboardState === 'error' ? (
        <View style={[styles.errorBanner, { backgroundColor: theme.colors.errorContainer }]}>
          <Text variant="bodySmall" style={{ color: theme.colors.error }}>{dashboardError}</Text>
          <Button mode="text" compact onPress={loadDashboardData} textColor={theme.colors.error}>
            Skúsiť znova
          </Button>
        </View>
      ) : null}
    </View>
  );
}

/* ═══════════════════════════
   Taste Bar Row component
═══════════════════════════ */
function TasteBarRow({
  label,
  value,
  theme,
}: {
  label: string;
  value: number;
  theme: MD3Theme;
}) {
  const displayVal = (value / 10).toFixed(1);
  const progress = value / 100;

  return (
    <View style={styles.tasteBarRow}>
      <Text style={[styles.tasteLbl, { color: theme.colors.onSurfaceVariant }]}>{label}</Text>
      <View style={[styles.tasteTrack, { backgroundColor: extraColors.surfaceContainerHigh }]}>
        <View
          style={[
            styles.tasteFill,
            {
              width: `${value}%`,
              backgroundColor: theme.colors.primary,
            },
          ]}
        />
      </View>
      <Text style={[styles.tasteVal, { color: theme.colors.primary }]}>{displayVal}</Text>
    </View>
  );
}

/* ═══════════════════════════
   STYLES
═══════════════════════════ */
const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  appBarTitle: {
    fontSize: 22,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  scrollContent: {
    paddingBottom: spacing.xxxl + spacing.xl,
  },

  /* Bento Grid */
  bento: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  span2: {
    width: '100%',
  },
  span1: {
    // (containerWidth - gap) / 2 → use flex instead
    flex: 1,
    minWidth: '45%',
  },

  /* TILE 1: Greeting */
  tileGreeting: {
    borderRadius: radii.xl,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
    overflow: 'hidden',
  },
  greetCircle1: {
    position: 'absolute',
    right: -28,
    top: -28,
    width: 150,
    height: 150,
    borderRadius: 75,
  },
  greetCircle2: {
    position: 'absolute',
    right: 24,
    bottom: -44,
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  greetingLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  greetingPill: {
    borderRadius: radii.full,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  greetingPillText: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  greetingHeading: {
    fontSize: 26,
    fontWeight: '400',
    lineHeight: 31,
    marginBottom: 14,
    letterSpacing: -0.2,
  },
  greetingBold: {
    fontWeight: '700',
  },
  recRow: {
    backgroundColor: 'rgba(255,255,255,0.62)',
    borderRadius: radii.lg,
    paddingVertical: 11,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
  },
  recIco: {
    width: 38,
    height: 38,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recInfo: {
    flex: 1,
  },
  recLabel: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  recMeta: {
    fontSize: 12,
    marginTop: 4,
    letterSpacing: 0.4,
  },
  brewBtn: {
    height: 36,
    borderRadius: radii.full,
  },
  brewBtnLabel: {
    fontSize: 13,
    marginVertical: 0,
  },

  /* TILE 2: Stat tiles */
  tileStat: {
    borderRadius: radii.xl,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 16,
  },
  statIcoWrap: {
    width: 30,
    height: 30,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statNum: {
    fontSize: 32,
    fontWeight: '600',
    lineHeight: 32,
    marginBottom: 3,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '500',
    opacity: 0.7,
    letterSpacing: 0.3,
  },

  /* Warning tile */
  tileStatWarn: {
    borderRadius: radii.xl,
    padding: 14,
    justifyContent: 'center',
    gap: 4,
  },
  warnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 5,
  },
  warnTitle: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  warnBody: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 17,
  },

  /* TILE 3: Taste Profile */
  tileTaste: {
    borderRadius: radii.xl,
    padding: 16,
    borderWidth: 1,
  },
  tasteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  userAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  tasteHeaderInfo: {
    flex: 1,
  },
  tasteHeaderSub: {
    fontSize: 12,
    marginTop: 4,
    letterSpacing: 0.4,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.3,
  },

  /* Taste bars */
  tasteBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  tasteLbl: {
    width: 60,
    fontSize: 12,
    fontWeight: '500',
  },
  tasteTrack: {
    height: 5,
    borderRadius: 3,
    flex: 1,
    overflow: 'hidden',
  },
  tasteFill: {
    height: '100%',
    borderRadius: 3,
  },
  tasteVal: {
    width: 26,
    textAlign: 'right',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  /* Chips */
  chipsSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: radii.full,
  },
  chipOutlined: {
    borderRadius: radii.full,
    backgroundColor: 'transparent',
  },

  /* TILE 4: Coffee Cards scroll */
  tileScroll: {
    borderRadius: radii.xl,
    paddingVertical: 14,
    overflow: 'hidden',
    borderWidth: 1,
  },
  tileScrollHeader: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hScroll: {
    gap: 8,
    paddingHorizontal: 16,
  },
  scrollLoader: {
    padding: spacing.lg,
  },
  emptyScroll: {
    padding: spacing.lg,
    alignItems: 'center',
  },

  /* Coffee tile */
  cofTile: {
    width: 124,
    borderRadius: radii.lg,
    padding: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cofTileTop: {
    height: 3,
    position: 'absolute',
    top: 0,
    left: 14,
    right: 14,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  cofTileIco: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    marginTop: 4,
  },
  cofTileSub: {
    fontSize: 12,
    marginTop: 4,
    letterSpacing: 0.4,
  },
  pbar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 8,
  },
  pbarFill: {
    height: '100%',
    borderRadius: 2,
  },
  cofPct: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  badgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.sm,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  badgeSmallText: {
    fontSize: 11,
    fontWeight: '500',
  },
  linkText: {
    fontSize: 13,
    fontWeight: '500',
  },

  /* TILE 5: Action tiles */
  tileAction: {
    borderRadius: radii.xl,
    padding: 15,
    gap: 8,
    minHeight: 130,
    overflow: 'hidden',
  },
  actIcoWrap: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actTitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  actSub: {
    fontSize: 11,
    marginTop: 4,
    lineHeight: 15,
  },
  actArrow: {
    alignItems: 'flex-end',
    marginTop: 'auto',
  },
  actArrowBtn: {
    width: 30,
    height: 30,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* TILE 6: Recipes list */
  tileRecipes: {
    borderRadius: radii.xl,
    overflow: 'hidden',
    borderWidth: 1,
  },
  recipesHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  emptyRecipes: {
    padding: 16,
    alignItems: 'center',
  },
  recipeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  recipeDivider: {
    height: 1,
    marginHorizontal: 16,
  },
  recipeLead: {
    width: 42,
    height: 42,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipeInfo: {
    flex: 1,
  },
  recipeMeta: {
    fontSize: 12,
    marginTop: 4,
    letterSpacing: 0.4,
  },

  /* Bottom spacer */
  bottomSpacer: {
    height: 2,
    width: '100%',
  },

  /* Error banner */
  errorBanner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
});

export default HomeScreen;
