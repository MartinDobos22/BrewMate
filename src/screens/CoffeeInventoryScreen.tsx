import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { apiFetch, DEFAULT_API_HOST } from '../utils/api';

type InventoryItemStatus = 'active' | 'empty' | 'archived';

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
  status: InventoryItemStatus;
  createdAt: string;
};

function CoffeeInventoryScreen() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [showAllStatuses, setShowAllStatuses] = useState(false);

  const loadInventory = useCallback(async (showAll = showAllStatuses) => {
    setState('loading');
    setErrorMessage('');

    try {
      const status = showAll ? 'all' : 'active';
      const response = await apiFetch(
        `${DEFAULT_API_HOST}/api/user-coffee?status=${status}`,
        {
          method: 'GET',
          credentials: 'include',
        },
        {
          feature: 'CoffeeInventory',
          action: showAll ? 'load-all' : 'load-active',
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
  }, [showAllStatuses]);

  useEffect(() => {
    loadInventory(showAllStatuses);
  }, [loadInventory, showAllStatuses]);

  const updateStatus = useCallback(async (id: string, nextStatus: 'empty' | 'archived') => {
    const action = nextStatus === 'empty' ? 'mark-empty' : 'archive';

    try {
      const response = await apiFetch(
        `${DEFAULT_API_HOST}/api/user-coffee/${id}/${action}`,
        {
          method: 'POST',
          credentials: 'include',
        },
        {
          feature: 'CoffeeInventory',
          action,
        },
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Nepodarilo sa upraviť status kávy.');
      }

      setItems((current) =>
        current
          .map((item) => (item.id === id ? { ...item, status: nextStatus } : item))
          .filter((item) => showAllStatuses || item.status === 'active'),
      );
    } catch (error) {
      Alert.alert(
        'Chyba',
        error instanceof Error ? error.message : 'Nepodarilo sa upraviť status kávy.',
      );
    }
  }, [showAllStatuses]);

  const handlePermanentDelete = useCallback((id: string) => {
    Alert.alert('Natrvalo vymazať kávu?', 'Táto akcia je nevratná.', [
      { text: 'Zrušiť', style: 'cancel' },
      {
        text: 'Vymazať natrvalo',
        style: 'destructive',
        onPress: async () => {
          try {
            const response = await apiFetch(
              `${DEFAULT_API_HOST}/api/user-coffee/${id}/delete-permanently`,
              {
                method: 'DELETE',
                credentials: 'include',
              },
              {
                feature: 'CoffeeInventory',
                action: 'delete-permanently',
              },
            );

            if (!response.ok) {
              const payload = await response.json().catch(() => null);
              throw new Error(payload?.error || 'Nepodarilo sa vymazať kávu natrvalo.');
            }

            setItems((current) => current.filter((item) => item.id !== id));
          } catch (error) {
            Alert.alert(
              'Chyba',
              error instanceof Error ? error.message : 'Nepodarilo sa vymazať kávu natrvalo.',
            );
          }
        },
      },
    ]);
  }, []);

  const openOverflowMenu = useCallback((id: string) => {
    Alert.alert('Možnosti položky', undefined, [
      { text: 'Vymazať natrvalo', style: 'destructive', onPress: () => handlePermanentDelete(id) },
      { text: 'Zavrieť', style: 'cancel' },
    ]);
  }, [handlePermanentDelete]);

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

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Coffee inventár</Text>

        <Pressable
          style={[styles.filterToggle, showAllStatuses ? styles.filterToggleActive : null]}
          onPress={() => setShowAllStatuses((current) => !current)}
        >
          <Text style={styles.filterToggleText}>Zobraziť aj prázdne/archív</Text>
        </Pressable>

        {state === 'loading' ? <ActivityIndicator color="#1f6f5b" /> : null}
        {state === 'error' ? <Text style={styles.error}>{errorMessage}</Text> : null}

        {state === 'ready' && items.length === 0 ? (
          <Text style={styles.empty}>Zatiaľ nemáš uložené žiadne kávy.</Text>
        ) : null}

        {items.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={styles.cardTopRow}>
              <Text style={styles.date}>
                Uložené: {new Date(item.createdAt).toLocaleDateString('sk-SK')}
              </Text>
              <Pressable style={styles.overflowButton} onPress={() => openOverflowMenu(item.id)}>
                <Text style={styles.overflowButtonText}>Viac</Text>
              </Pressable>
            </View>
            <Text style={styles.status}>Status: {item.status}</Text>
            <Text style={styles.label}>Chuťový profil</Text>
            <Text style={styles.text}>{item.coffeeProfile?.tasteProfile || 'Neuvedené'}</Text>
            {item.coffeeProfile?.flavorNotes?.length ? (
              <Text style={styles.text}>Tóny: {item.coffeeProfile.flavorNotes.join(', ')}</Text>
            ) : null}
            {item.correctedText ? (
              <Text style={styles.text}>Etiketa OCR: {item.correctedText}</Text>
            ) : null}

            {item.aiMatchResult ? (
              <>
                <Text style={styles.label}>AI vyhodnotenie zhody</Text>
                <Text style={styles.text}>
                  {item.aiMatchResult.willLike
                    ? 'AI odhad: bude chutiť'
                    : 'AI odhad: skôr nebude chutiť'}
                </Text>
                {item.aiMatchResult.laymanSummary ? (
                  <Text style={styles.text}>{item.aiMatchResult.laymanSummary}</Text>
                ) : null}
              </>
            ) : null}

            <Text style={styles.label}>Etiketa</Text>
            <Text style={styles.text}>
              {item.labelImageBase64
                ? `Uložená (${item.labelImageBase64.length} znakov)`
                : 'Etiketa nebola uložená'}
            </Text>

            <View style={styles.actions}>
              <Pressable
                style={[styles.primaryButton, item.status !== 'active' ? styles.buttonDisabled : null]}
                onPress={() => updateStatus(item.id, 'empty')}
                disabled={item.status !== 'active'}
              >
                <Text style={styles.primaryButtonText}>Balík je prázdny</Text>
              </Pressable>

              <Pressable
                style={[styles.secondaryButton, item.status !== 'active' ? styles.buttonDisabled : null]}
                onPress={() => updateStatus(item.id, 'archived')}
                disabled={item.status !== 'active'}
              >
                <Text style={styles.secondaryButtonText}>Archivovať</Text>
              </Pressable>

              <Pressable
                style={[styles.badge, item.loved ? styles.badgeActive : null]}
                onPress={() => handleLovedChange(item.id, !item.loved)}
              >
                <Text style={styles.badgeText}>
                  {item.loved ? 'Fantastická ⭐' : 'Označiť ako fantastickú'}
                </Text>
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#ffffff' },
  container: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 16 },
  filterToggle: {
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  filterToggleActive: {
    backgroundColor: '#bfdbfe',
  },
  filterToggleText: {
    fontWeight: '600',
    color: '#1f2937',
  },
  error: { color: '#b91c1c', marginBottom: 12 },
  empty: { color: '#475569', fontSize: 14 },
  card: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    backgroundColor: '#f8fafc',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  overflowButton: {
    backgroundColor: '#e2e8f0',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  overflowButtonText: {
    color: '#334155',
    fontWeight: '600',
    fontSize: 12,
  },
  status: { color: '#64748b', fontSize: 12, marginTop: 8 },
  date: { color: '#64748b', fontSize: 12 },
  label: { fontSize: 13, fontWeight: '700', color: '#1f6f5b', marginTop: 8 },
  text: { fontSize: 14, color: '#0f172a', marginTop: 4 },
  actions: { marginTop: 12, gap: 8 },
  primaryButton: {
    backgroundColor: '#1f6f5b',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#dbeafe',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#1e3a8a',
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  badge: {
    backgroundColor: '#e2e8f0',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  badgeActive: {
    backgroundColor: '#fef08a',
  },
  badgeText: { fontWeight: '600', color: '#1f2937' },
});

export default CoffeeInventoryScreen;
