import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  Card,
  Chip,
  Divider,
  Text,
  useTheme,
} from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';

import { apiFetch, DEFAULT_API_HOST } from '../utils/api';
import spacing, { radii } from '../styles/spacing';

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
  const theme = useTheme<MD3Theme>();

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
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      edges={['bottom']}
    >
      <ScrollView
        style={[styles.scroll, { backgroundColor: theme.colors.background }]}
        contentContainerStyle={styles.container}
      >
        <Text variant="headlineMedium" style={styles.title}>
          Coffee Recipes Saved
        </Text>

        {/* Loading state */}
        {loading ? (
          <ActivityIndicator
            animating
            color={theme.colors.primary}
            style={styles.loader}
          />
        ) : null}

        {/* Error state */}
        {error ? (
          <Text variant="bodyMedium" style={{ color: theme.colors.error }}>
            {error}
          </Text>
        ) : null}

        {/* AI Summary card */}
        <Card
          mode="contained"
          style={[styles.card, { backgroundColor: theme.colors.surfaceVariant }]}
        >
          <Card.Content style={styles.cardContent}>
            <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
              AI sumarizácia (30 dní)
            </Text>

            {loading ? (
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                Načítavam...
              </Text>
            ) : null}

            {!loading && insights ? (
              <Text
                variant="bodyMedium"
                style={[styles.summaryText, { color: theme.colors.onSurface }]}
              >
                {insights.aiSummary}
              </Text>
            ) : null}

            {favorite ? (
              <View style={styles.favoriteRow}>
                <Chip
                  style={[
                    styles.favoriteChip,
                    { backgroundColor: theme.colors.primaryContainer },
                  ]}
                  textStyle={{ color: theme.colors.onPrimaryContainer }}
                  compact
                >
                  Favorit: {favorite}
                </Chip>
              </View>
            ) : null}
          </Card.Content>
        </Card>

        {/* Saved recipes card */}
        <Card
          mode="contained"
          style={[styles.card, { backgroundColor: theme.colors.surfaceVariant }]}
        >
          <Card.Content style={styles.cardContent}>
            <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
              Uložené recepty
            </Text>

            {items.map((item, index) => (
              <View key={item.id}>
                <View style={styles.recipeItem}>
                  {/* Header row: title + like score */}
                  <View style={styles.itemHeader}>
                    <Text
                      variant="titleMedium"
                      style={[styles.itemTitle, { color: theme.colors.onSurface }]}
                      numberOfLines={2}
                    >
                      {item.title}
                    </Text>
                    <Chip
                      style={[
                        styles.scoreChip,
                        { backgroundColor: theme.colors.secondaryContainer },
                      ]}
                      textStyle={{ color: theme.colors.onSecondaryContainer }}
                      compact
                    >
                      {item.likeScore}%
                    </Chip>
                  </View>

                  {/* Method + strength */}
                  <View style={styles.methodRow}>
                    <Chip
                      style={[
                        styles.methodChip,
                        { backgroundColor: theme.colors.surface },
                      ]}
                      compact
                    >
                      {item.method}
                    </Chip>
                    <Chip
                      style={[
                        styles.methodChip,
                        { backgroundColor: theme.colors.surface },
                      ]}
                      compact
                    >
                      {item.strengthPreference}
                    </Chip>
                  </View>

                  {/* Brew details */}
                  <Text
                    variant="bodySmall"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    {item.dose} · {item.water} · {item.totalTime}
                  </Text>

                  {/* Flavor notes */}
                  {item.flavorNotes?.length ? (
                    <View style={styles.flavorRow}>
                      {item.flavorNotes.slice(0, 3).map((note) => (
                        <Chip
                          key={note}
                          style={[
                            styles.flavorChip,
                            { backgroundColor: theme.colors.surface },
                          ]}
                          textStyle={{ color: theme.colors.onSurfaceVariant }}
                          compact
                        >
                          {note}
                        </Chip>
                      ))}
                    </View>
                  ) : null}
                </View>

                {/* Divider between items, not after last */}
                {index < items.length - 1 ? (
                  <Divider style={{ backgroundColor: theme.colors.outlineVariant }} />
                ) : null}
              </View>
            ))}

            {!loading && items.length === 0 ? (
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                Zatiaľ bez receptov.
              </Text>
            ) : null}
          </Card.Content>
        </Card>
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
    gap: spacing.lg,
  },
  title: {
    marginBottom: spacing.xs,
  },
  loader: {
    marginVertical: spacing.sm,
  },
  card: {
    borderRadius: radii.lg,
  },
  cardContent: {
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  summaryText: {
    lineHeight: 22,
  },
  favoriteRow: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  favoriteChip: {
    alignSelf: 'flex-start',
  },
  recipeItem: {
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  itemTitle: {
    flex: 1,
  },
  scoreChip: {
    alignSelf: 'flex-start',
  },
  methodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  methodChip: {
    // surface background set inline via theme
  },
  flavorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  flavorChip: {
    // surface background set inline via theme
  },
});

export default CoffeeRecipesSavedScreen;
