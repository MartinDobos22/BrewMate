import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Text,
  Card,
  Surface,
  Button,
  Chip,
  Divider,
  ProgressBar,
  useTheme,
} from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';

import { HomeStackParamList } from '../navigation/types';
import {
  loadLatestQuestionnaireResult,
  QuestionnaireResultPayload,
  SaveEntry,
  saveCoffeeProfile,
} from '../utils/localSave';
import { apiFetch, DEFAULT_API_HOST } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import spacing, { radii } from '../styles/spacing';

type Props = NativeStackScreenProps<HomeStackParamList, 'OcrResult'>;

type MatchResult = {
  willLike: boolean;
  confidence: number;
  baristaSummary: string;
  laymanSummary: string;
  keyMatches: string[];
  keyConflicts: string[];
  suggestedAdjustments: string;
};

function OcrResultScreen({ route }: Props) {
  const theme = useTheme<MD3Theme>();
  const { rawText, correctedText, coffeeProfile, labelImageBase64 } = route.params;
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [matchState, setMatchState] = useState<
    'idle' | 'loading' | 'ready' | 'missing' | 'error'
  >('idle');
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [matchError, setMatchError] = useState('');
  const [questionnaireSnapshot, setQuestionnaireSnapshot] = useState<
    SaveEntry<QuestionnaireResultPayload> | null
  >(null);
  const [inventoryState, setInventoryState] = useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle');
  const [inventoryError, setInventoryError] = useState('');
  const [showInventoryDetails, setShowInventoryDetails] = useState(false);
  const [packageSizeG, setPackageSizeG] = useState('');
  const [remainingG, setRemainingG] = useState('');
  const { user } = useAuth();

  const handleSave = useCallback(async () => {
    try {
      console.log('[OcrResult] Saving coffee profile locally');
      setSaveState('saving');
      await saveCoffeeProfile({ rawText, correctedText, coffeeProfile });
      setSaveState('saved');
      console.log('[OcrResult] Coffee profile saved locally');
    } catch (error) {
      console.error('[OcrResult] Failed to save locally', error);
      setSaveState('error');
    }
  }, [coffeeProfile, correctedText, rawText]);

  const handleInventorySave = useCallback(async () => {
    if (!user) {
      setInventoryState('error');
      setInventoryError('Najprv sa prihlás.');
      return;
    }

    try {
      setInventoryState('saving');
      setInventoryError('');
      const response = await apiFetch(
        `${DEFAULT_API_HOST}/api/user-coffee`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            rawText,
            correctedText,
            labelImageBase64,
            coffeeProfile,
            aiMatchResult: matchResult,
            packageSizeG:
              packageSizeG.trim().length > 0
                ? Number.parseInt(packageSizeG, 10)
                : null,
            remainingG: remainingG.trim().length > 0 ? Number.parseInt(remainingG, 10) : null,
            trackingMode: remainingG.trim().length > 0 || packageSizeG.trim().length > 0
              ? 'manual'
              : 'estimated',
          }),
        },
        {
          feature: 'OcrResult',
          action: 'save-user-coffee',
        },
      );

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          payload?.error || 'Nepodarilo sa uložiť kávu do inventára.';
        setInventoryError(message);
        setInventoryState('error');
        return;
      }

      setInventoryState('saved');
      setShowInventoryDetails(false);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Nepodarilo sa uložiť kávu do inventára.';
      setInventoryError(message);
      setInventoryState('error');
    }
  }, [
    coffeeProfile,
    correctedText,
    labelImageBase64,
    matchResult,
    packageSizeG,
    rawText,
    remainingG,
    user,
  ]);

  useEffect(() => {
    let isActive = true;

    const loadMatch = async () => {
      console.log('[OcrResult] Loading latest questionnaire snapshot');
      setMatchState('loading');
      setMatchError('');
      setMatchResult(null);
      setQuestionnaireSnapshot(null);

      const latestQuestionnaire = await loadLatestQuestionnaireResult();
      if (!latestQuestionnaire?.payload) {
        if (isActive) {
          console.warn('[OcrResult] Missing questionnaire snapshot for match');
          setMatchState('missing');
        }
        return;
      }

      if (isActive) {
        setQuestionnaireSnapshot(latestQuestionnaire);
      }

      try {
        const matchRequestStart = Date.now();
        console.log('[OcrResult] Requesting coffee match', {
          apiHost: DEFAULT_API_HOST,
        });
        console.log('[OcrResult] OpenAI coffee match request via backend', {
          endpoint: '/api/coffee-match',
        });
        const response = await apiFetch(
          `${DEFAULT_API_HOST}/api/coffee-match`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              questionnaire: latestQuestionnaire.payload,
              coffeeProfile,
            }),
          },
          {
            feature: 'OcrResult',
            action: 'coffee-match',
          },
        );

        const payload = await response.json();
        console.log('[OcrResult] OpenAI coffee match response content', {
          payload,
        });

        if (!response.ok) {
          const message =
            payload?.error || 'Nepodarilo sa porovnať kávu s dotazníkom.';
          console.error('[OcrResult] Coffee match request failed', {
            message,
            payload,
          });
          if (isActive) {
            setMatchError(message);
            setMatchState('error');
          }
          return;
        }

        if (isActive) {
          setMatchResult(payload.match);
          setMatchState('ready');
          console.log('[OcrResult] Coffee match ready', {
            durationMs: Date.now() - matchRequestStart,
          });
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Nepodarilo sa porovnať kávu s dotazníkom.';
        if (isActive) {
          setMatchError(message);
          setMatchState('error');
        }
        console.error('[OcrResult] Coffee match failed', error);
      }
    };

    loadMatch();

    return () => {
      isActive = false;
    };
  }, [coffeeProfile]);

  const verdictLabel = useMemo(() => {
    if (!matchResult) {
      return '';
    }
    return matchResult.willLike
      ? 'Táto káva ti pravdepodobne bude chutiť.'
      : 'Táto káva ti pravdepodobne chutiť nebude.';
  }, [matchResult]);

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      edges={['bottom']}
    >
      <ScrollView
        style={[styles.scroll, { backgroundColor: theme.colors.background }]}
        contentContainerStyle={styles.content}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text variant="headlineMedium" style={{ color: theme.colors.onSurface }}>
            Výsledok OCR
          </Text>
        </View>

        {/* Local save row */}
        <View style={styles.saveRow}>
          <Button
            mode="outlined"
            onPress={handleSave}
            disabled={saveState === 'saving'}
            style={styles.outlineButton}
            contentStyle={styles.buttonContent}
          >
            {saveState === 'saving' ? 'Ukladám...' : 'Uložiť lokálne'}
          </Button>
          {saveState === 'saved' ? (
            <Text
              variant="labelLarge"
              style={[styles.saveHint, { color: theme.colors.secondary }]}
            >
              Uložené do zariadenia.
            </Text>
          ) : null}
          {saveState === 'error' ? (
            <Text
              variant="labelLarge"
              style={[styles.saveHint, { color: theme.colors.error }]}
            >
              Uloženie zlyhalo.
            </Text>
          ) : null}
        </View>

        {/* Inventory card */}
        <Card mode="elevated" elevation={1} style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <Text
              variant="titleMedium"
              style={[styles.sectionLabel, { color: theme.colors.onSurface }]}
            >
              Inventár
            </Text>
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onSurfaceVariant, lineHeight: 22 }}
            >
              Ak si túto kávu nekúpil, nič nemusíš vypĺňať. Inventár je len voliteľný.
            </Text>

            {!showInventoryDetails ? (
              <Button
                mode="contained"
                onPress={() => {
                  setInventoryState('idle');
                  setInventoryError('');
                  setShowInventoryDetails(true);
                }}
                style={styles.inventoryButton}
                contentStyle={styles.buttonContent}
              >
                Kúpil som ju, pridať do inventára
              </Button>
            ) : null}

            {showInventoryDetails ? (
              <>
                <Text
                  variant="labelLarge"
                  style={[styles.fieldLabel, { color: theme.colors.onSurfaceVariant }]}
                >
                  Veľkosť balíka (voliteľné)
                </Text>
                <View style={styles.chipsRow}>
                  {['', '250', '500', '1000'].map((value) => {
                    const isActive = packageSizeG === value;
                    return (
                      <Chip
                        key={value || 'empty'}
                        selected={isActive}
                        onPress={() => setPackageSizeG(value)}
                        mode={isActive ? 'flat' : 'outlined'}
                        style={
                          isActive
                            ? { backgroundColor: theme.colors.primary }
                            : { backgroundColor: 'transparent' }
                        }
                        textStyle={
                          isActive
                            ? { color: theme.colors.onPrimary }
                            : { color: theme.colors.onSurface }
                        }
                      >
                        {value ? `${value} g` : 'nechať prázdne'}
                      </Chip>
                    );
                  })}
                </View>

                <Text
                  variant="labelLarge"
                  style={[styles.fieldLabel, { color: theme.colors.onSurfaceVariant }]}
                >
                  Zostáva teraz (voliteľné)
                </Text>
                <View style={styles.remainingDisplayRow}>
                  <Text
                    variant="labelLarge"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    g
                  </Text>
                  <Text
                    variant="titleMedium"
                    style={{ color: theme.colors.onSurface }}
                  >
                    {remainingG.trim().length > 0 ? remainingG : 'nevyplnené'}
                  </Text>
                </View>
                <View style={styles.chipsRow}>
                  {['', '50', '100', '150', '200'].map((value) => {
                    const isActive = remainingG === value;
                    return (
                      <Chip
                        key={value || 'none'}
                        selected={isActive}
                        onPress={() => setRemainingG(value)}
                        mode={isActive ? 'flat' : 'outlined'}
                        style={
                          isActive
                            ? { backgroundColor: theme.colors.primary }
                            : { backgroundColor: 'transparent' }
                        }
                        textStyle={
                          isActive
                            ? { color: theme.colors.onPrimary }
                            : { color: theme.colors.onSurface }
                        }
                      >
                        {value ? `${value} g` : 'nechať prázdne'}
                      </Chip>
                    );
                  })}
                </View>
              </>
            ) : null}

            {showInventoryDetails ? (
              <Button
                mode="contained"
                onPress={handleInventorySave}
                disabled={inventoryState === 'saving' || !user}
                style={styles.inventoryButton}
                contentStyle={styles.buttonContent}
              >
                {inventoryState === 'saving' ? 'Ukladám...' : 'Uložiť do inventára'}
              </Button>
            ) : null}

            {!user ? (
              <Text
                variant="bodyMedium"
                style={[styles.helperNote, { color: theme.colors.onSurfaceVariant }]}
              >
                Pre uloženie do inventára sa musíš prihlásiť.
              </Text>
            ) : null}
            {inventoryState === 'saved' ? (
              <Text
                variant="labelLarge"
                style={[styles.saveHint, { color: theme.colors.secondary }]}
              >
                Káva uložená v inventári.
              </Text>
            ) : null}
            {inventoryState === 'error' ? (
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.error, marginTop: spacing.sm }}
              >
                {inventoryError}
              </Text>
            ) : null}
          </Card.Content>
        </Card>

        {/* OCR text blocks */}
        <Card mode="elevated" elevation={1} style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <Text
              variant="titleMedium"
              style={[styles.sectionLabel, { color: theme.colors.onSurface }]}
            >
              Oskenovaný text
            </Text>
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onSurface, lineHeight: 22 }}
            >
              {rawText}
            </Text>
          </Card.Content>
        </Card>

        <Card mode="elevated" elevation={1} style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <Text
              variant="titleMedium"
              style={[styles.sectionLabel, { color: theme.colors.onSurface }]}
            >
              Opravený text
            </Text>
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onSurface, lineHeight: 22 }}
            >
              {correctedText}
            </Text>
          </Card.Content>
        </Card>

        {/* Taste profile card */}
        <Card mode="elevated" elevation={1} style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <Text
              variant="titleMedium"
              style={[styles.sectionLabel, { color: theme.colors.onSurface }]}
            >
              Chuťový profil
            </Text>

            <Text
              variant="labelLarge"
              style={[styles.fieldLabel, { color: theme.colors.onSurfaceVariant }]}
            >
              Chuťové tóny
            </Text>
            {coffeeProfile.flavorNotes.length > 0 ? (
              <View style={styles.chipsRow}>
                {coffeeProfile.flavorNotes.map((note, index) => (
                  <Chip
                    key={index}
                    mode="flat"
                    style={{ backgroundColor: theme.colors.secondaryContainer }}
                    textStyle={{ color: theme.colors.onSecondaryContainer }}
                  >
                    {note}
                  </Chip>
                ))}
              </View>
            ) : (
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.onSurface }}
              >
                Neurčené
              </Text>
            )}

            <Divider style={styles.divider} />

            <Text
              variant="labelLarge"
              style={[styles.fieldLabel, { color: theme.colors.onSurfaceVariant }]}
            >
              Profil chuti
            </Text>
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onSurface, lineHeight: 22 }}
            >
              {coffeeProfile.tasteProfile}
            </Text>

            <Text
              variant="labelLarge"
              style={[styles.fieldLabel, { color: theme.colors.onSurfaceVariant }]}
            >
              Odborný popis
            </Text>
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onSurface, lineHeight: 22 }}
            >
              {coffeeProfile.expertSummary}
            </Text>

            <Text
              variant="labelLarge"
              style={[styles.fieldLabel, { color: theme.colors.onSurfaceVariant }]}
            >
              Popis pre laika
            </Text>
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onSurface, lineHeight: 22 }}
            >
              {coffeeProfile.laymanSummary}
            </Text>

            <Text
              variant="labelLarge"
              style={[styles.fieldLabel, { color: theme.colors.onSurfaceVariant }]}
            >
              Komu bude chutiť
            </Text>
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onSurface, lineHeight: 22 }}
            >
              {coffeeProfile.preferenceHint}
            </Text>

            <Text
              variant="labelLarge"
              style={[styles.fieldLabel, { color: theme.colors.onSurfaceVariant }]}
            >
              Prečo tieto tóny
            </Text>
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onSurface, lineHeight: 22 }}
            >
              {coffeeProfile.reasoning}
            </Text>

            <Text
              variant="labelLarge"
              style={[styles.fieldLabel, { color: theme.colors.onSurfaceVariant }]}
            >
              Istota
            </Text>
            <ProgressBar
              progress={coffeeProfile.confidence}
              color={theme.colors.primary}
              style={[styles.confidenceBar, { backgroundColor: theme.colors.outlineVariant }]}
            />
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onSurfaceVariant, marginTop: spacing.xs }}
            >
              {Math.round(coffeeProfile.confidence * 100)}%
            </Text>

            {coffeeProfile.missingInfo?.length ? (
              <>
                <Text
                  variant="labelLarge"
                  style={[styles.fieldLabel, { color: theme.colors.onSurfaceVariant }]}
                >
                  Chýbajúce informácie
                </Text>
                <Text
                  variant="bodyMedium"
                  style={{ color: theme.colors.onSurface, lineHeight: 22 }}
                >
                  {coffeeProfile.missingInfo.join(', ')}
                </Text>
              </>
            ) : null}
          </Card.Content>
        </Card>

        {/* Match card */}
        <Card mode="elevated" elevation={1} style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <Text
              variant="titleMedium"
              style={[styles.sectionLabel, { color: theme.colors.onSurface }]}
            >
              Zhoda s dotazníkom
            </Text>

            {matchState === 'loading' ? (
              <>
                <ProgressBar
                  indeterminate
                  color={theme.colors.primary}
                  style={[styles.confidenceBar, { backgroundColor: theme.colors.outlineVariant }]}
                />
                <Text
                  variant="bodyMedium"
                  style={{ color: theme.colors.onSurfaceVariant, marginTop: spacing.sm }}
                >
                  Porovnávam s dotazníkom…
                </Text>
              </>
            ) : null}
            {matchState === 'missing' ? (
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.onSurfaceVariant, lineHeight: 22 }}
              >
                Zatiaľ nemám uložený výsledok dotazníka. Najprv ho vyplňte a uložte,
                aby som vedel porovnávať.
              </Text>
            ) : null}
            {matchState === 'error' ? (
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.error }}
              >
                {matchError}
              </Text>
            ) : null}

            {matchState === 'ready' && matchResult ? (
              <>
                {/* Verdict badge using Surface */}
                <Surface
                  style={[
                    styles.verdictBadge,
                    {
                      backgroundColor: matchResult.willLike
                        ? theme.colors.secondaryContainer
                        : theme.colors.errorContainer,
                    },
                  ]}
                  elevation={0}
                >
                  <Text
                    variant="titleMedium"
                    style={{
                      color: matchResult.willLike
                        ? theme.colors.onSecondaryContainer
                        : theme.colors.error,
                      fontWeight: '700',
                    }}
                  >
                    {verdictLabel}
                  </Text>
                  <Text
                    variant="labelMedium"
                    style={{
                      color: matchResult.willLike
                        ? theme.colors.onSecondaryContainer
                        : theme.colors.error,
                      marginTop: spacing.xs,
                      opacity: 0.8,
                    }}
                  >
                    Istota: {Math.round(matchResult.confidence * 100)}%
                  </Text>
                </Surface>

                <Text
                  variant="labelLarge"
                  style={[styles.fieldLabel, { color: theme.colors.onSurfaceVariant }]}
                >
                  Pre baristu
                </Text>
                <Text
                  variant="bodyMedium"
                  style={{ color: theme.colors.onSurface, lineHeight: 22 }}
                >
                  {matchResult.baristaSummary}
                </Text>

                <Text
                  variant="labelLarge"
                  style={[styles.fieldLabel, { color: theme.colors.onSurfaceVariant }]}
                >
                  Pre laika
                </Text>
                <Text
                  variant="bodyMedium"
                  style={{ color: theme.colors.onSurface, lineHeight: 22 }}
                >
                  {matchResult.laymanSummary}
                </Text>

                <Text
                  variant="labelLarge"
                  style={[styles.fieldLabel, { color: theme.colors.onSurfaceVariant }]}
                >
                  Kľúčové zhody
                </Text>
                {matchResult.keyMatches.length > 0 ? (
                  <View style={styles.chipsRow}>
                    {matchResult.keyMatches.map((match, index) => (
                      <Chip
                        key={index}
                        mode="flat"
                        style={{ backgroundColor: theme.colors.secondaryContainer }}
                        textStyle={{ color: theme.colors.onSecondaryContainer }}
                      >
                        {match}
                      </Chip>
                    ))}
                  </View>
                ) : (
                  <Text
                    variant="bodyMedium"
                    style={{ color: theme.colors.onSurface }}
                  >
                    Žiadne výrazné zhody.
                  </Text>
                )}

                <Text
                  variant="labelLarge"
                  style={[styles.fieldLabel, { color: theme.colors.onSurfaceVariant }]}
                >
                  Potenciálne konflikty
                </Text>
                {matchResult.keyConflicts.length > 0 ? (
                  <View style={styles.chipsRow}>
                    {matchResult.keyConflicts.map((conflict, index) => (
                      <Chip
                        key={index}
                        mode="flat"
                        style={{ backgroundColor: theme.colors.errorContainer }}
                        textStyle={{ color: theme.colors.error }}
                      >
                        {conflict}
                      </Chip>
                    ))}
                  </View>
                ) : (
                  <Text
                    variant="bodyMedium"
                    style={{ color: theme.colors.onSurface }}
                  >
                    Žiadne výrazné konflikty.
                  </Text>
                )}

                <Text
                  variant="labelLarge"
                  style={[styles.fieldLabel, { color: theme.colors.onSurfaceVariant }]}
                >
                  Ako si ju upraviť
                </Text>
                <Text
                  variant="bodyMedium"
                  style={{ color: theme.colors.onSurface, lineHeight: 22 }}
                >
                  {matchResult.suggestedAdjustments}
                </Text>

                {questionnaireSnapshot ? (
                  <Text
                    variant="bodyMedium"
                    style={[styles.helperNote, { color: theme.colors.onSurfaceVariant }]}
                  >
                    Porovnávané s posledným uloženým dotazníkom z{' '}
                    {new Date(questionnaireSnapshot.savedAt).toLocaleDateString(
                      'sk-SK',
                    )}
                    .
                  </Text>
                ) : null}
              </>
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
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  header: {
    marginBottom: spacing.sm,
  },
  saveRow: {
    gap: spacing.sm,
  },
  outlineButton: {
    borderRadius: radii.md,
  },
  buttonContent: {
    paddingVertical: spacing.xs,
  },
  saveHint: {
    paddingHorizontal: spacing.xs,
  },
  card: {
    borderRadius: radii.lg,
  },
  cardContent: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  sectionLabel: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  remainingDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  inventoryButton: {
    marginTop: spacing.md,
    borderRadius: radii.md,
  },
  helperNote: {
    marginTop: spacing.md,
    lineHeight: 18,
  },
  verdictBadge: {
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  confidenceBar: {
    height: 6,
    borderRadius: radii.full,
    marginTop: spacing.xs,
  },
  divider: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
});

export default OcrResultScreen;
