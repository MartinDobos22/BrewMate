import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
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

        {loading ? (
          <ActivityIndicator color="#8B7355" style={styles.loader} />
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>AI sumarizácia (30 dní)</Text>
          {loading ? (
            <Text style={styles.muted}>Načítavam...</Text>
          ) : null}
          {!loading && insights ? (
            <Text style={styles.summaryText}>{insights.aiSummary}</Text>
          ) : null}
          {favorite ? (
            <View style={styles.favoritePill}>
              <Text style={styles.favoriteText}>Favorit: {favorite}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Uložené recepty</Text>
          {items.map((item, index) => (
            <View
              key={item.id}
              style={[
                styles.item,
                index === items.length - 1 ? styles.itemLast : null,
              ]}
            >
              <View style={styles.itemHeader}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <View style={styles.scoreChip}>
                  <Text style={styles.scoreText}>{item.likeScore}%</Text>
                </View>
              </View>
              <Text style={styles.meta}>{item.method} · {item.strengthPreference}</Text>
              <Text style={styles.meta}>{item.dose} · {item.water} · {item.totalTime}</Text>
              {item.flavorNotes?.length ? (
                <View style={styles.flavorRow}>
                  {item.flavorNotes.slice(0, 3).map((note) => (
                    <View key={note} style={styles.flavorChip}>
                      <Text style={styles.flavorChipText}>{note}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ))}
          {!loading && items.length === 0 ? (
            <Text style={styles.muted}>Zatiaľ bez receptov.</Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 48,
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  loader: {
    marginVertical: 8,
  },
  error: {
    color: '#D64545',
    fontWeight: '600',
    fontSize: 13,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 12,
    color: '#1A1A1A',
  },
  summaryText: {
    color: '#1A1A1A',
    fontSize: 14,
    lineHeight: 21,
  },
  favoritePill: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: '#FFF8F0',
    borderWidth: 1,
    borderColor: '#C08B3E',
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  favoriteText: {
    color: '#C08B3E',
    fontWeight: '600',
    fontSize: 13,
  },
  item: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  itemLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  itemTitle: {
    color: '#1A1A1A',
    fontWeight: '600',
    fontSize: 15,
    flex: 1,
    marginRight: 8,
  },
  scoreChip: {
    backgroundColor: '#F5F5F5',
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  scoreText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2C2C2C',
  },
  meta: {
    color: '#6B6B6B',
    fontSize: 12,
    marginTop: 2,
    lineHeight: 17,
  },
  flavorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  flavorChip: {
    backgroundColor: '#F5F5F5',
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  flavorChipText: {
    fontSize: 11,
    color: '#6B6B6B',
    fontWeight: '500',
  },
  muted: {
    color: '#6B6B6B',
    fontSize: 14,
  },
});

export default CoffeeRecipesSavedScreen;
