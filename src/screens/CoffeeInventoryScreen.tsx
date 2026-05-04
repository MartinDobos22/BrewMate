import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { apiFetch, DEFAULT_API_HOST } from '../utils/api';
import BottomNavBar from '../components/BottomNavBar';
import { useTheme } from '../theme/useTheme';
import { elevation } from '../theme/theme';
import { CoffeeBeanIcon } from '../components/icons';
import { Chip, MD3Button } from '../components/md3';
import { BOTTOM_NAV_SAFE_PADDING } from '../constants/ui';
import { useSignedImageUrl } from '../hooks/useSignedImageUrl';

type InventoryStatus = 'active' | 'empty' | 'archived';
type TrackingMode = 'manual' | 'estimated';
type BrewMethod = 'espresso' | 'filter' | 'other';

type InventoryItem = {
  id: string;
  rawText: string | null;
  correctedText: string | null;
  coffeeProfile: {
    tasteProfile?: string;
    laymanSummary?: string;
    flavorNotes?: string[];
  };
  aiMatchResult: {
    matchScore?: number;
    matchTier?: string;
    laymanSummary?: string;
  } | null;
  labelImageBase64: string | null;
  hasImage?: boolean;
  loved: boolean;
  packageSizeG: number | null;
  remainingG: number | null;
  openedAt: string | null;
  status: InventoryStatus;
  trackingMode: TrackingMode;
  preferredDoseG: number | null;
  brewMethodDefault: BrewMethod | null;
  lastConsumedAt: string | null;
  createdAt: string;
};

const QUICK_DOSES = [10, 15, 18, 20];

const STATUS_CHIP_ROLE = {
  active: 'primary',
  empty: 'neutral',
  archived: 'secondary',
} as const;

type ThumbnailStyles = {
  thumbnail: object;
  thumbnailPlaceholder: object;
  thumbnailInitial: object;
};

function InventoryRowThumbnail({
  itemId,
  hasImage,
  initial,
  styles,
}: {
  itemId: string;
  hasImage: boolean;
  initial: string;
  styles: ThumbnailStyles;
}) {
  const { uri, handleImageError } = useSignedImageUrl(hasImage ? itemId : null);

  if (hasImage && uri) {
    return (
      <Image
        source={{ uri }}
        style={styles.thumbnail}
        onError={handleImageError}
        accessibilityIgnoresInvertColors
      />
    );
  }

  return (
    <View
      style={styles.thumbnailPlaceholder}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <Text style={styles.thumbnailInitial}>{initial}</Text>
    </View>
  );
}

function CoffeeInventoryScreen() {
  const { colors, typescale, shape, stateLayer } = useTheme();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    'idle',
  );
  const [errorMessage, setErrorMessage] = useState('');
  const [activeFilter, setActiveFilter] = useState<InventoryStatus>('active');
  const [customDoseById, setCustomDoseById] = useState<Record<string, string>>(
    {},
  );
  const [customRemainingById, setCustomRemainingById] = useState<
    Record<string, string>
  >({});

  // ---------------------------------------------------------------------------
  // Data loading & mutations (unchanged logic)
  // ---------------------------------------------------------------------------

  const loadInventory = useCallback(async () => {
    setState('loading');
    setErrorMessage('');

    try {
      const response = await apiFetch(
        `${DEFAULT_API_HOST}/api/user-coffee?includeInactive=true`,
        {
          method: 'GET',
          credentials: 'include',
        },
        {
          feature: 'CoffeeInventory',
          action: 'load',
        },
      );

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || 'Nepodarilo sa načítať inventár.');
      }

      setItems(Array.isArray(payload?.items) ? payload.items : []);
      setState('ready');
    } catch (error) {
      setState('error');
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Nepodarilo sa načítať inventár.',
      );
    }
  }, []);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  const replaceItem = useCallback((item: InventoryItem) => {
    setItems(current =>
      current.map(existing => (existing.id === item.id ? item : existing)),
    );
  }, []);

  const handleDelete = useCallback((id: string) => {
    Alert.alert('Vymazať kávu?', 'Táto káva sa natrvalo odstráni.', [
      { text: 'Zrušiť', style: 'cancel' },
      {
        text: 'Vymazať',
        style: 'destructive',
        onPress: async () => {
          try {
            const response = await apiFetch(
              `${DEFAULT_API_HOST}/api/user-coffee/${id}`,
              {
                method: 'DELETE',
                credentials: 'include',
              },
              {
                feature: 'CoffeeInventory',
                action: 'delete',
              },
            );

            if (!response.ok) {
              const payload = await response.json().catch(() => null);
              throw new Error(payload?.error || 'Nepodarilo sa vymazať kávu.');
            }

            setItems(current => current.filter(item => item.id !== id));
          } catch (error) {
            Alert.alert(
              'Chyba',
              error instanceof Error
                ? error.message
                : 'Nepodarilo sa vymazať kávu.',
            );
          }
        },
      },
    ]);
  }, []);

  const handleLovedChange = useCallback(async (id: string, loved: boolean) => {
    try {
      const response = await apiFetch(
        `${DEFAULT_API_HOST}/api/user-coffee/${id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ loved }),
        },
        {
          feature: 'CoffeeInventory',
          action: 'update-loved',
        },
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(
          payload?.error || 'Nepodarilo sa upraviť hodnotenie kávy.',
        );
      }

      setItems(current =>
        current.map(item => (item.id === id ? { ...item, loved } : item)),
      );
    } catch (error) {
      Alert.alert(
        'Chyba',
        error instanceof Error
          ? error.message
          : 'Nepodarilo sa upraviť hodnotenie kávy.',
      );
    }
  }, []);

  const handleConsume = useCallback(
    async (
      item: InventoryItem,
      consumedG: number,
      source: 'quick_action' | 'custom',
    ) => {
      try {
        const response = await apiFetch(
          `${DEFAULT_API_HOST}/api/user-coffee/${item.id}/consume`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
              consumedG,
              source,
              brewMethod: item.brewMethodDefault ?? 'other',
              preferredDoseG: source === 'quick_action' ? consumedG : null,
            }),
          },
          {
            feature: 'CoffeeInventory',
            action: 'consume',
          },
        );

        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(
            payload?.error || 'Nepodarilo sa aktualizovať spotrebu.',
          );
        }

        if (payload?.item) {
          replaceItem(payload.item);
        }
      } catch (error) {
        Alert.alert(
          'Chyba',
          error instanceof Error
            ? error.message
            : 'Nepodarilo sa aktualizovať spotrebu.',
        );
      }
    },
    [replaceItem],
  );

  const handleCustomConsume = useCallback(
    async (item: InventoryItem) => {
      const value = customDoseById[item.id] ?? '';
      const parsed = Number.parseInt(value, 10);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        Alert.alert('Chyba', 'Zadaj kladné číslo gramov.');
        return;
      }

      await handleConsume(item, parsed, 'custom');
      setCustomDoseById(current => ({ ...current, [item.id]: '' }));
    },
    [customDoseById, handleConsume],
  );

  const handleRemainingUpdate = useCallback(
    async (item: InventoryItem) => {
      const value = customRemainingById[item.id] ?? '';
      const parsed = Number.parseInt(value, 10);
      if (!Number.isInteger(parsed) || parsed < 0) {
        Alert.alert('Chyba', 'Zadaj nezáporné číslo gramov.');
        return;
      }

      try {
        const response = await apiFetch(
          `${DEFAULT_API_HOST}/api/user-coffee/${item.id}/remaining`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ remainingG: parsed, source: 'slider' }),
          },
          {
            feature: 'CoffeeInventory',
            action: 'update-remaining',
          },
        );

        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(
            payload?.error || 'Nepodarilo sa upraviť zostávajúce gramy.',
          );
        }

        if (payload?.item) {
          replaceItem(payload.item);
        }

        setCustomRemainingById(current => ({ ...current, [item.id]: '' }));
      } catch (error) {
        Alert.alert(
          'Chyba',
          error instanceof Error
            ? error.message
            : 'Nepodarilo sa upraviť zostávajúce gramy.',
        );
      }
    },
    [customRemainingById, replaceItem],
  );

  const handleStatusChange = useCallback(
    async (item: InventoryItem, status: InventoryStatus) => {
      try {
        const response = await apiFetch(
          `${DEFAULT_API_HOST}/api/user-coffee/${item.id}/status`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ status }),
          },
          {
            feature: 'CoffeeInventory',
            action: `status-${status}`,
          },
        );

        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(
            payload?.error || 'Nepodarilo sa upraviť stav položky.',
          );
        }

        if (payload?.item) {
          replaceItem(payload.item);
        }
      } catch (error) {
        Alert.alert(
          'Chyba',
          error instanceof Error
            ? error.message
            : 'Nepodarilo sa upraviť stav položky.',
        );
      }
    },
    [replaceItem],
  );

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const totalsByStatus = useMemo(
    () => ({
      active: items.filter(item => item.status === 'active').length,
      empty: items.filter(item => item.status === 'empty').length,
      archived: items.filter(item => item.status === 'archived').length,
    }),
    [items],
  );

  const renderedItems = useMemo(
    () => items.filter(item => item.status === activeFilter),
    [activeFilter, items],
  );

  const filterLabel = useMemo(() => {
    if (activeFilter === 'active') return 'Aktívne';
    if (activeFilter === 'empty') return 'Dopité';
    return 'Archivované';
  }, [activeFilter]);

  const totalAvailableG = useMemo(
    () =>
      items
        .filter(
          item =>
            item.status === 'active' && typeof item.remainingG === 'number',
        )
        .reduce((sum, item) => sum + (item.remainingG ?? 0), 0),
    [items],
  );

  const lowStockCount = useMemo(
    () =>
      items.filter(
        item =>
          item.status === 'active' &&
          typeof item.remainingG === 'number' &&
          item.remainingG <= 60,
      ).length,
    [items],
  );

  // ---------------------------------------------------------------------------
  // Styles
  // ---------------------------------------------------------------------------

  const s = useMemo(
    () =>
      StyleSheet.create({
        safeArea: {
          flex: 1,
          backgroundColor: colors.background,
        },
        container: {
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: BOTTOM_NAV_SAFE_PADDING + 24,
          backgroundColor: colors.background,
        },
        // Hero card
        heroCard: {
          borderRadius: shape.extraLarge,
          padding: 20,
          marginBottom: 14,
          backgroundColor: colors.primaryContainer,
          ...elevation.level1.shadow,
        },
        heroIconRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginBottom: 10,
        },
        overline: {
          ...typescale.labelMedium,
          letterSpacing: 1,
          textTransform: 'uppercase',
          color: colors.onPrimaryContainer,
          opacity: 0.85,
        },
        title: {
          ...typescale.headlineMedium,
          color: colors.onPrimaryContainer,
        },
        subtitle: {
          ...typescale.bodyMedium,
          marginTop: 8,
          color: colors.onPrimaryContainer,
          opacity: 0.82,
          lineHeight: 22,
        },
        heroStatsRow: {
          marginTop: 16,
          flexDirection: 'row',
          gap: 8,
        },
        heroStatPill: {
          flex: 1,
          borderRadius: shape.medium,
          backgroundColor: colors.surfaceContainerLowest,
          paddingVertical: 10,
          paddingHorizontal: 8,
          alignItems: 'center',
        },
        heroStatValue: {
          ...typescale.titleMedium,
          color: colors.onSurface,
        },
        heroStatLabel: {
          ...typescale.labelSmall,
          marginTop: 2,
          color: colors.onSurfaceVariant,
        },
        // Section card / filter
        sectionCard: {
          borderRadius: shape.extraLarge,
          padding: 16,
          marginBottom: 14,
          backgroundColor: colors.surfaceContainerLow,
          ...elevation.level1.shadow,
        },
        sectionHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        },
        sectionTitle: {
          ...typescale.titleLarge,
          color: colors.onSurface,
        },
        filterTabs: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 8,
        },
        filterButton: {
          borderWidth: 1,
          borderColor: colors.outline,
          borderRadius: shape.full,
          paddingVertical: 8,
          paddingHorizontal: 14,
          backgroundColor: colors.surfaceContainerLowest,
        },
        filterButtonActive: {
          backgroundColor: colors.primary,
          borderColor: colors.primary,
        },
        filterButtonText: {
          ...typescale.labelLarge,
          color: colors.onSurfaceVariant,
        },
        filterButtonTextActive: {
          color: colors.onPrimary,
        },
        caption: {
          ...typescale.bodySmall,
          color: colors.onSurfaceVariant,
        },
        error: {
          ...typescale.bodySmall,
          color: colors.error,
          marginTop: 8,
        },
        empty: {
          ...typescale.bodyMedium,
          color: colors.onSurfaceVariant,
          lineHeight: 22,
        },
        // Item card
        itemCard: {
          borderRadius: shape.extraLarge,
          padding: 16,
          marginBottom: 12,
          backgroundColor: colors.surfaceContainerLow,
          ...elevation.level1.shadow,
        },
        itemHeader: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10,
          gap: 8,
        },
        thumbnail: {
          width: 56,
          height: 56,
          borderRadius: 8,
          backgroundColor: colors.surfaceContainerHighest,
        },
        thumbnailPlaceholder: {
          width: 56,
          height: 56,
          borderRadius: 8,
          backgroundColor: colors.surfaceContainerHighest,
          alignItems: 'center',
          justifyContent: 'center',
        },
        thumbnailInitial: {
          ...typescale.titleMedium,
          color: colors.onSurfaceVariant,
        },
        itemTitleWrap: {
          flex: 1,
        },
        itemTitle: {
          ...typescale.titleMedium,
          color: colors.onSurface,
        },
        date: {
          ...typescale.bodySmall,
          color: colors.onSurfaceVariant,
          marginTop: 3,
        },
        // Meta grid
        metaGrid: {
          flexDirection: 'row',
          gap: 8,
          marginBottom: 8,
        },
        metaTile: {
          flex: 1,
          borderRadius: shape.medium,
          backgroundColor: colors.surfaceContainerLowest,
          paddingVertical: 8,
          paddingHorizontal: 10,
        },
        metaLabel: {
          ...typescale.labelSmall,
          color: colors.onSurfaceVariant,
        },
        metaValue: {
          ...typescale.labelLarge,
          marginTop: 3,
          color: colors.onSurface,
        },
        // Taste profile
        label: {
          ...typescale.labelLarge,
          color: colors.primary,
          marginTop: 10,
        },
        text: {
          ...typescale.bodyMedium,
          color: colors.onSurface,
          marginTop: 4,
        },
        // Quick actions
        quickActionsWrap: {
          marginTop: 10,
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
        },
        quickAction: {
          borderRadius: shape.full,
          paddingVertical: 8,
          paddingHorizontal: 14,
          backgroundColor: colors.secondaryContainer,
        },
        quickActionPressed: {
          opacity: 1 - stateLayer.pressed,
        },
        quickActionText: {
          ...typescale.labelLarge,
          color: colors.onSecondaryContainer,
        },
        // Inline inputs
        inlineRow: {
          marginTop: 10,
          flexDirection: 'row',
          gap: 8,
        },
        input: {
          flex: 1,
          borderWidth: 1,
          borderColor: colors.outlineVariant,
          borderRadius: shape.large,
          paddingHorizontal: 12,
          paddingVertical: 10,
          ...typescale.bodyMedium,
          color: colors.onSurface,
          backgroundColor: colors.surfaceContainerLowest,
        },
        // Actions
        actions: {
          marginTop: 14,
          gap: 8,
        },
        badge: {
          backgroundColor: colors.surfaceContainer,
          paddingVertical: 10,
          paddingHorizontal: 12,
          borderRadius: shape.full,
          alignItems: 'center',
        },
        badgeActive: {
          backgroundColor: colors.tertiaryContainer,
        },
        badgeText: {
          ...typescale.labelLarge,
          color: colors.onSurface,
        },
        badgeTextActive: {
          color: colors.onTertiaryContainer,
        },
      }),
    [colors, shape, stateLayer.pressed, typescale],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView style={s.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.container}>
        {/* Hero card */}
        <View style={s.heroCard}>
          <View style={s.heroIconRow}>
            <CoffeeBeanIcon size={22} color={colors.onPrimaryContainer} />
            <Text style={s.overline}>BrewMate Inventory</Text>
          </View>
          <Text style={s.title}>Tvoj coffee inventár</Text>
          <Text style={s.subtitle}>
            Sleduj zásoby, dávkovanie a stav balíkov na jednom mieste.
          </Text>

          <View style={s.heroStatsRow}>
            <View style={s.heroStatPill}>
              <Text style={s.heroStatValue}>{totalsByStatus.active}</Text>
              <Text style={s.heroStatLabel}>Aktívne</Text>
            </View>
            <View style={s.heroStatPill}>
              <Text style={s.heroStatValue}>{totalAvailableG} g</Text>
              <Text style={s.heroStatLabel}>Dostupné</Text>
            </View>
            <View style={s.heroStatPill}>
              <Text style={s.heroStatValue}>{lowStockCount}</Text>
              <Text style={s.heroStatLabel}>Nízka zásoba</Text>
            </View>
          </View>
        </View>

        {/* Filter section */}
        <View style={s.sectionCard}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Filtre inventára</Text>
            {state === 'loading' ? (
              <ActivityIndicator color={colors.primary} />
            ) : null}
          </View>

          <View style={s.filterTabs}>
            {(['active', 'empty', 'archived'] as const).map(filter => {
              const isActive = activeFilter === filter;
              const label =
                filter === 'active'
                  ? `Aktívne (${totalsByStatus.active})`
                  : filter === 'empty'
                  ? `Dopité (${totalsByStatus.empty})`
                  : `Archivované (${totalsByStatus.archived})`;
              return (
                <Pressable
                  key={filter}
                  style={[s.filterButton, isActive && s.filterButtonActive]}
                  onPress={() => setActiveFilter(filter)}
                >
                  <Text
                    style={[
                      s.filterButtonText,
                      isActive && s.filterButtonTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={s.caption}>Zobrazená kategória: {filterLabel}</Text>
          {state === 'error' ? (
            <Text style={s.error}>{errorMessage}</Text>
          ) : null}
        </View>

        {/* Empty state */}
        {state === 'ready' && renderedItems.length === 0 ? (
          <View style={s.sectionCard}>
            <Text style={s.empty}>
              V kategórii {filterLabel.toLowerCase()} zatiaľ nemáš žiadne kávy.
            </Text>
          </View>
        ) : null}

        {/* Item cards */}
        {renderedItems.map(item => {
          const remainingLabel =
            item.remainingG === null
              ? 'Odhad bez gramov'
              : `${item.remainingG} g`;
          const packageLabel =
            item.packageSizeG === null ? 'Nezadaná' : `${item.packageSizeG} g`;
          const statusLabel =
            item.status === 'active'
              ? 'Aktívna'
              : item.status === 'empty'
              ? 'Prázdna'
              : 'Archivovaná';
          const itemName = item.correctedText || item.rawText || 'Neznáma káva';

          const initial = (itemName.trim().charAt(0) || '?').toUpperCase();

          return (
            <View key={item.id} style={s.itemCard}>
              <View style={s.itemHeader}>
                <InventoryRowThumbnail
                  itemId={item.id}
                  hasImage={Boolean(item.hasImage)}
                  initial={initial}
                  styles={{
                    thumbnail: s.thumbnail,
                    thumbnailPlaceholder: s.thumbnailPlaceholder,
                    thumbnailInitial: s.thumbnailInitial,
                  }}
                />
                <View style={s.itemTitleWrap}>
                  <Text style={s.itemTitle}>{itemName}</Text>
                  <Text style={s.date}>
                    Uložené:{' '}
                    {new Date(item.createdAt).toLocaleDateString('sk-SK')}
                  </Text>
                </View>
                <Chip
                  role={STATUS_CHIP_ROLE[item.status]}
                  label={statusLabel}
                />
              </View>

              <View style={s.metaGrid}>
                <View style={s.metaTile}>
                  <Text style={s.metaLabel}>Balík</Text>
                  <Text style={s.metaValue}>{packageLabel}</Text>
                </View>
                <View style={s.metaTile}>
                  <Text style={s.metaLabel}>Zostáva</Text>
                  <Text style={s.metaValue}>{remainingLabel}</Text>
                </View>
                <View style={s.metaTile}>
                  <Text style={s.metaLabel}>Tracking</Text>
                  <Text style={s.metaValue}>
                    {item.trackingMode === 'manual' ? 'Manuálny' : 'Odhadovaný'}
                  </Text>
                </View>
              </View>

              <Text style={s.label}>Chuťový profil</Text>
              <Text style={s.text}>
                {item.coffeeProfile?.tasteProfile || 'Neuvedené'}
              </Text>
              {item.coffeeProfile?.flavorNotes?.length ? (
                <Text style={s.text}>
                  Tóny: {item.coffeeProfile.flavorNotes.join(', ')}
                </Text>
              ) : null}

              <Text style={s.label}>Rýchle odpočítanie</Text>
              <View style={s.quickActionsWrap}>
                {[
                  item.preferredDoseG &&
                  !QUICK_DOSES.includes(item.preferredDoseG)
                    ? item.preferredDoseG
                    : null,
                  ...QUICK_DOSES,
                ]
                  .filter((dose): dose is number => Boolean(dose))
                  .slice(0, 4)
                  .map(dose => (
                    <Pressable
                      key={`${item.id}-${dose}`}
                      style={({ pressed }) => [
                        s.quickAction,
                        pressed && s.quickActionPressed,
                      ]}
                      onPress={() => handleConsume(item, dose, 'quick_action')}
                    >
                      <Text style={s.quickActionText}>-{dose} g</Text>
                    </Pressable>
                  ))}
              </View>

              <View style={s.inlineRow}>
                <TextInput
                  style={s.input}
                  value={customDoseById[item.id] ?? ''}
                  onChangeText={value =>
                    setCustomDoseById(current => ({
                      ...current,
                      [item.id]: value,
                    }))
                  }
                  placeholder="Custom minus g"
                  placeholderTextColor={colors.onSurfaceVariant}
                  keyboardType="number-pad"
                />
                <MD3Button
                  label="Odpočítať"
                  variant="tonal"
                  onPress={() => handleCustomConsume(item)}
                />
              </View>

              <View style={s.inlineRow}>
                <TextInput
                  style={s.input}
                  value={customRemainingById[item.id] ?? ''}
                  onChangeText={value =>
                    setCustomRemainingById(current => ({
                      ...current,
                      [item.id]: value,
                    }))
                  }
                  placeholder="Nastaviť zostávajúce g"
                  placeholderTextColor={colors.onSurfaceVariant}
                  keyboardType="number-pad"
                />
                <MD3Button
                  label="Uložiť"
                  variant="tonal"
                  onPress={() => handleRemainingUpdate(item)}
                />
              </View>

              <View style={s.actions}>
                <Pressable
                  style={[s.badge, item.loved && s.badgeActive]}
                  onPress={() => handleLovedChange(item.id, !item.loved)}
                >
                  <Text style={[s.badgeText, item.loved && s.badgeTextActive]}>
                    {item.loved ? 'Fantastická ⭐' : 'Označiť ako fantastickú'}
                  </Text>
                </Pressable>

                <MD3Button
                  label="Balík je prázdny"
                  variant="filled"
                  onPress={() => handleStatusChange(item, 'empty')}
                />

                {item.status === 'archived' ? (
                  <MD3Button
                    label="Vrátiť do aktívnych"
                    variant="filled"
                    onPress={() => handleStatusChange(item, 'active')}
                  />
                ) : (
                  <MD3Button
                    label="Archivovať"
                    variant="outlined"
                    onPress={() => handleStatusChange(item, 'archived')}
                  />
                )}

                <MD3Button
                  label="Vymazať natrvalo"
                  variant="filled"
                  style={{ backgroundColor: colors.error }}
                  onPress={() => handleDelete(item.id)}
                />
              </View>
            </View>
          );
        })}
      </ScrollView>
      <BottomNavBar />
    </SafeAreaView>
  );
}

export default CoffeeInventoryScreen;
