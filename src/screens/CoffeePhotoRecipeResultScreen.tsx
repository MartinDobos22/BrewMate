import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Text,
  Card,
  Surface,
  Button,
  Chip,
  useTheme,
  Divider,
} from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';
import { HomeStackParamList } from '../navigation/types';
import { apiFetch, DEFAULT_API_HOST } from '../utils/api';
import spacing from '../styles/spacing';

type Props = NativeStackScreenProps<HomeStackParamList, 'CoffeePhotoRecipeResult'>;

const APPROVAL_THRESHOLD = 70;

function CoffeePhotoRecipeResultScreen({ route, navigation }: Props) {
  const theme = useTheme<MD3Theme>();

  const { analysis, selectedPreparation, strengthPreference, recipe, likePrediction } = route.params;
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const canSave = useMemo(() => likePrediction.score >= APPROVAL_THRESHOLD, [likePrediction.score]);

  const handleSaveRecipe = async () => {
    if (!canSave || saveState === 'saving') {
      return;
    }

    try {
      setSaveState('saving');
      setErrorMessage('');

      const response = await apiFetch(
        `${DEFAULT_API_HOST}/api/coffee-recipes`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            analysis,
            recipe,
            selectedPreparation,
            strengthPreference,
            likeScore: likePrediction.score,
            approved: true,
          }),
        },
      );

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Nepodarilo sa uložiť recept.');
      }

      setSaveState('saved');
    } catch (error) {
      setSaveState('error');
      setErrorMessage(error instanceof Error ? error.message : 'Nepodarilo sa uložiť recept.');
    }
  };

  const isGoodScore = likePrediction.score >= APPROVAL_THRESHOLD;
  const scoreContainerColor = isGoodScore
    ? theme.colors.secondaryContainer
    : theme.colors.primaryContainer;
  const scoreTextColor = isGoodScore
    ? theme.colors.onSecondaryContainer
    : theme.colors.onPrimaryContainer;

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      edges={['bottom']}
    >
      <ScrollView
        style={[styles.scroll, { backgroundColor: theme.colors.background }]}
        contentContainerStyle={styles.content}
      >
        {/* Screen Title */}
        <Text
          variant="headlineMedium"
          style={[styles.title, { color: theme.colors.onSurface }]}
        >
          {recipe.title}
        </Text>

        {/* AI Prediction Card */}
        <Card
          mode="elevated"
          elevation={1}
          style={[styles.card, { backgroundColor: theme.colors.surface }]}
        >
          <Card.Content style={styles.cardContent}>
            <Text
              variant="labelLarge"
              style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}
            >
              AI predikcia chuti
            </Text>

            {/* Score Surface */}
            <Surface
              style={[styles.scoreSurface, { backgroundColor: scoreContainerColor }]}
              elevation={0}
            >
              <Text
                variant="bodyMedium"
                style={[styles.scoreLabel, { color: scoreTextColor }]}
              >
                Pravdepodobnosť, že ti bude chutiť
              </Text>
              <Text
                variant="headlineLarge"
                style={[styles.scoreValue, { color: scoreTextColor }]}
              >
                {likePrediction.score}%
              </Text>
            </Surface>

            <Text
              variant="titleMedium"
              style={[styles.predictionVerdict, { color: theme.colors.onSurface }]}
            >
              {likePrediction.verdict}
            </Text>
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {likePrediction.reason}
            </Text>

            {!canSave ? (
              <Card
                mode="contained"
                style={[styles.warningCard, { backgroundColor: theme.colors.primaryContainer }]}
              >
                <Card.Content style={styles.warningContent}>
                  <Text
                    variant="labelLarge"
                    style={{ color: theme.colors.onPrimaryContainer }}
                  >
                    Recept sa dá uložiť až od {APPROVAL_THRESHOLD}%.
                  </Text>
                </Card.Content>
              </Card>
            ) : null}
          </Card.Content>
        </Card>

        {/* Parameters Card */}
        <Card
          mode="elevated"
          elevation={1}
          style={[styles.card, { backgroundColor: theme.colors.surface }]}
        >
          <Card.Content style={styles.cardContent}>
            <Text
              variant="labelLarge"
              style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}
            >
              Parametre
            </Text>

            <View style={styles.paramGrid}>
              <Card
                mode="contained"
                style={[styles.paramItem, { backgroundColor: theme.colors.surfaceVariant }]}
              >
                <Card.Content style={styles.paramItemContent}>
                  <Text
                    variant="labelMedium"
                    style={[styles.paramLabel, { color: theme.colors.onSurfaceVariant }]}
                  >
                    Metóda
                  </Text>
                  <Text
                    variant="titleMedium"
                    style={{ color: theme.colors.onSurface }}
                  >
                    {selectedPreparation}
                  </Text>
                </Card.Content>
              </Card>

              <Card
                mode="contained"
                style={[styles.paramItem, { backgroundColor: theme.colors.surfaceVariant }]}
              >
                <Card.Content style={styles.paramItemContent}>
                  <Text
                    variant="labelMedium"
                    style={[styles.paramLabel, { color: theme.colors.onSurfaceVariant }]}
                  >
                    Sila
                  </Text>
                  <Text
                    variant="titleMedium"
                    style={{ color: theme.colors.onSurface }}
                  >
                    {strengthPreference}
                  </Text>
                </Card.Content>
              </Card>

              <Card
                mode="contained"
                style={[styles.paramItem, { backgroundColor: theme.colors.surfaceVariant }]}
              >
                <Card.Content style={styles.paramItemContent}>
                  <Text
                    variant="labelMedium"
                    style={[styles.paramLabel, { color: theme.colors.onSurfaceVariant }]}
                  >
                    Dávka
                  </Text>
                  <Text
                    variant="titleMedium"
                    style={{ color: theme.colors.onSurface }}
                  >
                    {recipe.dose}
                  </Text>
                </Card.Content>
              </Card>

              <Card
                mode="contained"
                style={[styles.paramItem, { backgroundColor: theme.colors.surfaceVariant }]}
              >
                <Card.Content style={styles.paramItemContent}>
                  <Text
                    variant="labelMedium"
                    style={[styles.paramLabel, { color: theme.colors.onSurfaceVariant }]}
                  >
                    Voda
                  </Text>
                  <Text
                    variant="titleMedium"
                    style={{ color: theme.colors.onSurface }}
                  >
                    {recipe.water}
                  </Text>
                </Card.Content>
              </Card>

              <Card
                mode="contained"
                style={[styles.paramItem, { backgroundColor: theme.colors.surfaceVariant }]}
              >
                <Card.Content style={styles.paramItemContent}>
                  <Text
                    variant="labelMedium"
                    style={[styles.paramLabel, { color: theme.colors.onSurfaceVariant }]}
                  >
                    Mletie
                  </Text>
                  <Text
                    variant="titleMedium"
                    style={{ color: theme.colors.onSurface }}
                  >
                    {recipe.grind}
                  </Text>
                </Card.Content>
              </Card>

              <Card
                mode="contained"
                style={[styles.paramItem, { backgroundColor: theme.colors.surfaceVariant }]}
              >
                <Card.Content style={styles.paramItemContent}>
                  <Text
                    variant="labelMedium"
                    style={[styles.paramLabel, { color: theme.colors.onSurfaceVariant }]}
                  >
                    Teplota
                  </Text>
                  <Text
                    variant="titleMedium"
                    style={{ color: theme.colors.onSurface }}
                  >
                    {recipe.waterTemp}
                  </Text>
                </Card.Content>
              </Card>

              <Card
                mode="contained"
                style={[styles.paramItem, styles.paramItemFull, { backgroundColor: theme.colors.surfaceVariant }]}
              >
                <Card.Content style={styles.paramItemContent}>
                  <Text
                    variant="labelMedium"
                    style={[styles.paramLabel, { color: theme.colors.onSurfaceVariant }]}
                  >
                    Čas
                  </Text>
                  <Text
                    variant="titleMedium"
                    style={{ color: theme.colors.onSurface }}
                  >
                    {recipe.totalTime}
                  </Text>
                </Card.Content>
              </Card>
            </View>
          </Card.Content>
        </Card>

        {/* Flavor Notes from Analysis */}
        {analysis.flavorNotes && analysis.flavorNotes.length > 0 ? (
          <Card
            mode="elevated"
            elevation={1}
            style={[styles.card, { backgroundColor: theme.colors.surface }]}
          >
            <Card.Content style={styles.cardContent}>
              <Text
                variant="labelLarge"
                style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}
              >
                Chuťové tóny
              </Text>
              <View style={styles.chipRow}>
                {analysis.flavorNotes.map((note) => (
                  <Chip
                    key={note}
                    mode="flat"
                    style={[styles.flavorChip, { backgroundColor: theme.colors.secondaryContainer }]}
                    textStyle={{ color: theme.colors.onSecondaryContainer }}
                  >
                    {note}
                  </Chip>
                ))}
              </View>
            </Card.Content>
          </Card>
        ) : null}

        {/* Steps Card */}
        <Card
          mode="elevated"
          elevation={1}
          style={[styles.card, { backgroundColor: theme.colors.surface }]}
        >
          <Card.Content style={styles.cardContent}>
            <Text
              variant="labelLarge"
              style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}
            >
              Postup
            </Text>
            {recipe.steps.map((step: string, index: number) => (
              <View key={`${step}-${index}`}>
                <View style={styles.stepRow}>
                  <Surface
                    style={[styles.stepNumberSurface, { backgroundColor: theme.colors.primaryContainer }]}
                    elevation={0}
                  >
                    <Text
                      variant="labelLarge"
                      style={{ color: theme.colors.onPrimaryContainer }}
                    >
                      {index + 1}
                    </Text>
                  </Surface>
                  <Text
                    variant="bodyLarge"
                    style={[styles.stepText, { color: theme.colors.onSurface }]}
                  >
                    {step}
                  </Text>
                </View>
                {index < recipe.steps.length - 1 ? (
                  <Divider style={[styles.stepDivider, { backgroundColor: theme.colors.outlineVariant }]} />
                ) : null}
              </View>
            ))}
          </Card.Content>
        </Card>

        {/* Barista Tips Card */}
        <Card
          mode="elevated"
          elevation={1}
          style={[styles.card, { backgroundColor: theme.colors.surface }]}
        >
          <Card.Content style={styles.cardContent}>
            <Text
              variant="labelLarge"
              style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}
            >
              Barista tipy
            </Text>
            {recipe.baristaTips.map((tip: string, index: number) => (
              <View key={`${tip}-${index}`} style={styles.tipRow}>
                <View
                  style={[styles.tipDot, { backgroundColor: theme.colors.primary }]}
                />
                <Text
                  variant="bodyLarge"
                  style={[styles.tipText, { color: theme.colors.onSurface }]}
                >
                  {tip}
                </Text>
              </View>
            ))}
          </Card.Content>
        </Card>

        {/* Actions */}
        <Button
          mode="contained"
          onPress={handleSaveRecipe}
          disabled={!canSave || saveState === 'saving'}
          loading={saveState === 'saving'}
          contentStyle={styles.primaryButtonContent}
          style={styles.primaryButton}
        >
          {saveState === 'saving' ? 'Ukladám…' : 'Uložiť recept'}
        </Button>

        <Button
          mode="outlined"
          onPress={() => navigation.navigate('CoffeeRecipesSaved')}
          contentStyle={styles.secondaryButtonContent}
          style={styles.secondaryButton}
        >
          Prejsť na Saved Recipes
        </Button>

        {/* Success / Error banners */}
        {saveState === 'saved' ? (
          <Card
            mode="contained"
            style={[styles.bannerCard, { backgroundColor: theme.colors.secondaryContainer }]}
          >
            <Card.Content>
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.onSecondaryContainer }}
              >
                Recept uložený.
              </Text>
            </Card.Content>
          </Card>
        ) : null}

        {saveState === 'error' ? (
          <Card
            mode="contained"
            style={[styles.bannerCard, { backgroundColor: theme.colors.errorContainer }]}
          >
            <Card.Content>
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.error }}
              >
                {errorMessage}
              </Text>
            </Card.Content>
          </Card>
        ) : null}
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
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },

  // Title
  title: {
    marginBottom: spacing.xs,
  },

  // Cards
  card: {
    borderRadius: spacing.lg,
  },
  cardContent: {
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  sectionLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },

  // Score Surface
  scoreSurface: {
    borderRadius: spacing.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  scoreLabel: {
    flex: 1,
    marginRight: spacing.sm,
  },
  scoreValue: {
    // color via theme inline
  },
  predictionVerdict: {
    marginBottom: spacing.xs,
  },

  // Warning card
  warningCard: {
    borderRadius: spacing.md,
    marginTop: spacing.sm,
  },
  warningContent: {
    paddingVertical: spacing.sm,
  },

  // Parameters grid
  paramGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  paramItem: {
    borderRadius: spacing.md,
    minWidth: '47%',
    flex: 1,
  },
  paramItemFull: {
    flexBasis: '100%',
    flex: 0,
    width: '100%',
  },
  paramItemContent: {
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  paramLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  // Flavor chips
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  flavorChip: {
    // background via inline
  },

  // Steps
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  stepNumberSurface: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  stepText: {
    flex: 1,
  },
  stepDivider: {
    marginVertical: spacing.xs,
  },

  // Tips
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  tipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: spacing.sm,
    flexShrink: 0,
  },
  tipText: {
    flex: 1,
  },

  // Buttons
  primaryButton: {
    borderRadius: 12,
  },
  primaryButtonContent: {
    height: 52,
  },
  secondaryButton: {
    borderRadius: 12,
  },
  secondaryButtonContent: {
    height: 52,
  },

  // Banners
  bannerCard: {
    borderRadius: spacing.md,
  },
});

export default CoffeePhotoRecipeResultScreen;
