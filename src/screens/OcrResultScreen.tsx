import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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

type Props = NativeStackScreenProps<RootStackParamList, 'OcrResult'>;

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
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Výsledok OCR</Text>
        </View>

        {/* Local save row */}
        <View style={styles.saveRow}>
          <Pressable
            style={({ pressed }) => [
              styles.outlineButton,
              pressed && styles.buttonPressed,
              saveState === 'saving' && styles.buttonDisabled,
            ]}
            onPress={handleSave}
            disabled={saveState === 'saving'}
          >
            <Text style={styles.outlineButtonText}>
              {saveState === 'saving' ? 'Ukladám...' : 'Uložiť lokálne'}
            </Text>
          </Pressable>
          {saveState === 'saved' ? (
            <Text style={styles.saveHint}>Uložené do zariadenia.</Text>
          ) : null}
          {saveState === 'error' ? (
            <Text style={styles.saveError}>Uloženie zlyhalo.</Text>
          ) : null}
        </View>

        {/* Inventory card */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Inventár</Text>
          <Text style={styles.bodyText}>
            Ak si túto kávu nekúpil, nič nemusíš vypĺňať. Inventár je len voliteľný.
          </Text>

          {!showInventoryDetails ? (
            <Pressable
              style={({ pressed }) => [
                styles.inventoryButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => {
                setInventoryState('idle');
                setInventoryError('');
                setShowInventoryDetails(true);
              }}
            >
              <Text style={styles.inventoryButtonText}>Kúpil som ju, pridať do inventára</Text>
            </Pressable>
          ) : null}

          {showInventoryDetails ? (
            <>
              <Text style={styles.fieldLabel}>Veľkosť balíka (voliteľné)</Text>
              <View style={styles.pillsRow}>
                {['', '250', '500', '1000'].map((value) => {
                  const isActive = packageSizeG === value;
                  return (
                    <Pressable
                      key={value || 'empty'}
                      style={[styles.pill, isActive && styles.pillActive]}
                      onPress={() => setPackageSizeG(value)}
                    >
                      <Text
                        style={[
                          styles.pillText,
                          isActive && styles.pillTextActive,
                        ]}
                      >
                        {value ? `${value} g` : 'nechať prázdne'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>Zostáva teraz (voliteľné)</Text>
              <View style={styles.remainingDisplayRow}>
                <Text style={styles.remainingUnit}>g</Text>
                <Text style={styles.remainingValue}>
                  {remainingG.trim().length > 0 ? remainingG : 'nevyplnené'}
                </Text>
              </View>
              <View style={styles.pillsRow}>
                {['', '50', '100', '150', '200'].map((value) => {
                  const isActive = remainingG === value;
                  return (
                    <Pressable
                      key={value || 'none'}
                      style={[styles.pill, isActive && styles.pillActive]}
                      onPress={() => setRemainingG(value)}
                    >
                      <Text
                        style={[
                          styles.pillText,
                          isActive && styles.pillTextActive,
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
            <Pressable
              style={({ pressed }) => [
                styles.inventoryButton,
                pressed && styles.buttonPressed,
                (inventoryState === 'saving' || !user) && styles.buttonDisabled,
              ]}
              onPress={handleInventorySave}
              disabled={inventoryState === 'saving' || !user}
            >
              <Text style={styles.inventoryButtonText}>
                {inventoryState === 'saving' ? 'Ukladám...' : 'Uložiť do inventára'}
              </Text>
            </Pressable>
          ) : null}

          {!user ? (
            <Text style={styles.helperNote}>
              Pre uloženie do inventára sa musíš prihlásiť.
            </Text>
          ) : null}
          {inventoryState === 'saved' ? (
            <Text style={styles.saveHint}>Káva uložená v inventári.</Text>
          ) : null}
          {inventoryState === 'error' ? (
            <Text style={styles.saveError}>{inventoryError}</Text>
          ) : null}
        </View>

        {/* OCR text blocks */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Oskenovaný text</Text>
          <Text style={styles.bodyText}>{rawText}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Opravený text</Text>
          <Text style={styles.bodyText}>{correctedText}</Text>
        </View>

        {/* Taste profile card */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Chuťový profil</Text>

          <Text style={styles.fieldLabel}>Chuťové tóny</Text>
          <Text style={styles.bodyText}>
            {coffeeProfile.flavorNotes.length > 0
              ? coffeeProfile.flavorNotes.join(', ')
              : 'Neurčené'}
          </Text>

          <Text style={styles.fieldLabel}>Profil chuti</Text>
          <Text style={styles.bodyText}>{coffeeProfile.tasteProfile}</Text>

          <Text style={styles.fieldLabel}>Odborný popis</Text>
          <Text style={styles.bodyText}>{coffeeProfile.expertSummary}</Text>

          <Text style={styles.fieldLabel}>Popis pre laika</Text>
          <Text style={styles.bodyText}>{coffeeProfile.laymanSummary}</Text>

          <Text style={styles.fieldLabel}>Komu bude chutiť</Text>
          <Text style={styles.bodyText}>{coffeeProfile.preferenceHint}</Text>

          <Text style={styles.fieldLabel}>Prečo tieto tóny</Text>
          <Text style={styles.bodyText}>{coffeeProfile.reasoning}</Text>

          <Text style={styles.fieldLabel}>Istota</Text>
          <Text style={styles.bodyText}>
            {Math.round(coffeeProfile.confidence * 100)}%
          </Text>

          {coffeeProfile.missingInfo?.length ? (
            <>
              <Text style={styles.fieldLabel}>Chýbajúce informácie</Text>
              <Text style={styles.bodyText}>
                {coffeeProfile.missingInfo.join(', ')}
              </Text>
            </>
          ) : null}
        </View>

        {/* Match card */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Zhoda s dotazníkom</Text>

          {matchState === 'loading' ? (
            <Text style={styles.bodyText}>Porovnávam s dotazníkom…</Text>
          ) : null}
          {matchState === 'missing' ? (
            <Text style={styles.bodyText}>
              Zatiaľ nemám uložený výsledok dotazníka. Najprv ho vyplňte a uložte,
              aby som vedel porovnávať.
            </Text>
          ) : null}
          {matchState === 'error' ? (
            <Text style={styles.errorText}>{matchError}</Text>
          ) : null}

          {matchState === 'ready' && matchResult ? (
            <>
              <View
                style={[
                  styles.verdictBadge,
                  matchResult.willLike
                    ? styles.verdictPositive
                    : styles.verdictNegative,
                ]}
              >
                <Text
                  style={[
                    styles.verdictText,
                    matchResult.willLike
                      ? styles.verdictTextPositive
                      : styles.verdictTextNegative,
                  ]}
                >
                  {verdictLabel}
                </Text>
                <Text
                  style={[
                    styles.verdictSubText,
                    matchResult.willLike
                      ? styles.verdictSubTextPositive
                      : styles.verdictSubTextNegative,
                  ]}
                >
                  Istota: {Math.round(matchResult.confidence * 100)}%
                </Text>
              </View>

              <Text style={styles.fieldLabel}>Pre baristu</Text>
              <Text style={styles.bodyText}>{matchResult.baristaSummary}</Text>

              <Text style={styles.fieldLabel}>Pre laika</Text>
              <Text style={styles.bodyText}>{matchResult.laymanSummary}</Text>

              <Text style={styles.fieldLabel}>Kľúčové zhody</Text>
              <Text style={styles.bodyText}>
                {matchResult.keyMatches.length
                  ? matchResult.keyMatches.join(', ')
                  : 'Žiadne výrazné zhody.'}
              </Text>

              <Text style={styles.fieldLabel}>Potenciálne konflikty</Text>
              <Text style={styles.bodyText}>
                {matchResult.keyConflicts.length
                  ? matchResult.keyConflicts.join(', ')
                  : 'Žiadne výrazné konflikty.'}
              </Text>

              <Text style={styles.fieldLabel}>Ako si ju upraviť</Text>
              <Text style={styles.bodyText}>{matchResult.suggestedAdjustments}</Text>

              {questionnaireSnapshot ? (
                <Text style={styles.helperNote}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: -0.3,
  },
  saveRow: {
    marginBottom: 12,
  },
  outlineButton: {
    borderWidth: 1.5,
    borderColor: '#E8E8E8',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  outlineButtonText: {
    color: '#2C2C2C',
    fontSize: 15,
    fontWeight: '600',
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  saveHint: {
    marginTop: 10,
    fontSize: 13,
    color: '#4A9B6E',
    fontWeight: '600',
  },
  saveError: {
    marginTop: 10,
    fontSize: 13,
    color: '#D64545',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B6B6B',
    marginTop: 14,
    marginBottom: 4,
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#1A1A1A',
    fontWeight: '400',
  },
  errorText: {
    fontSize: 14,
    color: '#D64545',
    fontWeight: '500',
  },
  inventoryButton: {
    marginTop: 14,
    backgroundColor: '#4A9B6E',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  inventoryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  pill: {
    backgroundColor: '#F5F5F5',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  pillActive: {
    backgroundColor: '#2C2C2C',
  },
  pillText: {
    fontSize: 13,
    color: '#6B6B6B',
    fontWeight: '600',
  },
  pillTextActive: {
    color: '#FFFFFF',
  },
  remainingDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    marginBottom: 4,
  },
  remainingUnit: {
    color: '#6B6B6B',
    fontSize: 13,
    fontWeight: '600',
  },
  remainingValue: {
    color: '#1A1A1A',
    fontSize: 15,
    fontWeight: '600',
  },
  verdictBadge: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  verdictPositive: {
    backgroundColor: '#E8F5ED',
    borderColor: '#4A9B6E',
  },
  verdictNegative: {
    backgroundColor: '#FDEAEA',
    borderColor: '#D64545',
  },
  verdictText: {
    fontSize: 15,
    fontWeight: '700',
  },
  verdictTextPositive: {
    color: '#2D6A4A',
  },
  verdictTextNegative: {
    color: '#D64545',
  },
  verdictSubText: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '500',
  },
  verdictSubTextPositive: {
    color: '#4A9B6E',
  },
  verdictSubTextNegative: {
    color: '#D64545',
  },
  helperNote: {
    marginTop: 14,
    fontSize: 12,
    color: '#999999',
    lineHeight: 18,
  },
});

export default OcrResultScreen;
