import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';

import { apiFetch, DEFAULT_API_HOST } from '../utils/api';

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


  const totalCount = items.length;
  const activePct = totalCount ? Math.round((totalsByStatus.active / totalCount) * 100) : 0;
  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Zásobník</Text>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Celkovo zásobník</Text>
          <Text style={styles.summaryValue}>{totalsByStatus.active}</Text>
          <Text style={styles.caption}>kávy v aktívnom stave</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${activePct}%` }]} />
          </View>
          <Text style={styles.progressText}>{activePct}% aktívnych položiek</Text>
        </View>

        <View style={styles.filterTabs}>
          <Pressable
            style={[styles.filterButton, activeFilter === 'active' ? styles.filterButtonActive : null]}
            onPress={() => setActiveFilter('active')}
          >
            <Text
              style={[
                styles.filterButtonText,
                activeFilter === 'active' ? styles.filterButtonTextActive : null,
              ]}
            >
              Aktívne ({totalsByStatus.active})
            </Text>
          </Pressable>
          <Pressable
            style={[styles.filterButton, activeFilter === 'empty' ? styles.filterButtonActive : null]}
            onPress={() => setActiveFilter('empty')}
          >
            <Text
              style={[
                styles.filterButtonText,
                activeFilter === 'empty' ? styles.filterButtonTextActive : null,
              ]}
            >
              Dopité ({totalsByStatus.empty})
            </Text>
          </Pressable>
          <Pressable
            style={[styles.filterButton, activeFilter === 'archived' ? styles.filterButtonActive : null]}
            onPress={() => setActiveFilter('archived')}
          >
            <Text
              style={[
                styles.filterButtonText,
                activeFilter === 'archived' ? styles.filterButtonTextActive : null,
              ]}
            >
              Archivované ({totalsByStatus.archived})
            </Text>
          </Pressable>
        </View>

        {state === 'loading' ? <ActivityIndicator color="#6B4F3A" /> : null}
        {state === 'error' ? <Text style={styles.error}>{errorMessage}</Text> : null}

        <Text style={styles.caption}>Zobrazená kategória: {filterLabel}</Text>

        {state === 'ready' && renderedItems.length === 0 ? (
          <Text style={styles.empty}>V kategórii {filterLabel.toLowerCase()} zatiaľ nemáš žiadne kávy.</Text>
        ) : null}

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
            <View key={item.id} style={styles.card}>
              <Text style={styles.date}>
                Uložené: {new Date(item.createdAt).toLocaleDateString('sk-SK')}
              </Text>
              <Text style={styles.label}>Stav: {statusLabel}</Text>
              <Text style={styles.text}>Balík: {packageLabel}</Text>
              <Text style={styles.text}>Zostáva: {remainingLabel}</Text>
              {item.packageSizeG && item.remainingG !== null ? (
                <View style={styles.itemProgress}>
                  <View
                    style={[
                      styles.itemProgressFill,
                      { width: `${Math.max(0, Math.min(100, Math.round((item.remainingG / item.packageSizeG) * 100)))}%` },
                    ]}
                  />
                </View>
              ) : null}
              <Text style={styles.text}>
                Režim trackingu: {item.trackingMode === 'manual' ? 'Manual' : 'Estimated'}
              </Text>

              <Text style={styles.label}>Chuťový profil</Text>
              <Text style={styles.text}>{item.coffeeProfile?.tasteProfile || 'Neuvedené'}</Text>
              {item.coffeeProfile?.flavorNotes?.length ? (
                <Text style={styles.text}>Tóny: {item.coffeeProfile.flavorNotes.join(', ')}</Text>
              ) : null}

              <View style={styles.quickActionsWrap}>
                {[
                  item.preferredDoseG && !QUICK_DOSES.includes(item.preferredDoseG)
                    ? item.preferredDoseG
                    : null,
                  ...QUICK_DOSES,
                ]
                  .filter((dose): dose is number => Boolean(dose))
                  .slice(0, 4)
                  .map((dose) => (
                    <Pressable
                      key={`${item.id}-${dose}`}
                      style={styles.quickAction}
                      onPress={() => handleConsume(item, dose, 'quick_action')}
                    >
                      <Text style={styles.quickActionText}>-{dose} g</Text>
                    </Pressable>
                  ))}
              </View>

              <View style={styles.inlineRow}>
                <TextInput
                  style={styles.input}
                  value={customDoseById[item.id] ?? ''}
                  onChangeText={(value) =>
                    setCustomDoseById((current) => ({ ...current, [item.id]: value }))
                  }
                  placeholder="Custom minus g"
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
                  onChangeText={(value) =>
                    setCustomRemainingById((current) => ({ ...current, [item.id]: value }))
                  }
                  placeholder="Nastaviť zostávajúce g"
                  keyboardType="number-pad"
                />
                <Pressable style={styles.inlineButton} onPress={() => handleRemainingUpdate(item)}>
                  <Text style={styles.inlineButtonText}>Uložiť</Text>
                </Pressable>
              </View>

              <View style={styles.actions}>
                <Pressable
                  style={[styles.badge, item.loved ? styles.badgeActive : null]}
                  onPress={() => handleLovedChange(item.id, !item.loved)}
                >
                  <Text style={styles.badgeText}>
                    {item.loved ? 'Fantastická ⭐' : 'Označiť ako fantastickú'}
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.statusButton}
                  onPress={() => handleStatusChange(item, 'empty')}
                >
                  <Text style={styles.statusButtonText}>Balík je prázdny</Text>
                </Pressable>

                {item.status === 'archived' ? (
                  <Pressable
                    style={styles.statusButton}
                    onPress={() => handleStatusChange(item, 'active')}
                  >
                    <Text style={styles.statusButtonText}>Vrátiť do aktívnych</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    style={styles.statusButton}
                    onPress={() => handleStatusChange(item, 'archived')}
                  >
                    <Text style={styles.statusButtonText}>Archivovať</Text>
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
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 12, color:'#271508' },
  summaryCard: { backgroundColor:'#EDE0D4', borderRadius:28, padding:16, marginBottom:12 },
  summaryLabel: { color:'#6B4F3A', fontSize:12, fontWeight:'700', textTransform:'uppercase' },
  summaryValue: { fontSize:48, lineHeight:54, fontWeight:'700', color:'#271508' },
  progressTrack:{ height:6, backgroundColor:'#DDD3C9', borderRadius:4, marginTop:10 },
  progressFill:{ height:'100%', backgroundColor:'#7A9255', borderRadius:4 },
  progressText:{ marginTop:6, color:'#6B5C52', fontSize:12 },
  filterTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  filterButton: {
    borderWidth: 1,
    borderColor: '#6B4F3A',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
  },
  filterButtonActive: {
    backgroundColor: '#6B4F3A',
  },
  filterButtonText: { color: '#6B4F3A', fontWeight: '700' },
  filterButtonTextActive: { color: '#FFFFFF' },
  caption: { color: '#6B5C52', marginBottom: 12 },
  error: { color: '#BA1A1A', marginBottom: 12 },
  empty: { color: '#6B5C52', fontSize: 14 },
  card: {
    borderWidth: 1,
    borderColor: '#DDD3C9',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    backgroundColor: '#F5F1EC',
  },
  date: { color: '#6B5C52', fontSize: 12, marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '700', color: '#6B4F3A', marginTop: 8 },
  text: { fontSize: 14, color: '#271508', marginTop: 4 },
  itemProgress:{ marginTop:8, height:6, backgroundColor:'#DDD3C9', borderRadius:3, overflow:'hidden' },
  itemProgressFill:{ height:'100%', backgroundColor:'#6B4F3A' },
  quickActionsWrap: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickAction: {
    backgroundColor: '#DDD3C9',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  quickActionText: { color: '#271508', fontWeight: '600' },
  inlineRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#DDD3C9',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
  },
  inlineButton: {
    backgroundColor: '#6B4F3A',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  inlineButtonText: { color: '#FFFFFF', fontWeight: '700' },
  actions: { marginTop: 12, gap: 8 },
  badge: {
    backgroundColor: '#DDD3C9',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignItems: 'center',
  },
  badgeActive: {
    backgroundColor: '#F2DEC4',
  },
  badgeText: { fontWeight: '600', color: '#271508' },
  statusButton: {
    backgroundColor: '#271508',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignItems: 'center',
  },
  statusButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
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
