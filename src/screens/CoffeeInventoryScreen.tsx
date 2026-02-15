import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { apiFetch, DEFAULT_API_HOST } from '../utils/api';

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
  createdAt: string;
};

function CoffeeInventoryScreen() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const loadInventory = useCallback(async () => {
    setState('loading');
    setErrorMessage('');

    try {
      const response = await apiFetch(
        `${DEFAULT_API_HOST}/api/user-coffee`,
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

  const handleDelete = useCallback((id: string) => {
    Alert.alert('Vymazať kávu?', 'Táto káva sa odstráni z inventára.', [
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

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Coffee inventár</Text>

        {state === 'loading' ? <ActivityIndicator color="#1f6f5b" /> : null}
        {state === 'error' ? <Text style={styles.error}>{errorMessage}</Text> : null}

        {state === 'ready' && items.length === 0 ? (
          <Text style={styles.empty}>Zatiaľ nemáš uložené žiadne kávy.</Text>
        ) : null}

        {items.map((item) => (
          <View key={item.id} style={styles.card}>
            <Text style={styles.date}>
              Uložené: {new Date(item.createdAt).toLocaleDateString('sk-SK')}
            </Text>
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
                style={[styles.badge, item.loved ? styles.badgeActive : null]}
                onPress={() => handleLovedChange(item.id, !item.loved)}
              >
                <Text style={styles.badgeText}>
                  {item.loved ? 'Fantastická ⭐' : 'Označiť ako fantastickú'}
                </Text>
              </Pressable>

              <Pressable style={styles.deleteButton} onPress={() => handleDelete(item.id)}>
                <Text style={styles.deleteButtonText}>Vymazať</Text>
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
  date: { color: '#64748b', fontSize: 12, marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '700', color: '#1f6f5b', marginTop: 8 },
  text: { fontSize: 14, color: '#0f172a', marginTop: 4 },
  actions: { marginTop: 12, gap: 8 },
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
  deleteButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});

export default CoffeeInventoryScreen;
