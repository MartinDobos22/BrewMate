import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { apiFetch, DEFAULT_API_HOST } from '../utils/api';
import BottomNavBar from '../components/BottomNavBar';
import { useTheme } from '../theme/useTheme';
import { elevation } from '../theme/theme';
import { CoffeeCupIcon, SparklesIcon } from '../components/icons';
import { Chip } from '../components/md3';
import { BOTTOM_NAV_SAFE_PADDING } from '../constants/ui';

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
  actualRating: number | null;
};

type FeedbackState = {
  submitting: boolean;
  error: string | null;
};

type DeleteState = {
  deleting: boolean;
  error: string | null;
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
  const { colors, typescale, shape } = useTheme();
  const [items, setItems] = useState<Item[]>([]);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedbackState, setFeedbackState] = useState<
    Record<string, FeedbackState>
  >({});
  const [deleteState, setDeleteState] = useState<Record<string, DeleteState>>(
    {},
  );

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [itemsResponse, insightsResponse] = await Promise.all([
        apiFetch(`${DEFAULT_API_HOST}/api/coffee-recipes?days=30`, {
          credentials: 'include',
        }),
        apiFetch(`${DEFAULT_API_HOST}/api/coffee-recipes/insights?days=30`, {
          credentials: 'include',
        }),
      ]);
      const itemsPayload = await itemsResponse.json().catch(() => ({}));
      const insightsPayload = await insightsResponse.json().catch(() => ({}));

      if (!itemsResponse.ok) {
        throw new Error(itemsPayload.error || 'Nepodarilo sa načítať recepty.');
      }
      if (!insightsResponse.ok) {
        throw new Error(
          insightsPayload.error || 'Nepodarilo sa načítať insights.',
        );
      }

      setItems(Array.isArray(itemsPayload.items) ? itemsPayload.items : []);
      setInsights(insightsPayload as Insights);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Načítanie zlyhalo.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const submitFeedback = useCallback(
    async (recipeId: string, rating: number) => {
      setFeedbackState(prev => ({
        ...prev,
        [recipeId]: { submitting: true, error: null },
      }));
      try {
        const response = await apiFetch(
          `${DEFAULT_API_HOST}/api/coffee-recipes/${recipeId}/feedback`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ actualRating: rating }),
          },
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || 'Nepodarilo sa uložiť hodnotenie.');
        }
        setItems(prev =>
          prev.map(item =>
            item.id === recipeId ? { ...item, actualRating: rating } : item,
          ),
        );
        setFeedbackState(prev => ({
          ...prev,
          [recipeId]: { submitting: false, error: null },
        }));
      } catch (feedbackError) {
        setFeedbackState(prev => ({
          ...prev,
          [recipeId]: {
            submitting: false,
            error:
              feedbackError instanceof Error
                ? feedbackError.message
                : 'Nepodarilo sa uložiť hodnotenie.',
          },
        }));
      }
    },
    [],
  );

  const deleteRecipe = useCallback(async (recipeId: string) => {
    setDeleteState(prev => ({
      ...prev,
      [recipeId]: { deleting: true, error: null },
    }));
    try {
      const response = await apiFetch(
        `${DEFAULT_API_HOST}/api/coffee-recipes/${recipeId}`,
        {
          method: 'DELETE',
          credentials: 'include',
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Nepodarilo sa zmazať recept.');
      }
      setItems(prev => prev.filter(item => item.id !== recipeId));
      setDeleteState(prev => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [recipeId]: _deleted, ...rest } = prev;
        return rest;
      });
    } catch (deleteError) {
      setDeleteState(prev => ({
        ...prev,
        [recipeId]: {
          deleting: false,
          error:
            deleteError instanceof Error
              ? deleteError.message
              : 'Nepodarilo sa zmazať recept.',
        },
      }));
    }
  }, []);

  const confirmDelete = useCallback(
    (recipeId: string, title: string) => {
      Alert.alert(
        'Zmazať recept?',
        `Naozaj chceš zmazať recept "${title}"? Túto akciu nie je možné vrátiť.`,
        [
          { text: 'Zrušiť', style: 'cancel' },
          {
            text: 'Zmazať',
            style: 'destructive',
            onPress: () => deleteRecipe(recipeId),
          },
        ],
      );
    },
    [deleteRecipe],
  );

  const favorite = useMemo(
    () => insights?.totals.methods?.[0]?.label ?? null,
    [insights],
  );

  const s = useMemo(
    () =>
      StyleSheet.create({
        safeArea: {
          flex: 1,
          backgroundColor: colors.background,
        },
        container: {
          padding: 20,
          paddingBottom: BOTTOM_NAV_SAFE_PADDING + 24,
          gap: 14,
        },
        headerRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        },
        title: {
          ...typescale.headlineMedium,
          color: colors.onBackground,
        },
        card: {
          backgroundColor: colors.surfaceContainerLow,
          borderRadius: shape.extraLarge,
          padding: 18,
          ...elevation.level1.shadow,
        },
        cardHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginBottom: 10,
        },
        cardTitle: {
          ...typescale.titleLarge,
          color: colors.onSurface,
        },
        text: {
          ...typescale.bodyMedium,
          color: colors.onSurface,
          lineHeight: 22,
        },
        favorite: {
          ...typescale.labelLarge,
          marginTop: 10,
          color: colors.primary,
        },
        muted: {
          ...typescale.bodyMedium,
          color: colors.onSurfaceVariant,
        },
        item: {
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.outlineVariant,
        },
        itemLastChild: {
          borderBottomWidth: 0,
        },
        itemTitle: {
          ...typescale.titleSmall,
          color: colors.onSurface,
        },
        meta: {
          ...typescale.bodySmall,
          color: colors.onSurfaceVariant,
          marginTop: 2,
        },
        chipRow: {
          flexDirection: 'row',
          gap: 6,
          marginTop: 6,
        },
        loadingRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        },
        error: {
          ...typescale.bodySmall,
          color: colors.error,
        },
        feedbackRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          marginTop: 8,
        },
        feedbackLabel: {
          ...typescale.labelSmall,
          color: colors.onSurfaceVariant,
          marginRight: 4,
        },
        ratingButton: {
          minWidth: 30,
          height: 30,
          borderRadius: 15,
          borderWidth: 1,
          borderColor: colors.outlineVariant,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 4,
        },
        ratingButtonActive: {
          backgroundColor: colors.primaryContainer,
          borderColor: colors.primary,
        },
        ratingButtonText: {
          ...typescale.labelMedium,
          color: colors.onSurfaceVariant,
        },
        ratingButtonTextActive: {
          color: colors.onPrimaryContainer,
          fontWeight: '700',
        },
        feedbackSaved: {
          ...typescale.labelSmall,
          color: colors.tertiary,
          marginTop: 4,
        },
        feedbackError: {
          ...typescale.labelSmall,
          color: colors.error,
          marginTop: 4,
        },
        itemHeaderRow: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 8,
        },
        itemTitleWrap: {
          flex: 1,
        },
        deleteButton: {
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.outlineVariant,
        },
        deleteButtonText: {
          ...typescale.labelSmall,
          color: colors.error,
          fontWeight: '600',
        },
      }),
    [colors, shape, typescale],
  );

  return (
    <SafeAreaView style={s.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.container}>
        <View style={s.headerRow}>
          <CoffeeCupIcon size={26} color={colors.primary} />
          <Text style={s.title}>Uložené recepty</Text>
        </View>

        <View style={s.card}>
          <View style={s.cardHeader}>
            <SparklesIcon size={18} color={colors.primary} />
            <Text style={s.cardTitle}>AI sumarizácia (30 dní)</Text>
          </View>
          {loading ? (
            <View style={s.loadingRow}>
              <ActivityIndicator color={colors.primary} />
              <Text style={s.muted}>Načítavam...</Text>
            </View>
          ) : null}
          {!loading && insights ? (
            <Text style={s.text}>{insights.aiSummary}</Text>
          ) : null}
          {favorite ? (
            <Text style={s.favorite}>Aktuálny favorit: {favorite}</Text>
          ) : null}
        </View>

        <View style={s.card}>
          <View style={s.cardHeader}>
            <CoffeeCupIcon size={18} color={colors.primary} />
            <Text style={s.cardTitle}>Recepty</Text>
          </View>
          {items.map((item, index) => {
            const itemFeedback = feedbackState[item.id];
            const itemDelete = deleteState[item.id];
            return (
              <View
                key={item.id}
                style={[s.item, index === items.length - 1 && s.itemLastChild]}
              >
                <View style={s.itemHeaderRow}>
                  <View style={s.itemTitleWrap}>
                    <Text style={s.itemTitle}>{item.title}</Text>
                  </View>
                  <Pressable
                    style={s.deleteButton}
                    onPress={() => confirmDelete(item.id, item.title)}
                    disabled={itemDelete?.deleting}
                    accessibilityRole="button"
                    accessibilityLabel={`Zmazať recept ${item.title}`}
                  >
                    <Text style={s.deleteButtonText}>
                      {itemDelete?.deleting ? 'Mažem…' : 'Zmazať'}
                    </Text>
                  </Pressable>
                </View>
                <Text style={s.meta}>
                  {item.method} · {item.strengthPreference} · predikcia{' '}
                  {item.likeScore}%
                </Text>
                <Text style={s.meta}>
                  {item.dose} · {item.water} · {item.totalTime}
                </Text>
                {item.flavorNotes?.length ? (
                  <View style={s.chipRow}>
                    {item.flavorNotes.slice(0, 3).map(note => (
                      <Chip key={note} role="tertiary" label={note} />
                    ))}
                  </View>
                ) : null}
                <View style={s.feedbackRow}>
                  <Text style={s.feedbackLabel}>
                    {item.actualRating
                      ? 'Tvoje hodnotenie:'
                      : 'Ako ti chutilo?'}
                  </Text>
                  {[1, 2, 3, 4, 5].map(rating => {
                    const isActive = item.actualRating === rating;
                    return (
                      <Pressable
                        key={rating}
                        style={[
                          s.ratingButton,
                          isActive && s.ratingButtonActive,
                        ]}
                        onPress={() => submitFeedback(item.id, rating)}
                        disabled={itemFeedback?.submitting}
                        accessibilityRole="button"
                        accessibilityLabel={`Hodnotenie ${rating} z 5`}
                      >
                        <Text
                          style={[
                            s.ratingButtonText,
                            isActive && s.ratingButtonTextActive,
                          ]}
                        >
                          {rating}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {itemFeedback?.error ? (
                  <Text style={s.feedbackError}>{itemFeedback.error}</Text>
                ) : null}
                {item.actualRating &&
                !itemFeedback?.submitting &&
                !itemFeedback?.error ? (
                  <Text style={s.feedbackSaved}>
                    Hodnotenie uložené — pomáha kalibrácii predikcií.
                  </Text>
                ) : null}
                {itemDelete?.error ? (
                  <Text style={s.feedbackError}>{itemDelete.error}</Text>
                ) : null}
              </View>
            );
          })}
          {!loading && items.length === 0 ? (
            <Text style={s.muted}>Zatiaľ bez receptov.</Text>
          ) : null}
        </View>

        {error ? <Text style={s.error}>{error}</Text> : null}
      </ScrollView>
      <BottomNavBar />
    </SafeAreaView>
  );
}

export default CoffeeRecipesSavedScreen;
