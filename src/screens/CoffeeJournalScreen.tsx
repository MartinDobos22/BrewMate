import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  Divider,
  Surface,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';

import { apiFetch, DEFAULT_API_HOST } from '../utils/api';
import spacing, { radii } from '../styles/spacing';

// ─── Types ────────────────────────────────────────────────────────────────────

type JournalItem = {
  id: string;
  method: string;
  doseG: number;
  brewTimeSeconds: number;
  tasteRating: number;
  notes: string | null;
  createdAt: string;
  coffeeName: string;
  origin: string;
  roastLevel: string;
};

type InsightBucket = {
  label: string;
  count: number;
  avgRating: number;
};

type InsightsPayload = {
  aiSummary: string;
  totals: {
    logsCount: number;
    methods: InsightBucket[];
    origins: InsightBucket[];
    roasts: InsightBucket[];
  };
};

// ─── Constants ────────────────────────────────────────────────────────────────

const METHODS = [
  { label: 'Espresso', value: 'espresso' },
  { label: 'V60', value: 'v60' },
  { label: 'Aeropress', value: 'aeropress' },
  { label: 'French Press', value: 'french_press' },
  { label: 'Moka', value: 'moka' },
  { label: 'Cold Brew', value: 'cold_brew' },
  { label: 'Other', value: 'other' },
];

// ─── BarRow component ─────────────────────────────────────────────────────────

function BarRow({
  bucket,
  max,
  theme,
}: {
  bucket: InsightBucket;
  max: number;
  theme: MD3Theme;
}) {
  const fillPercent = max > 0 ? Math.max(12, (bucket.count / max) * 100) : 12;

  return (
    <View style={styles.barRow}>
      <View style={styles.barTextWrap}>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
          {bucket.label}
        </Text>
        <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          ⭐ {bucket.avgRating.toFixed(1)} · {bucket.count}x
        </Text>
      </View>
      <Surface
        style={[styles.barTrack, { backgroundColor: theme.colors.surfaceVariant }]}
        elevation={0}
      >
        <View
          style={[
            styles.barFill,
            {
              width: `${fillPercent}%`,
              backgroundColor: theme.colors.primary,
            },
          ]}
        />
      </Surface>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

function CoffeeJournalScreen() {
  const theme = useTheme<MD3Theme>();

  // ── State (preserved exactly) ──────────────────────────────────────────────
  const [items, setItems] = useState<JournalItem[]>([]);
  const [insights, setInsights] = useState<InsightsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [method, setMethod] = useState(METHODS[0].value);
  const [doseG, setDoseG] = useState('18');
  const [brewTimeSeconds, setBrewTimeSeconds] = useState('150');
  const [tasteRating, setTasteRating] = useState('4');
  const [notes, setNotes] = useState('');

  // ── Business logic (preserved exactly) ────────────────────────────────────

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const [itemsResponse, insightsResponse] = await Promise.all([
        apiFetch(`${DEFAULT_API_HOST}/api/coffee-journal?days=30`, {
          credentials: 'include',
        }),
        apiFetch(`${DEFAULT_API_HOST}/api/coffee-journal/insights?days=30`, {
          credentials: 'include',
        }),
      ]);

      const itemsPayload = await itemsResponse.json().catch(() => ({}));
      const insightsPayload = await insightsResponse.json().catch(() => ({}));

      if (!itemsResponse.ok) {
        throw new Error(itemsPayload.error || 'Nepodarilo sa načítať journal.');
      }
      if (!insightsResponse.ok) {
        throw new Error(insightsPayload.error || 'Nepodarilo sa načítať insights.');
      }

      setItems(Array.isArray(itemsPayload.items) ? itemsPayload.items : []);
      setInsights(insightsPayload as InsightsPayload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Načítanie zlyhalo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onSubmit = useCallback(async () => {
    try {
      setSubmitting(true);
      setError('');
      const response = await apiFetch(
        `${DEFAULT_API_HOST}/api/coffee-journal`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            method,
            doseG: Number.parseInt(doseG, 10),
            brewTimeSeconds: Number.parseInt(brewTimeSeconds, 10),
            tasteRating: Number.parseInt(tasteRating, 10),
            notes,
          }),
        },
      );

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Nepodarilo sa uložiť prípravu.');
      }

      setNotes('');
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Uloženie zlyhalo.');
    } finally {
      setSubmitting(false);
    }
  }, [brewTimeSeconds, doseG, loadData, method, notes, tasteRating]);

  const recentFavorite = useMemo(
    () => insights?.totals.methods?.[0]?.label ?? null,
    [insights],
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      edges={['bottom']}
    >
      <ScrollView
        style={{ backgroundColor: theme.colors.background }}
        contentContainerStyle={styles.container}
      >
        {/* Header */}
        <Text variant="headlineMedium" style={{ color: theme.colors.onSurface }}>
          Coffee Journal
        </Text>
        <Text
          variant="bodyMedium"
          style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
        >
          Loguj si každú prípravu a sleduj čo ti chutí najviac.
        </Text>

        {/* Loading indicator */}
        {loading ? (
          <ActivityIndicator
            animating
            color={theme.colors.primary}
            style={styles.loader}
          />
        ) : null}

        {/* Error message */}
        {error ? (
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.error, fontWeight: '600' }}
          >
            {error}
          </Text>
        ) : null}

        {/* ── New brew log form ───────────────────────────────────────────── */}
        <Card
          mode="contained"
          style={[styles.card, { backgroundColor: theme.colors.surface }]}
        >
          <Card.Content style={styles.cardContent}>
            <Text
              variant="titleMedium"
              style={[styles.cardTitle, { color: theme.colors.onSurface }]}
            >
              Nový brew log
            </Text>

            {/* Method chips */}
            <View style={styles.methodRow}>
              {METHODS.map((option) => {
                const active = option.value === method;
                return (
                  <Chip
                    key={option.value}
                    selected={active}
                    onPress={() => setMethod(option.value)}
                    style={[
                      styles.methodChip,
                      active
                        ? { backgroundColor: theme.colors.primaryContainer }
                        : { backgroundColor: theme.colors.surfaceVariant },
                    ]}
                    textStyle={[
                      active
                        ? { color: theme.colors.onPrimaryContainer }
                        : { color: theme.colors.onSurfaceVariant },
                    ]}
                    showSelectedCheck={false}
                  >
                    {option.label}
                  </Chip>
                );
              })}
            </View>

            {/* Dose */}
            <TextInput
              label="Dávka (g)"
              value={doseG}
              onChangeText={setDoseG}
              keyboardType="number-pad"
              mode="outlined"
              style={styles.inputField}
              outlineStyle={{ borderRadius: radii.md }}
            />

            {/* Brew time */}
            <TextInput
              label="Čas (s)"
              value={brewTimeSeconds}
              onChangeText={setBrewTimeSeconds}
              keyboardType="number-pad"
              mode="outlined"
              style={styles.inputField}
              outlineStyle={{ borderRadius: radii.md }}
            />

            {/* Rating */}
            <TextInput
              label="Hodnotenie (1-5)"
              value={tasteRating}
              onChangeText={setTasteRating}
              keyboardType="number-pad"
              mode="outlined"
              style={styles.inputField}
              outlineStyle={{ borderRadius: radii.md }}
            />

            {/* Notes */}
            <TextInput
              label="Poznámka"
              value={notes}
              onChangeText={setNotes}
              placeholder="napr. viac sladké pri nižšej teplote"
              mode="outlined"
              multiline
              numberOfLines={3}
              style={[styles.inputField, styles.notesInput]}
              outlineStyle={{ borderRadius: radii.md }}
            />

            {/* Submit button */}
            <Button
              mode="contained"
              onPress={onSubmit}
              disabled={submitting}
              loading={submitting}
              style={styles.submitButton}
              contentStyle={styles.submitButtonContent}
            >
              {submitting ? 'Ukladám...' : 'Uložiť brew log'}
            </Button>
          </Card.Content>
        </Card>

        {/* ── AI Summary ──────────────────────────────────────────────────── */}
        <Card
          mode="contained"
          style={[styles.card, { backgroundColor: theme.colors.surface }]}
        >
          <Card.Content style={styles.cardContent}>
            <Text
              variant="titleMedium"
              style={[styles.cardTitle, { color: theme.colors.onSurface }]}
            >
              AI sumarizácia (30 dní)
            </Text>

            {loading ? (
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                Načítavam...
              </Text>
            ) : null}

            {!loading && insights ? (
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.onSurface, lineHeight: 22 }}
              >
                {insights.aiSummary}
              </Text>
            ) : null}

            {recentFavorite ? (
              <Chip
                style={[
                  styles.favoritePill,
                  { backgroundColor: theme.colors.secondaryContainer },
                ]}
                textStyle={{ color: theme.colors.onSecondaryContainer, fontWeight: '600' }}
                icon="star"
              >
                Favorit: {recentFavorite}
              </Chip>
            ) : null}
          </Card.Content>
        </Card>

        {/* ── Insights breakdown ───────────────────────────────────────────── */}
        {insights ? (
          <Card
            mode="contained"
            style={[styles.card, { backgroundColor: theme.colors.surface }]}
          >
            <Card.Content style={styles.cardContent}>
              <Text
                variant="titleMedium"
                style={[styles.cardTitle, { color: theme.colors.onSurface }]}
              >
                Čo ti chutí najviac
              </Text>

              <Text
                variant="labelMedium"
                style={[styles.groupTitle, { color: theme.colors.onSurfaceVariant }]}
              >
                Podľa metódy
              </Text>
              {insights.totals.methods.map((bucket) => (
                <BarRow
                  key={`method-${bucket.label}`}
                  bucket={bucket}
                  max={insights.totals.logsCount}
                  theme={theme}
                />
              ))}

              <Text
                variant="labelMedium"
                style={[styles.groupTitle, { color: theme.colors.onSurfaceVariant }]}
              >
                Podľa pôvodu
              </Text>
              {insights.totals.origins.map((bucket) => (
                <BarRow
                  key={`origin-${bucket.label}`}
                  bucket={bucket}
                  max={insights.totals.logsCount}
                  theme={theme}
                />
              ))}

              <Text
                variant="labelMedium"
                style={[styles.groupTitle, { color: theme.colors.onSurfaceVariant }]}
              >
                Podľa praženia
              </Text>
              {insights.totals.roasts.map((bucket) => (
                <BarRow
                  key={`roast-${bucket.label}`}
                  bucket={bucket}
                  max={insights.totals.logsCount}
                  theme={theme}
                />
              ))}
            </Card.Content>
          </Card>
        ) : null}

        {/* ── Recent log entries ───────────────────────────────────────────── */}
        <Card
          mode="contained"
          style={[styles.card, { backgroundColor: theme.colors.surface }]}
        >
          <Card.Content style={styles.cardContent}>
            <Text
              variant="titleMedium"
              style={[styles.cardTitle, { color: theme.colors.onSurface }]}
            >
              Posledné záznamy
            </Text>

            {items.slice(0, 10).map((item, index) => (
              <View key={item.id}>
                <View style={styles.logRow}>
                  <Text
                    variant="bodyLarge"
                    style={{ color: theme.colors.onSurface, fontWeight: '600' }}
                  >
                    {item.coffeeName}
                  </Text>
                  <Text
                    variant="bodySmall"
                    style={[styles.logMeta, { color: theme.colors.onSurfaceVariant }]}
                  >
                    {item.method} · {item.doseG}g · {item.brewTimeSeconds}s · ⭐ {item.tasteRating}/5
                  </Text>
                  {item.notes ? (
                    <Text
                      variant="bodySmall"
                      style={[styles.logNote, { color: theme.colors.onSurfaceVariant }]}
                    >
                      {item.notes}
                    </Text>
                  ) : null}
                </View>
                {index < Math.min(items.length, 10) - 1 ? (
                  <Divider style={{ backgroundColor: theme.colors.outlineVariant }} />
                ) : null}
              </View>
            ))}

            {!loading && items.length === 0 ? (
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                Zatiaľ bez záznamov.
              </Text>
            ) : null}
          </Card.Content>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  subtitle: {
    marginBottom: spacing.xs,
  },
  loader: {
    marginVertical: spacing.xs,
  },
  card: {
    borderRadius: spacing.lg,
  },
  cardContent: {
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  cardTitle: {
    marginBottom: spacing.sm,
  },
  methodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  methodChip: {
    borderRadius: radii.full,
  },
  inputField: {
    backgroundColor: 'transparent',
  },
  notesInput: {
    minHeight: 80,
  },
  submitButton: {
    marginTop: spacing.xs,
    borderRadius: radii.md,
  },
  submitButtonContent: {
    paddingVertical: spacing.xs,
  },
  favoritePill: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    borderRadius: radii.full,
  },
  groupTitle: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  barRow: {
    marginBottom: spacing.sm,
  },
  barTextWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  barTrack: {
    height: 8,
    borderRadius: radii.full,
    overflow: 'hidden',
  },
  barFill: {
    height: 8,
    borderRadius: radii.full,
  },
  logRow: {
    paddingVertical: spacing.md,
  },
  logMeta: {
    marginTop: spacing.xs,
  },
  logNote: {
    marginTop: spacing.xs,
    lineHeight: 18,
  },
});

export default CoffeeJournalScreen;
