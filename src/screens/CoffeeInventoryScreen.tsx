import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  Divider,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';

import { apiFetch, DEFAULT_API_HOST } from '../utils/api';
import spacing, { radii } from '../styles/spacing';

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
    willLike?: boolean;
    laymanSummary?: string;
  } | null;
  labelImageBase64: string | null;
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

function CoffeeInventoryScreen() {
  const theme = useTheme<MD3Theme>();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [activeFilter, setActiveFilter] = useState<InventoryStatus>('active');
  const [customDoseById, setCustomDoseById] = useState<Record<string, string>>({});
  const [customRemainingById, setCustomRemainingById] = useState<Record<string, string>>({});

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
      setErrorMessage(error instanceof Error ? error.message : 'Nepodarilo sa načítať inventár.');
    }
  }, []);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  const replaceItem = useCallback((item: InventoryItem) => {
    setItems((current) => current.map((existing) => (existing.id === item.id ? item : existing)));
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

            setItems((current) => current.filter((item) => item.id !== id));
          } catch (error) {
            Alert.alert(
              'Chyba',
              error instanceof Error ? error.message : 'Nepodarilo sa vymazať kávu.',
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
        throw new Error(payload?.error || 'Nepodarilo sa upraviť hodnotenie kávy.');
      }

      setItems((current) =>
        current.map((item) => (item.id === id ? { ...item, loved } : item)),
      );
    } catch (error) {
      Alert.alert(
        'Chyba',
        error instanceof Error ? error.message : 'Nepodarilo sa upraviť hodnotenie kávy.',
      );
    }
  }, []);

  const handleConsume = useCallback(
    async (item: InventoryItem, consumedG: number, source: 'quick_action' | 'custom') => {
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
          throw new Error(payload?.error || 'Nepodarilo sa aktualizovať spotrebu.');
        }

        if (payload?.item) {
          replaceItem(payload.item);
        }
      } catch (error) {
        Alert.alert(
          'Chyba',
          error instanceof Error ? error.message : 'Nepodarilo sa aktualizovať spotrebu.',
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
      setCustomDoseById((current) => ({ ...current, [item.id]: '' }));
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
          throw new Error(payload?.error || 'Nepodarilo sa upraviť zostávajúce gramy.');
        }

        if (payload?.item) {
          replaceItem(payload.item);
        }

        setCustomRemainingById((current) => ({ ...current, [item.id]: '' }));
      } catch (error) {
        Alert.alert(
          'Chyba',
          error instanceof Error ? error.message : 'Nepodarilo sa upraviť zostávajúce gramy.',
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
          throw new Error(payload?.error || 'Nepodarilo sa upraviť stav položky.');
        }

        if (payload?.item) {
          replaceItem(payload.item);
        }
      } catch (error) {
        Alert.alert(
          'Chyba',
          error instanceof Error ? error.message : 'Nepodarilo sa upraviť stav položky.',
        );
      }
    },
    [replaceItem],
  );

  const totalsByStatus = useMemo(
    () => ({
      active: items.filter((item) => item.status === 'active').length,
      empty: items.filter((item) => item.status === 'empty').length,
      archived: items.filter((item) => item.status === 'archived').length,
    }),
    [items],
  );

  const renderedItems = useMemo(
    () => items.filter((item) => item.status === activeFilter),
    [activeFilter, items],
  );

  const filterLabel = useMemo(() => {
    if (activeFilter === 'active') {
      return 'Aktívne';
    }
    if (activeFilter === 'empty') {
      return 'Dopité';
    }
    return 'Archivované';
  }, [activeFilter]);

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      edges={['bottom']}
    >
      <ScrollView
        style={[styles.scroll, { backgroundColor: theme.colors.background }]}
        contentContainerStyle={styles.container}
      >
        <Text variant="headlineMedium" style={styles.title}>
          Coffee inventár
        </Text>

        {/* Filter Chips */}
        <View style={styles.filterRow}>
          <Chip
            selected={activeFilter === 'active'}
            onPress={() => setActiveFilter('active')}
            style={styles.filterChip}
            showSelectedCheck={false}
          >
            Aktívne ({totalsByStatus.active})
          </Chip>
          <Chip
            selected={activeFilter === 'empty'}
            onPress={() => setActiveFilter('empty')}
            style={styles.filterChip}
            showSelectedCheck={false}
          >
            Dopité ({totalsByStatus.empty})
          </Chip>
          <Chip
            selected={activeFilter === 'archived'}
            onPress={() => setActiveFilter('archived')}
            style={styles.filterChip}
            showSelectedCheck={false}
          >
            Archivované ({totalsByStatus.archived})
          </Chip>
        </View>

        {/* Loading state */}
        {state === 'loading' ? (
          <ActivityIndicator
            animating
            color={theme.colors.primary}
            style={styles.loader}
          />
        ) : null}

        {/* Error state */}
        {state === 'error' ? (
          <Text variant="bodyMedium" style={{ color: theme.colors.error }}>
            {errorMessage}
          </Text>
        ) : null}

        <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          Zobrazená kategória: {filterLabel}
        </Text>

        {/* Empty state */}
        {state === 'ready' && renderedItems.length === 0 ? (
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            V kategórii {filterLabel.toLowerCase()} zatiaľ nemáš žiadne kávy.
          </Text>
        ) : null}

        {/* Item cards */}
        {renderedItems.map((item) => {
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

          return (
            <Card
              key={item.id}
              mode="contained"
              style={[styles.card, { backgroundColor: theme.colors.surfaceVariant }]}
            >
              <Card.Content style={styles.cardContent}>
                {/* Date */}
                <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                  Uložené: {new Date(item.createdAt).toLocaleDateString('sk-SK')}
                </Text>

                {/* Meta info block */}
                <View
                  style={[
                    styles.metaBlock,
                    { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant },
                  ]}
                >
                  <View style={styles.metaRow}>
                    <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                      Stav
                    </Text>
                    <Text variant="labelLarge" style={{ color: theme.colors.onSurface }}>
                      {statusLabel}
                    </Text>
                  </View>
                  <Divider style={{ backgroundColor: theme.colors.outlineVariant }} />
                  <View style={styles.metaRow}>
                    <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                      Balík
                    </Text>
                    <Text variant="labelLarge" style={{ color: theme.colors.onSurface }}>
                      {packageLabel}
                    </Text>
                  </View>
                  <Divider style={{ backgroundColor: theme.colors.outlineVariant }} />
                  <View style={styles.metaRow}>
                    <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                      Zostáva
                    </Text>
                    <Text variant="labelLarge" style={{ color: theme.colors.onSurface }}>
                      {remainingLabel}
                    </Text>
                  </View>
                  <Divider style={{ backgroundColor: theme.colors.outlineVariant }} />
                  <View style={styles.metaRow}>
                    <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                      Tracking
                    </Text>
                    <Text variant="labelLarge" style={{ color: theme.colors.onSurface }}>
                      {item.trackingMode === 'manual' ? 'Manual' : 'Estimated'}
                    </Text>
                  </View>
                </View>

                {/* Taste profile */}
                <Text
                  variant="labelMedium"
                  style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}
                >
                  CHUŤOVÝ PROFIL
                </Text>
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
                  {item.coffeeProfile?.tasteProfile || 'Neuvedené'}
                </Text>
                {item.coffeeProfile?.flavorNotes?.length ? (
                  <Text
                    variant="bodyMedium"
                    style={[styles.flavorNotesText, { color: theme.colors.onSurface }]}
                  >
                    Tóny: {item.coffeeProfile.flavorNotes.join(', ')}
                  </Text>
                ) : null}

                {/* Quick doses */}
                <Text
                  variant="labelMedium"
                  style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}
                >
                  RÝCHLE DÁVKY
                </Text>
                <View style={styles.quickDosesRow}>
                  {[
                    item.preferredDoseG && !QUICK_DOSES.includes(item.preferredDoseG)
                      ? item.preferredDoseG
                      : null,
                    ...QUICK_DOSES,
                  ]
                    .filter((dose): dose is number => Boolean(dose))
                    .slice(0, 4)
                    .map((dose) => (
                      <Chip
                        key={`${item.id}-${dose}`}
                        onPress={() => handleConsume(item, dose, 'quick_action')}
                        style={styles.doseChip}
                        compact
                      >
                        -{dose} g
                      </Chip>
                    ))}
                </View>

                {/* Custom dose input */}
                <View style={styles.inlineRow}>
                  <TextInput
                    style={styles.inlineInput}
                    mode="outlined"
                    dense
                    value={customDoseById[item.id] ?? ''}
                    onChangeText={(value) =>
                      setCustomDoseById((current) => ({ ...current, [item.id]: value }))
                    }
                    placeholder="Custom minus g"
                    keyboardType="number-pad"
                    outlineStyle={{ borderRadius: radii.md }}
                  />
                  <Button
                    mode="contained-tonal"
                    onPress={() => handleCustomConsume(item)}
                    style={styles.inlineButton}
                    contentStyle={styles.inlineButtonContent}
                  >
                    Odpočítať
                  </Button>
                </View>

                {/* Custom remaining input */}
                <View style={styles.inlineRow}>
                  <TextInput
                    style={styles.inlineInput}
                    mode="outlined"
                    dense
                    value={customRemainingById[item.id] ?? ''}
                    onChangeText={(value) =>
                      setCustomRemainingById((current) => ({ ...current, [item.id]: value }))
                    }
                    placeholder="Nastaviť zostávajúce g"
                    keyboardType="number-pad"
                    outlineStyle={{ borderRadius: radii.md }}
                  />
                  <Button
                    mode="contained-tonal"
                    onPress={() => handleRemainingUpdate(item)}
                    style={styles.inlineButton}
                    contentStyle={styles.inlineButtonContent}
                  >
                    Uložiť
                  </Button>
                </View>

                <Divider
                  style={[styles.actionDivider, { backgroundColor: theme.colors.outlineVariant }]}
                />

                {/* Action buttons */}
                <View style={styles.actionsBlock}>
                  <Button
                    mode={item.loved ? 'contained' : 'outlined'}
                    onPress={() => handleLovedChange(item.id, !item.loved)}
                    style={styles.actionButton}
                    buttonColor={item.loved ? theme.colors.primaryContainer : undefined}
                    textColor={item.loved ? theme.colors.onPrimaryContainer : theme.colors.primary}
                  >
                    {item.loved ? 'Fantastická ⭐' : 'Označiť ako fantastickú'}
                  </Button>

                  <Button
                    mode="contained-tonal"
                    onPress={() => handleStatusChange(item, 'empty')}
                    style={styles.actionButton}
                  >
                    Balík je prázdny
                  </Button>

                  {item.status === 'archived' ? (
                    <Button
                      mode="contained-tonal"
                      onPress={() => handleStatusChange(item, 'active')}
                      style={styles.actionButton}
                    >
                      Vrátiť do aktívnych
                    </Button>
                  ) : (
                    <Button
                      mode="contained-tonal"
                      onPress={() => handleStatusChange(item, 'archived')}
                      style={styles.actionButton}
                    >
                      Archivovať
                    </Button>
                  )}

                  <Button
                    mode="contained"
                    onPress={() => handleDelete(item.id)}
                    style={styles.actionButton}
                    buttonColor={theme.colors.error}
                    textColor={theme.colors.onPrimary}
                  >
                    Vymazať natrvalo
                  </Button>
                </View>
              </Card.Content>
            </Card>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  container: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  title: {
    marginBottom: spacing.xs,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  filterChip: {
    // Chip handles selected state styling via react-native-paper theme
  },
  loader: {
    marginVertical: spacing.sm,
  },
  card: {
    borderRadius: radii.lg,
  },
  cardContent: {
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  metaBlock: {
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: 'hidden',
    marginVertical: spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm + spacing.xs,
    paddingHorizontal: spacing.md,
  },
  sectionLabel: {
    marginTop: spacing.xs,
    letterSpacing: 0.5,
  },
  flavorNotesText: {
    marginTop: spacing.xs,
  },
  quickDosesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  doseChip: {
    // compact chip for quick dose actions
  },
  inlineRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  inlineInput: {
    flex: 1,
  },
  inlineButton: {
    borderRadius: radii.md,
  },
  inlineButtonContent: {
    paddingHorizontal: spacing.xs,
  },
  actionDivider: {
    marginVertical: spacing.sm,
  },
  actionsBlock: {
    gap: spacing.sm,
  },
  actionButton: {
    borderRadius: radii.md,
  },
});

export default CoffeeInventoryScreen;
