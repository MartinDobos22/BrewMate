import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { apiFetch, DEFAULT_API_HOST } from '../utils/api';

type Item = {
  id: string;
  title: string;
  method: string;
  strengthPreference: string;
  dose: string;
  water: string;
  totalTime: string;
  likeScore: number;
  flavorNotes: string[];
};

type Bucket = { label: string; count: number; avgLikeScore: number };

type Insights = {
  aiSummary: string;
  totals: {
    recipesCount: number;
    methods: Bucket[];
    strengths: Bucket[];
    tasteProfiles: Bucket[];
  };
};

function CoffeeRecipesSavedScreen() {
  const [items, setItems] = useState<Item[]>([]);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [itemsResponse, insightsResponse] = await Promise.all([
        apiFetch(`${DEFAULT_API_HOST}/api/coffee-recipes?days=30`, { credentials: 'include' }),
        apiFetch(`${DEFAULT_API_HOST}/api/coffee-recipes/insights?days=30`, { credentials: 'include' }),
      ]);
      const itemsPayload = await itemsResponse.json().catch(() => ({}));
      const insightsPayload = await insightsResponse.json().catch(() => ({}));

      if (!itemsResponse.ok) {
        throw new Error(itemsPayload.error || 'Nepodarilo sa načítať recepty.');
      }
      if (!insightsResponse.ok) {
        throw new Error(insightsPayload.error || 'Nepodarilo sa načítať insights.');
      }

      setItems(Array.isArray(itemsPayload.items) ? itemsPayload.items : []);
      setInsights(insightsPayload as Insights);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Načítanie zlyhalo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const favorite = useMemo(() => insights?.totals.methods?.[0]?.label ?? null, [insights]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Coffee Recipes Saved</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>AI sumarizácia (30 dní)</Text>
          {loading ? <Text style={styles.muted}>Načítavam...</Text> : null}
          {!loading && insights ? <Text style={styles.text}>{insights.aiSummary}</Text> : null}
          {favorite ? <Text style={styles.favorite}>Aktuálny favorit: {favorite}</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Uložené recepty</Text>
          {items.map((item) => (
            <View key={item.id} style={styles.item}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.meta}>{item.method} • {item.strengthPreference} • {item.likeScore}%</Text>
              <Text style={styles.meta}>{item.dose} • {item.water} • {item.totalTime}</Text>
            </View>
          ))}
          {!loading && items.length === 0 ? <Text style={styles.muted}>Zatiaľ bez receptov.</Text> : null}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { padding: 20, gap: 14 },
  title: { fontSize: 28, fontWeight: '700', color: '#0f172a' },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, padding: 14 },
  cardTitle: { fontSize: 17, fontWeight: '700', marginBottom: 8, color: '#0f172a' },
  text: { color: '#0f172a' },
  favorite: { marginTop: 8, color: '#1f6f5b', fontWeight: '600' },
  item: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  itemTitle: { color: '#0f172a', fontWeight: '600' },
  meta: { color: '#475569', fontSize: 12, marginTop: 2 },
  muted: { color: '#64748b' },
  error: { color: '#b91c1c', fontWeight: '600' },
});

export default CoffeeRecipesSavedScreen;
