import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
        <Text style={styles.title}>Coffee Journal & Insights</Text>
        <Text style={styles.subtitle}>Loguj si každú prípravu a sleduj čo ti chutí najviac.</Text>

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
            />
          </View>

          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>Čas (s)</Text>
            <TextInput
              value={brewTimeSeconds}
              onChangeText={setBrewTimeSeconds}
              keyboardType="number-pad"
              style={styles.input}
            />
          </View>

          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>Hodnotenie (1-5)</Text>
            <TextInput
              value={tasteRating}
              onChangeText={setTasteRating}
              keyboardType="number-pad"
              style={styles.input}
            />
          </View>

          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>Poznámka</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="napr. viac sladké pri nižšej teplote"
              style={[styles.input, styles.notesInput]}
              multiline
            />
          </View>

          <Pressable style={styles.primaryButton} onPress={onSubmit} disabled={submitting}>
            <Text style={styles.primaryButtonText}>{submitting ? 'Ukladám...' : 'Uložiť brew log'}</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>AI sumarizácia (30 dní)</Text>
          {loading ? <Text style={styles.muted}>Načítavam...</Text> : null}
          {!loading && insights ? <Text style={styles.summary}>{insights.aiSummary}</Text> : null}
          {recentFavorite ? <Text style={styles.favorite}>Aktuálny favorit: {recentFavorite}</Text> : null}
        </View>

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

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Posledné záznamy</Text>
          {items.slice(0, 10).map((item) => (
            <View key={item.id} style={styles.logRow}>
              <Text style={styles.logTitle}>{item.coffeeName}</Text>
              <Text style={styles.logMeta}>
                {item.method} • {item.doseG}g • {item.brewTimeSeconds}s • ⭐ {item.tasteRating}/5
              </Text>
              {item.notes ? <Text style={styles.logNote}>{item.notes}</Text> : null}
            </View>
          ))}
          {!loading && items.length === 0 ? <Text style={styles.muted}>Zatiaľ bez záznamov.</Text> : null}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
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
        <Text style={styles.barMeta}>⭐ {bucket.avgRating.toFixed(1)} • {bucket.count}x</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { padding: 20, gap: 14 },
  title: { fontSize: 28, fontWeight: '700', color: '#0f172a' },
  subtitle: { fontSize: 14, color: '#475569' },
  card: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 14,
  },
  cardTitle: { fontSize: 17, fontWeight: '700', marginBottom: 8, color: '#0f172a' },
  methodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  methodPill: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  methodPillActive: { backgroundColor: '#1f6f5b', borderColor: '#1f6f5b' },
  methodPillText: { color: '#334155', fontSize: 12 },
  methodPillTextActive: { color: '#ffffff' },
  inputRow: { marginBottom: 8 },
  inputLabel: { color: '#334155', fontSize: 13, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#0f172a',
  },
  notesInput: { minHeight: 56, textAlignVertical: 'top' },
  primaryButton: {
    backgroundColor: '#1f6f5b',
    marginTop: 8,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#ffffff', fontWeight: '600' },
  summary: { color: '#0f172a', lineHeight: 20 },
  favorite: { marginTop: 8, color: '#1f6f5b', fontWeight: '600' },
  groupTitle: { marginTop: 10, marginBottom: 4, fontWeight: '600', color: '#334155' },
  barRow: { marginBottom: 8 },
  barTextWrap: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  barLabel: { color: '#0f172a', fontSize: 13 },
  barMeta: { color: '#475569', fontSize: 12 },
  barTrack: { height: 8, backgroundColor: '#e2e8f0', borderRadius: 6 },
  barFill: { height: 8, backgroundColor: '#1f6f5b', borderRadius: 6 },
  logRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  logTitle: { color: '#0f172a', fontWeight: '600' },
  logMeta: { color: '#475569', fontSize: 12, marginTop: 2 },
  logNote: { color: '#334155', marginTop: 4, fontSize: 12 },
  muted: { color: '#64748b' },
  error: { color: '#b91c1c', fontWeight: '600' },
});

export default CoffeeJournalScreen;
