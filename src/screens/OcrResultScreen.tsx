import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../navigation/types';
import {
  loadLatestQuestionnaireResult,
  QuestionnaireResultPayload,
  SaveEntry,
  saveCoffeeProfile,
} from '../utils/localSave';
import { apiFetch, DEFAULT_API_HOST } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import BottomNavBar from '../components/BottomNavBar';
import {
  MatchTier,
  MATCH_TIER_LABELS,
  MATCH_TIER_COLORS,
} from '../utils/tasteVector';
import { useTheme } from '../theme/useTheme';
import { ScanIcon, CoffeeBeanIcon, SparklesIcon } from '../components/icons';
import { MD3Button, Chip } from '../components/md3';

type Props = NativeStackScreenProps<RootStackParamList, 'OcrResult'>;

type MatchResult = {
  matchScore: number;
  matchTier: MatchTier;
  confidence: number;
  baristaSummary: string;
  laymanSummary: string;
  keyMatches: string[];
  keyConflicts: string[];
  suggestedAdjustments: string;
  adventureNote: string;
};

function OcrResultScreen({ route }: Props) {
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
      if (!isActive) { return; }
      setMatchState('loading');
      setMatchError('');
      setMatchResult(null);
      setQuestionnaireSnapshot(null);

      const latestQuestionnaire = await loadLatestQuestionnaireResult();
      if (!isActive) { return; }
      if (!latestQuestionnaire?.payload) {
        console.warn('[OcrResult] Missing questionnaire snapshot for match');
        setMatchState('missing');
        return;
      }

      setQuestionnaireSnapshot(latestQuestionnaire);

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

        const payload = await response.json().catch(() => null);
        if (!isActive) { return; }
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
          setMatchError(message);
          setMatchState('error');
          return;
        }

        if (!payload?.match) {
          console.error('[OcrResult] Coffee match response missing match field', { payload });
          setMatchError('Odpoveď servera neobsahovala výsledok porovnania.');
          setMatchState('error');
          return;
        }

        setMatchResult(payload.match);
        setMatchState('ready');
        console.log('[OcrResult] Coffee match ready', {
          durationMs: Date.now() - matchRequestStart,
        });
      } catch (error) {
        if (!isActive) { return; }
        const message =
          error instanceof Error
            ? error.message
            : 'Nepodarilo sa porovnať kávu s dotazníkom.';
        setMatchError(message);
        setMatchState('error');
        console.error('[OcrResult] Coffee match failed', error);
      }
    };

    loadMatch();

    return () => {
      isActive = false;
    };
  }, [coffeeProfile]);

  const { colors, typescale, shape, elevation: elev, spacing } = useTheme();

  const verdictLabel = useMemo(() => {
    if (!matchResult) {
      return '';
    }
    return MATCH_TIER_LABELS[matchResult.matchTier] || 'Neznáme hodnotenie';
  }, [matchResult]);

  const tierColors = useMemo(() => {
    if (!matchResult) {
      return MATCH_TIER_COLORS.worth_trying;
    }
    return MATCH_TIER_COLORS[matchResult.matchTier] || MATCH_TIER_COLORS.worth_trying;
  }, [matchResult]);

  const s = useMemo(
    () =>
      StyleSheet.create({
        safeArea: {
          flex: 1,
          backgroundColor: colors.background,
        },
        container: {
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.lg,
          paddingBottom: 106,
          gap: spacing.md,
        },
        headerRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
        },
        overline: {
          ...typescale.labelMedium,
          color: colors.onSurfaceVariant,
          textTransform: 'uppercase',
        },
        title: {
          ...typescale.headlineMedium,
          color: colors.onSurface,
        },
        card: {
          backgroundColor: colors.surfaceContainerLow,
          borderRadius: shape.extraLarge,
          padding: spacing.lg,
          ...elev.level1.shadow,
        },
        cardHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          marginBottom: spacing.md,
        },
        cardTitle: {
          ...typescale.titleSmall,
          color: colors.onSurface,
        },
        subsectionTitle: {
          ...typescale.labelLarge,
          color: colors.primary,
          marginTop: spacing.md,
          marginBottom: spacing.xs,
        },
        bodyText: {
          ...typescale.bodyMedium,
          color: colors.onSurface,
        },
        errorText: {
          ...typescale.bodyMedium,
          color: colors.error,
          fontWeight: '600',
        },
        saveHint: {
          ...typescale.bodySmall,
          color: colors.tertiary,
          fontWeight: '600',
          marginTop: spacing.sm,
        },
        saveError: {
          ...typescale.bodySmall,
          color: colors.error,
          fontWeight: '600',
          marginTop: spacing.sm,
        },
        helperNote: {
          ...typescale.bodySmall,
          color: colors.onSurfaceVariant,
          marginTop: spacing.md,
        },
        packageOptionsRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.sm,
          marginBottom: spacing.sm,
        },
        packageOption: {
          borderWidth: 1,
          borderColor: colors.outlineVariant,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          borderRadius: shape.full,
          backgroundColor: colors.surfaceContainerLowest,
        },
        packageOptionActive: {
          borderColor: colors.tertiary,
          backgroundColor: colors.tertiaryContainer,
        },
        packageOptionText: {
          ...typescale.labelSmall,
          color: colors.onSurfaceVariant,
        },
        packageOptionTextActive: {
          color: colors.onTertiaryContainer,
        },
        remainingInputWrap: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs + 2,
          marginBottom: spacing.sm,
        },
        remainingPrefix: {
          ...typescale.bodySmall,
          color: colors.onSurfaceVariant,
        },
        remainingValue: {
          ...typescale.labelMedium,
          color: colors.onSurface,
        },
        flavorRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.sm,
        },
        loadingRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
        },
        verdictBadge: {
          borderRadius: shape.large,
          padding: spacing.md,
          marginBottom: spacing.md,
        },
        verdictText: {
          ...typescale.titleMedium,
          color: colors.onSurface,
        },
        scoreRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: spacing.xs + 2,
        },
        scoreText: {
          ...typescale.labelLarge,
          color: colors.onSurface,
        },
        verdictSubText: {
          ...typescale.bodySmall,
          color: colors.onSurfaceVariant,
        },
        scoreBarBackground: {
          height: 6,
          borderRadius: 3,
          backgroundColor: colors.outlineVariant,
          marginTop: spacing.sm,
          overflow: 'hidden' as const,
        },
        scoreBarFill: {
          height: 6,
          borderRadius: 3,
        },
        adventureNoteBlock: {
          backgroundColor: colors.secondaryContainer,
          borderRadius: shape.medium,
          padding: spacing.md,
          marginBottom: spacing.sm,
        },
      }),
    [colors, typescale, shape, elev, spacing],
  );

  return (
    <SafeAreaView style={s.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.container}>
        <View style={s.headerRow}>
          <ScanIcon size={20} color={colors.onSurfaceVariant} />
          <Text style={s.overline}>BrewMate Scanner</Text>
        </View>
        <Text style={s.title}>Výsledok skenovania kávy</Text>

        <View>
          <MD3Button
            label={saveState === 'saving' ? 'Ukladám...' : 'Uložiť lokálne'}
            onPress={handleSave}
            disabled={saveState === 'saving'}
            loading={saveState === 'saving'}
          />
          {saveState === 'saved' ? (
            <Text style={s.saveHint}>Uložené do zariadenia.</Text>
          ) : null}
          {saveState === 'error' ? (
            <Text style={s.saveError}>Uloženie zlyhalo.</Text>
          ) : null}
        </View>

        <View style={s.card}>
          <View style={s.cardHeader}>
            <CoffeeBeanIcon size={20} color={colors.primary} />
            <Text style={s.cardTitle}>Inventár</Text>
          </View>
          <Text style={s.bodyText}>
            Ak si túto kávu nekúpil, nič nemusíš vypĺňať. Inventár je len voliteľný.
          </Text>
          {!showInventoryDetails ? (
            <MD3Button
              label="Kúpil som ju, pridať do inventára"
              variant="tonal"
              onPress={() => {
                setInventoryState('idle');
                setInventoryError('');
                setShowInventoryDetails(true);
              }}
              style={{ marginTop: spacing.md }}
            />
          ) : null}
          {showInventoryDetails ? (
            <>
              <Text style={s.subsectionTitle}>Veľkosť balíka (voliteľné)</Text>
              <View style={s.packageOptionsRow}>
                {['', '250', '500', '1000'].map((value) => {
                  const isActive = packageSizeG === value;
                  return (
                    <Pressable
                      key={value || 'empty'}
                      style={[s.packageOption, isActive && s.packageOptionActive]}
                      onPress={() => setPackageSizeG(value)}
                    >
                      <Text
                        style={[
                          s.packageOptionText,
                          isActive && s.packageOptionTextActive,
                        ]}
                      >
                        {value ? `${value} g` : 'nechať prázdne'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={s.subsectionTitle}>Zostáva teraz (voliteľné)</Text>
              <View style={s.remainingInputWrap}>
                <Text style={s.remainingPrefix}>g</Text>
                <Text style={s.remainingValue}>
                  {remainingG.trim().length > 0 ? remainingG : 'nevyplnené'}
                </Text>
              </View>
              <View style={s.packageOptionsRow}>
                {['', '50', '100', '150', '200'].map((value) => {
                  const isActive = remainingG === value;
                  return (
                    <Pressable
                      key={value || 'none'}
                      style={[s.packageOption, isActive && s.packageOptionActive]}
                      onPress={() => setRemainingG(value)}
                    >
                      <Text
                        style={[
                          s.packageOptionText,
                          isActive && s.packageOptionTextActive,
                        ]}
                      >
                        {value ? `${value} g` : 'nechať prázdne'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}
          {showInventoryDetails ? (
            <MD3Button
              label={inventoryState === 'saving' ? 'Ukladám...' : 'Uložiť do inventára'}
              onPress={handleInventorySave}
              disabled={inventoryState === 'saving' || !user}
              loading={inventoryState === 'saving'}
              style={{ backgroundColor: colors.tertiary, marginTop: spacing.md }}
            />
          ) : null}
          {!user ? (
            <Text style={s.helperNote}>
              Pre uloženie do inventára sa musíš prihlásiť.
            </Text>
          ) : null}
          {inventoryState === 'saved' ? (
            <Text style={s.saveHint}>Káva uložená v inventári.</Text>
          ) : null}
          {inventoryState === 'error' ? (
            <Text style={s.saveError}>{inventoryError}</Text>
          ) : null}
        </View>

        <View style={s.card}>
          <View style={s.cardHeader}>
            <ScanIcon size={20} color={colors.primary} />
            <Text style={s.cardTitle}>Oskenovaný text</Text>
          </View>
          <Text style={s.bodyText}>{rawText}</Text>
        </View>

        <View style={s.card}>
          <View style={s.cardHeader}>
            <SparklesIcon size={20} color={colors.primary} />
            <Text style={s.cardTitle}>Opravený text</Text>
          </View>
          <Text style={s.bodyText}>{correctedText}</Text>
        </View>

        <View style={s.card}>
          <View style={s.cardHeader}>
            <CoffeeBeanIcon size={20} color={colors.primary} />
            <Text style={s.cardTitle}>Chuťový profil</Text>
          </View>

          <Text style={s.subsectionTitle}>Chuťové tóny</Text>
          {coffeeProfile.flavorNotes.length > 0 ? (
            <View style={s.flavorRow}>
              {coffeeProfile.flavorNotes.map((note: string, i: number) => (
                <Chip key={i} label={note} role="tertiary" />
              ))}
            </View>
          ) : (
            <Text style={s.bodyText}>Neurčené</Text>
          )}

          <Text style={s.subsectionTitle}>Profil chuti</Text>
          <Text style={s.bodyText}>{coffeeProfile.tasteProfile}</Text>
          <Text style={s.subsectionTitle}>Odborný popis</Text>
          <Text style={s.bodyText}>{coffeeProfile.expertSummary}</Text>
          <Text style={s.subsectionTitle}>Popis pre laika</Text>
          <Text style={s.bodyText}>{coffeeProfile.laymanSummary}</Text>
          <Text style={s.subsectionTitle}>Komu bude chutiť</Text>
          <Text style={s.bodyText}>{coffeeProfile.preferenceHint}</Text>
          <Text style={s.subsectionTitle}>Prečo tieto tóny</Text>
          <Text style={s.bodyText}>{coffeeProfile.reasoning}</Text>
          <Text style={s.subsectionTitle}>Istota</Text>
          <Text style={s.bodyText}>
            {Math.round(coffeeProfile.confidence * 100)}%
          </Text>
          {coffeeProfile.missingInfo?.length ? (
            <>
              <Text style={s.subsectionTitle}>Chýbajúce informácie</Text>
              <Text style={s.bodyText}>
                {coffeeProfile.missingInfo.join(', ')}
              </Text>
            </>
          ) : null}
        </View>

        <View style={s.card}>
          <View style={s.cardHeader}>
            <SparklesIcon size={20} color={colors.primary} />
            <Text style={s.cardTitle}>Zhoda s dotazníkom</Text>
          </View>

          {matchState === 'loading' ? (
            <View style={s.loadingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={s.bodyText}>Porovnávam s dotazníkom…</Text>
            </View>
          ) : null}
          {matchState === 'missing' ? (
            <Text style={s.bodyText}>
              Zatiaľ nemám uložený výsledok dotazníka. Najprv ho vyplňte a uložte,
              aby som vedel porovnávať.
            </Text>
          ) : null}
          {matchState === 'error' ? (
            <Text style={s.errorText}>{matchError}</Text>
          ) : null}
          {matchState === 'ready' && matchResult ? (
            <>
              <View
                style={[
                  s.verdictBadge,
                  {
                    backgroundColor: tierColors.bg,
                    borderColor: tierColors.border,
                    borderWidth: 1,
                  },
                ]}
              >
                <Text style={s.verdictText}>{verdictLabel}</Text>
                <View style={s.scoreRow}>
                  <Text style={s.scoreText}>
                    Zhoda: {Math.round(matchResult.matchScore)}%
                  </Text>
                  <Text style={s.verdictSubText}>
                    Istota: {Math.round(matchResult.confidence * 100)}%
                  </Text>
                </View>
                <View style={s.scoreBarBackground}>
                  <View
                    style={[
                      s.scoreBarFill,
                      {
                        width: `${Math.round(matchResult.matchScore)}%`,
                        backgroundColor: tierColors.border,
                      },
                    ]}
                  />
                </View>
              </View>
              {matchResult.adventureNote ? (
                <View style={s.adventureNoteBlock}>
                  <Text style={[s.subsectionTitle, { marginTop: 0 }]}>Prečo to skúsiť</Text>
                  <Text style={s.bodyText}>{matchResult.adventureNote}</Text>
                </View>
              ) : null}
              <Text style={s.subsectionTitle}>Pre laika</Text>
              <Text style={s.bodyText}>{matchResult.laymanSummary}</Text>
              <Text style={s.subsectionTitle}>Pre baristu</Text>
              <Text style={s.bodyText}>{matchResult.baristaSummary}</Text>
              <Text style={s.subsectionTitle}>Kľúčové zhody</Text>
              <Text style={s.bodyText}>
                {matchResult.keyMatches.length
                  ? matchResult.keyMatches.join(', ')
                  : 'Žiadne výrazné zhody.'}
              </Text>
              {matchResult.keyConflicts.length > 0 ? (
                <>
                  <Text style={s.subsectionTitle}>Potenciálne konflikty</Text>
                  <Text style={s.bodyText}>
                    {matchResult.keyConflicts.join(', ')}
                  </Text>
                </>
              ) : null}
              <Text style={s.subsectionTitle}>Ako si ju upraviť</Text>
              <Text style={s.bodyText}>{matchResult.suggestedAdjustments}</Text>
              {questionnaireSnapshot ? (
                <Text style={s.helperNote}>
                  Porovnávané s posledným uloženým dotazníkom z{' '}
                  {new Date(questionnaireSnapshot.savedAt).toLocaleDateString(
                    'sk-SK',
                  )}
                  .
                </Text>
              ) : null}
            </>
          ) : null}
        </View>
      </ScrollView>
      <BottomNavBar />
    </SafeAreaView>
  );
}

export default OcrResultScreen;
