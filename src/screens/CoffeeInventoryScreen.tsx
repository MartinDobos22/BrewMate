import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {apiFetch, DEFAULT_API_HOST} from '../utils/api';

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
    setItems(current => current.map(existing => (existing.id === item.id ? item : existing)));
  }, []);

  const handleDelete = useCallback((id: string) => {
    Alert.alert('Vymazať kávu?', 'Táto káva sa natrvalo odstráni.', [
      {text: 'Zrušiť', style: 'cancel'},
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
          body: JSON.stringify({loved}),
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

      setItems(current => current.map(item => (item.id === id ? {...item, loved} : item)));
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
      setCustomDoseById(current => ({...current, [item.id]: ''}));
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
            body: JSON.stringify({remainingG: parsed, source: 'slider'}),
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

        setCustomRemainingById(current => ({...current, [item.id]: ''}));
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
            body: JSON.stringify({status}),
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
    if (activeFilter === 'active') {
      return 'Aktívne';
    }
    if (activeFilter === 'empty') {
      return 'Dopité';
    }
    return 'Archivované';
  }, [activeFilter]);

  const totalAvailableG = useMemo(
    () =>
      items
        .filter(item => item.status === 'active' && typeof item.remainingG === 'number')
        .reduce((sum, item) => sum + (item.remainingG ?? 0), 0),
    [items],
  );

  const lowStockCount = useMemo(
    () =>
      items.filter(
        item => item.status === 'active' && typeof item.remainingG === 'number' && item.remainingG <= 60,
      ).length,
    [items],
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.heroCard}>
          <View style={styles.heroDecor}>
            <Text style={styles.heroDecorIcon}>🧺</Text>
            <Text style={styles.heroDecorIcon}>🫘</Text>
          </View>
          <Text style={styles.overline}>BrewMate Inventory</Text>
          <Text style={styles.title}>Tvoj coffee inventár</Text>
          <Text style={styles.subtitle}>Sleduj zásoby, dávkovanie a stav balíkov na jednom mieste.</Text>

          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatPill}>
              <Text style={styles.heroStatValue}>{totalsByStatus.active}</Text>
              <Text style={styles.heroStatLabel}>Aktívne</Text>
            </View>
            <View style={styles.heroStatPill}>
              <Text style={styles.heroStatValue}>{totalAvailableG} g</Text>
              <Text style={styles.heroStatLabel}>Dostupné</Text>
            </View>
            <View style={styles.heroStatPill}>
              <Text style={styles.heroStatValue}>{lowStockCount}</Text>
              <Text style={styles.heroStatLabel}>Nízka zásoba</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Filtre inventára</Text>
            {state === 'loading' ? <ActivityIndicator color="#5B4332" /> : null}
          </View>

          <View style={styles.filterTabs}>
            <Pressable
              style={[styles.filterButton, activeFilter === 'active' ? styles.filterButtonActive : null]}
              onPress={() => setActiveFilter('active')}>
              <Text
                style={[
                  styles.filterButtonText,
                  activeFilter === 'active' ? styles.filterButtonTextActive : null,
                ]}>
                Aktívne ({totalsByStatus.active})
              </Text>
            </Pressable>
            <Pressable
              style={[styles.filterButton, activeFilter === 'empty' ? styles.filterButtonActive : null]}
              onPress={() => setActiveFilter('empty')}>
              <Text
                style={[
                  styles.filterButtonText,
                  activeFilter === 'empty' ? styles.filterButtonTextActive : null,
                ]}>
                Dopité ({totalsByStatus.empty})
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.filterButton,
                activeFilter === 'archived' ? styles.filterButtonActive : null,
              ]}
              onPress={() => setActiveFilter('archived')}>
              <Text
                style={[
                  styles.filterButtonText,
                  activeFilter === 'archived' ? styles.filterButtonTextActive : null,
                ]}>
                Archivované ({totalsByStatus.archived})
              </Text>
            </Pressable>
          </View>

          <Text style={styles.caption}>Zobrazená kategória: {filterLabel}</Text>
          {state === 'error' ? <Text style={styles.error}>{errorMessage}</Text> : null}
        </View>

        {state === 'ready' && renderedItems.length === 0 ? (
          <View style={styles.sectionCard}>
            <Text style={styles.empty}>V kategórii {filterLabel.toLowerCase()} zatiaľ nemáš žiadne kávy.</Text>
          </View>
        ) : null}

        {renderedItems.map(item => {
          const remainingLabel = item.remainingG === null ? 'Odhad bez gramov' : `${item.remainingG} g`;
          const packageLabel = item.packageSizeG === null ? 'Nezadaná' : `${item.packageSizeG} g`;
          const statusLabel =
            item.status === 'active' ? 'Aktívna' : item.status === 'empty' ? 'Prázdna' : 'Archivovaná';
          const itemName = item.correctedText || item.rawText || 'Neznáma káva';

          return (
            <View key={item.id} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <View style={styles.itemTitleWrap}>
                  <Text style={styles.itemTitle}>{itemName}</Text>
                  <Text style={styles.date}>Uložené: {new Date(item.createdAt).toLocaleDateString('sk-SK')}</Text>
                </View>
                <View style={styles.statusChip}>
                  <Text style={styles.statusChipText}>{statusLabel}</Text>
                </View>
              </View>

              <View style={styles.metaGrid}>
                <View style={styles.metaTile}>
                  <Text style={styles.metaLabel}>Balík</Text>
                  <Text style={styles.metaValue}>{packageLabel}</Text>
                </View>
                <View style={styles.metaTile}>
                  <Text style={styles.metaLabel}>Zostáva</Text>
                  <Text style={styles.metaValue}>{remainingLabel}</Text>
                </View>
                <View style={styles.metaTile}>
                  <Text style={styles.metaLabel}>Tracking</Text>
                  <Text style={styles.metaValue}>
                    {item.trackingMode === 'manual' ? 'Manuálny' : 'Odhadovaný'}
                  </Text>
                </View>
              </View>

              <Text style={styles.label}>Chuťový profil</Text>
              <Text style={styles.text}>{item.coffeeProfile?.tasteProfile || 'Neuvedené'}</Text>
              {item.coffeeProfile?.flavorNotes?.length ? (
                <Text style={styles.text}>Tóny: {item.coffeeProfile.flavorNotes.join(', ')}</Text>
              ) : null}

              <Text style={styles.label}>Rýchle odpočítanie</Text>
              <View style={styles.quickActionsWrap}>
                {[
                  item.preferredDoseG && !QUICK_DOSES.includes(item.preferredDoseG)
                    ? item.preferredDoseG
                    : null,
                  ...QUICK_DOSES,
                ]
                  .filter((dose): dose is number => Boolean(dose))
                  .slice(0, 4)
                  .map(dose => (
                    <Pressable
                      key={`${item.id}-${dose}`}
                      style={styles.quickAction}
                      onPress={() => handleConsume(item, dose, 'quick_action')}>
                      <Text style={styles.quickActionText}>-{dose} g</Text>
                    </Pressable>
                  ))}
              </View>

              <View style={styles.inlineRow}>
                <TextInput
                  style={styles.input}
                  value={customDoseById[item.id] ?? ''}
                  onChangeText={value =>
                    setCustomDoseById(current => ({...current, [item.id]: value}))
                  }
                  placeholder="Custom minus g"
                  placeholderTextColor="#7B6A5B"
                  keyboardType="number-pad"
                />
                <Pressable style={styles.inlineButton} onPress={() => handleCustomConsume(item)}>
                  <Text style={styles.inlineButtonText}>Odpočítať</Text>
                </Pressable>
              </View>

              <View style={styles.inlineRow}>
                <TextInput
                  style={styles.input}
                  value={customRemainingById[item.id] ?? ''}
                  onChangeText={value =>
                    setCustomRemainingById(current => ({...current, [item.id]: value}))
                  }
                  placeholder="Nastaviť zostávajúce g"
                  placeholderTextColor="#7B6A5B"
                  keyboardType="number-pad"
                />
                <Pressable style={styles.inlineButton} onPress={() => handleRemainingUpdate(item)}>
                  <Text style={styles.inlineButtonText}>Uložiť</Text>
                </Pressable>
              </View>

              <View style={styles.actions}>
                <Pressable
                  style={[styles.badge, item.loved ? styles.badgeActive : null]}
                  onPress={() => handleLovedChange(item.id, !item.loved)}>
                  <Text style={styles.badgeText}>
                    {item.loved ? 'Fantastická ⭐' : 'Označiť ako fantastickú'}
                  </Text>
                </Pressable>

                <Pressable style={styles.statusButton} onPress={() => handleStatusChange(item, 'empty')}>
                  <Text style={styles.statusButtonText}>Balík je prázdny</Text>
                </Pressable>

                {item.status === 'archived' ? (
                  <Pressable style={styles.statusButton} onPress={() => handleStatusChange(item, 'active')}>
                    <Text style={styles.statusButtonText}>Vrátiť do aktívnych</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    style={[styles.statusButton, styles.statusButtonLight]}
                    onPress={() => handleStatusChange(item, 'archived')}>
                    <Text style={[styles.statusButtonText, styles.statusButtonTextLight]}>Archivovať</Text>
                  </Pressable>
                )}

                <Pressable style={styles.deleteButton} onPress={() => handleDelete(item.id)}>
                  <Text style={styles.deleteButtonText}>Vymazať natrvalo</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F6F1EB',
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
    backgroundColor: '#F6F1EB',
  },
  heroCard: {
    borderRadius: 30,
    padding: 20,
    marginBottom: 14,
    backgroundColor: '#EEDFCF',
    borderWidth: 1,
    borderColor: '#D7C2AB',
  },
  heroDecor: {
    position: 'absolute',
    right: 12,
    top: 8,
    flexDirection: 'row',
    gap: 6,
  },
  heroDecorIcon: {
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
  subtitle: {
    marginTop: 8,
    color: '#4C4137',
    fontSize: 15,
    lineHeight: 22,
  },
  heroStatsRow: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 8,
  },
  heroStatPill: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: '#FFFFFFB8',
    borderWidth: 1,
    borderColor: '#D5BDA9',
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  heroStatValue: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2B1E12',
  },
  heroStatLabel: {
    marginTop: 2,
    fontSize: 11,
    color: '#5D4B3C',
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
    fontSize: 18,
    color: '#2C1F13',
    fontWeight: '700',
  },
  filterTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  filterButton: {
    borderWidth: 1,
    borderColor: '#7A624D',
    borderRadius: 16,
    paddingVertical: 9,
    paddingHorizontal: 12,
    backgroundColor: '#FFF8F3',
  },
  filterButtonActive: {
    backgroundColor: '#4B3325',
    borderColor: '#4B3325',
  },
  filterButtonText: {
    color: '#5A4433',
    fontWeight: '700',
    fontSize: 13,
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  caption: {
    color: '#6A5B50',
    fontSize: 13,
  },
  error: {
    color: '#BA1A1A',
    marginTop: 8,
    fontSize: 13,
  },
  empty: {
    color: '#6A5B50',
    fontSize: 14,
    lineHeight: 20,
  },
  itemCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E7DCD1',
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#FFFBFF',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  itemTitleWrap: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2C1F13',
  },
  date: {
    color: '#6B5C52',
    fontSize: 12,
    marginTop: 3,
  },
  statusChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#DCC9B8',
    backgroundColor: '#F7EBDD',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5D4330',
    textTransform: 'uppercase',
  },
  metaGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  metaTile: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5D8CC',
    borderRadius: 14,
    backgroundColor: '#FFF8F3',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  metaLabel: {
    fontSize: 11,
    color: '#7A6A5A',
    fontWeight: '600',
  },
  metaValue: {
    marginTop: 3,
    fontSize: 13,
    color: '#2E2116',
    fontWeight: '700',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B4F3A',
    marginTop: 10,
  },
  text: {
    fontSize: 14,
    color: '#271508',
    marginTop: 4,
  },
  quickActionsWrap: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickAction: {
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#E2D5C9',
    backgroundColor: '#FFF5EC',
  },
  quickActionText: {
    color: '#452D1B',
    fontWeight: '700',
    fontSize: 13,
  },
  inlineRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#DFD0C2',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: '#271508',
    backgroundColor: '#FFFFFF',
  },
  inlineButton: {
    backgroundColor: '#2C2218',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  inlineButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  actions: {
    marginTop: 12,
    gap: 8,
  },
  badge: {
    backgroundColor: '#EEE1D4',
    borderWidth: 1,
    borderColor: '#DECFBF',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignItems: 'center',
  },
  badgeActive: {
    backgroundColor: '#F2DEC4',
  },
  badgeText: {
    fontWeight: '700',
    color: '#3A2719',
  },
  statusButton: {
    backgroundColor: '#271508',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignItems: 'center',
  },
  statusButtonLight: {
    backgroundColor: '#F5E7D9',
    borderWidth: 1,
    borderColor: '#D9C5B0',
  },
  statusButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  statusButtonTextLight: {
    color: '#5C412E',
  },
  deleteButton: {
    backgroundColor: '#BA1A1A',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});

export default CoffeeInventoryScreen;
