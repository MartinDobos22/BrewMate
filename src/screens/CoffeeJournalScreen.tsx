import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { apiFetch, DEFAULT_API_HOST } from '../utils/api';

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

const METHODS = [
  { label: 'Espresso', value: 'espresso' },
  { label: 'V60', value: 'v60' },
  { label: 'Aeropress', value: 'aeropress' },
  { label: 'French Press', value: 'french_press' },
  { label: 'Moka', value: 'moka' },
  { label: 'Cold Brew', value: 'cold_brew' },
  { label: 'Other', value: 'other' },
];

function CoffeeJournalScreen() {
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

  const recentFavorite = useMemo(() => insights?.totals.methods?.[0]?.label ?? null, [insights]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Coffee Journal</Text>
        <Text style={styles.subtitle}>Loguj si každú prípravu a sleduj čo ti chutí najviac.</Text>

        {loading ? (
          <ActivityIndicator color="#8B7355" style={styles.loader} />
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* New brew log form */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Nový brew log</Text>

          <View style={styles.methodRow}>
            {METHODS.map((option) => {
              const active = option.value === method;
              return (
                <Pressable
                  key={option.value}
                  style={[styles.methodPill, active && styles.methodPillActive]}
                  onPress={() => setMethod(option.value)}
                >
                  <Text style={[styles.methodPillText, active && styles.methodPillTextActive]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>Dávka (g)</Text>
            <TextInput
              value={doseG}
              onChangeText={setDoseG}
              keyboardType="number-pad"
              style={styles.input}
              placeholderTextColor="#999999"
            />
          </View>

          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>Čas (s)</Text>
            <TextInput
              value={brewTimeSeconds}
              onChangeText={setBrewTimeSeconds}
              keyboardType="number-pad"
              style={styles.input}
              placeholderTextColor="#999999"
            />
          </View>

          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>Hodnotenie (1-5)</Text>
            <TextInput
              value={tasteRating}
              onChangeText={setTasteRating}
              keyboardType="number-pad"
              style={styles.input}
              placeholderTextColor="#999999"
            />
          </View>

          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>Poznámka</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="napr. viac sladké pri nižšej teplote"
              placeholderTextColor="#999999"
              style={[styles.input, styles.notesInput]}
              multiline
            />
          </View>

          <Pressable style={styles.primaryButton} onPress={onSubmit} disabled={submitting}>
            <Text style={styles.primaryButtonText}>
              {submitting ? 'Ukladám...' : 'Uložiť brew log'}
            </Text>
          </Pressable>
        </View>

        {/* AI Summary */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>AI sumarizácia (30 dní)</Text>
          {loading ? (
            <Text style={styles.muted}>Načítavam...</Text>
          ) : null}
          {!loading && insights ? (
            <Text style={styles.summaryText}>{insights.aiSummary}</Text>
          ) : null}
          {recentFavorite ? (
            <View style={styles.favoritePill}>
              <Text style={styles.favoriteText}>Favorit: {recentFavorite}</Text>
            </View>
          ) : null}
        </View>

        {/* Insights breakdown */}
        {insights ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Čo ti chutí najviac</Text>

            <Text style={styles.groupTitle}>Podľa metódy</Text>
            {insights.totals.methods.map((bucket) => (
              <BarRow key={`method-${bucket.label}`} bucket={bucket} max={insights.totals.logsCount} />
            ))}

            <Text style={styles.groupTitle}>Podľa pôvodu</Text>
            {insights.totals.origins.map((bucket) => (
              <BarRow key={`origin-${bucket.label}`} bucket={bucket} max={insights.totals.logsCount} />
            ))}

            <Text style={styles.groupTitle}>Podľa praženia</Text>
            {insights.totals.roasts.map((bucket) => (
              <BarRow key={`roast-${bucket.label}`} bucket={bucket} max={insights.totals.logsCount} />
            ))}
          </View>
        ) : null}

        {/* Recent log entries */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Posledné záznamy</Text>
          {items.slice(0, 10).map((item, index) => (
            <View
              key={item.id}
              style={[
                styles.logRow,
                index === Math.min(items.length, 10) - 1 ? styles.logRowLast : null,
              ]}
            >
              <Text style={styles.logTitle}>{item.coffeeName}</Text>
              <Text style={styles.logMeta}>
                {item.method} · {item.doseG}g · {item.brewTimeSeconds}s · ⭐ {item.tasteRating}/5
              </Text>
              {item.notes ? <Text style={styles.logNote}>{item.notes}</Text> : null}
            </View>
          ))}
          {!loading && items.length === 0 ? (
            <Text style={styles.muted}>Zatiaľ bez záznamov.</Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function BarRow({ bucket, max }: { bucket: InsightBucket; max: number }) {
  const width = max > 0 ? `${Math.max(12, (bucket.count / max) * 100)}%` : '12%';

  return (
    <View style={styles.barRow}>
      <View style={styles.barTextWrap}>
        <Text style={styles.barLabel}>{bucket.label}</Text>
        <Text style={styles.barMeta}>⭐ {bucket.avgRating.toFixed(1)} · {bucket.count}x</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width }]} />
      </View>
    </View>
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
  },
  subtitle: {
    fontSize: 14,
    color: '#6B6B6B',
    lineHeight: 20,
    marginBottom: 4,
  },
  loader: {
    marginVertical: 4,
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
    marginBottom: 14,
    color: '#1A1A1A',
  },
  methodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  methodPill: {
    backgroundColor: '#F5F5F5',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  methodPillActive: {
    backgroundColor: '#2C2C2C',
  },
  methodPillText: {
    color: '#6B6B6B',
    fontSize: 13,
    fontWeight: '500',
  },
  methodPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  inputRow: {
    marginBottom: 12,
  },
  inputLabel: {
    color: '#6B6B6B',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#1A1A1A',
    fontSize: 14,
  },
  notesInput: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  primaryButton: {
    backgroundColor: '#2C2C2C',
    marginTop: 4,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
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
  groupTitle: {
    marginTop: 12,
    marginBottom: 8,
    fontWeight: '600',
    fontSize: 12,
    color: '#6B6B6B',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  barRow: {
    marginBottom: 10,
  },
  barTextWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  barLabel: {
    color: '#1A1A1A',
    fontSize: 13,
    fontWeight: '500',
  },
  barMeta: {
    color: '#6B6B6B',
    fontSize: 12,
  },
  barTrack: {
    height: 6,
    backgroundColor: '#F0F0F0',
    borderRadius: 999,
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    backgroundColor: '#8B7355',
    borderRadius: 999,
  },
  logRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  logRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  logTitle: {
    color: '#1A1A1A',
    fontWeight: '600',
    fontSize: 14,
  },
  logMeta: {
    color: '#6B6B6B',
    fontSize: 12,
    marginTop: 3,
  },
  logNote: {
    color: '#6B6B6B',
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
  },
  muted: {
    color: '#6B6B6B',
    fontSize: 14,
  },
});

export default CoffeeJournalScreen;
