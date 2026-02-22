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
        <Text style={styles.title}>Výsledok OCR</Text>

        <View style={styles.saveRow}>
          <Pressable
            style={({ pressed }) => [
              styles.saveButton,
              pressed && styles.saveButtonPressed,
              saveState === 'saving' && styles.saveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={saveState === 'saving'}
          >
            <Text style={styles.saveButtonText}>
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

        <View style={styles.inventoryBlock}>
          <Text style={styles.label}>Inventár</Text>
          <Text style={styles.text}>
            Ak si túto kávu nekúpil, nič nemusíš vypĺňať. Inventár je len voliteľný.
          </Text>
          {!showInventoryDetails ? (
            <Pressable
              style={({ pressed }) => [styles.inventoryButton, pressed && styles.saveButtonPressed]}
              onPress={() => {
                setInventoryState('idle');
                setInventoryError('');
                setShowInventoryDetails(true);
              }}
            >
              <Text style={styles.saveButtonText}>Kúpil som ju, pridať do inventára</Text>
            </Pressable>
          ) : null}
          {showInventoryDetails ? (
            <>
              <Text style={styles.profileTitle}>Veľkosť balíka (voliteľné)</Text>
              <View style={styles.packageOptionsRow}>
                {['', '250', '500', '1000'].map((value) => {
                  const isActive = packageSizeG === value;
                  return (
                    <Pressable
                      key={value || 'empty'}
                      style={[styles.packageOption, isActive && styles.packageOptionActive]}
                      onPress={() => setPackageSizeG(value)}
                    >
                      <Text
                        style={[
                          styles.packageOptionText,
                          isActive && styles.packageOptionTextActive,
                        ]}
                      >
                        {value ? `${value} g` : 'nechať prázdne'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.profileTitle}>Zostáva teraz (voliteľné)</Text>
              <View style={styles.remainingInputWrap}>
                <Text style={styles.remainingPrefix}>g</Text>
                <Text style={styles.remainingValue}>
                  {remainingG.trim().length > 0 ? remainingG : 'nevyplnené'}
                </Text>
              </View>
              <View style={styles.packageOptionsRow}>
                {['', '50', '100', '150', '200'].map((value) => {
                  const isActive = remainingG === value;
                  return (
                    <Pressable
                      key={value || 'none'}
                      style={[styles.packageOption, isActive && styles.packageOptionActive]}
                      onPress={() => setRemainingG(value)}
                    >
                      <Text
                        style={[
                          styles.packageOptionText,
                          isActive && styles.packageOptionTextActive,
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
                pressed && styles.saveButtonPressed,
                (inventoryState === 'saving' || !user) && styles.saveButtonDisabled,
              ]}
              onPress={handleInventorySave}
              disabled={inventoryState === 'saving' || !user}
            >
              <Text style={styles.saveButtonText}>
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

        <View style={styles.block}>
          <Text style={styles.label}>Oskenovaný text</Text>
          <Text style={styles.text}>{rawText}</Text>
        </View>

        <View style={styles.block}>
          <Text style={styles.label}>Opravený text</Text>
          <Text style={styles.text}>{correctedText}</Text>
        </View>

        <View style={styles.block}>
          <Text style={styles.label}>Chuťový profil</Text>
          <Text style={styles.profileTitle}>Chuťové tóny</Text>
          <Text style={styles.text}>
            {coffeeProfile.flavorNotes.length > 0
              ? coffeeProfile.flavorNotes.join(', ')
              : 'Neurčené'}
          </Text>
          <Text style={styles.profileTitle}>Profil chuti</Text>
          <Text style={styles.text}>{coffeeProfile.tasteProfile}</Text>
          <Text style={styles.profileTitle}>Odborný popis</Text>
          <Text style={styles.text}>{coffeeProfile.expertSummary}</Text>
          <Text style={styles.profileTitle}>Popis pre laika</Text>
          <Text style={styles.text}>{coffeeProfile.laymanSummary}</Text>
          <Text style={styles.profileTitle}>Komu bude chutiť</Text>
          <Text style={styles.text}>{coffeeProfile.preferenceHint}</Text>
          <Text style={styles.profileTitle}>Prečo tieto tóny</Text>
          <Text style={styles.text}>{coffeeProfile.reasoning}</Text>
          <Text style={styles.profileTitle}>Istota</Text>
          <Text style={styles.text}>
            {Math.round(coffeeProfile.confidence * 100)}%
          </Text>
          {coffeeProfile.missingInfo?.length ? (
            <>
              <Text style={styles.profileTitle}>Chýbajúce informácie</Text>
              <Text style={styles.text}>
                {coffeeProfile.missingInfo.join(', ')}
              </Text>
            </>
          ) : null}
        </View>

        <View style={styles.block}>
          <Text style={styles.label}>Zhoda s dotazníkom</Text>
          {matchState === 'loading' ? (
            <Text style={styles.text}>Porovnávam s dotazníkom…</Text>
          ) : null}
          {matchState === 'missing' ? (
            <Text style={styles.text}>
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
                <Text style={styles.verdictText}>{verdictLabel}</Text>
                <Text style={styles.verdictSubText}>
                  Istota: {Math.round(matchResult.confidence * 100)}%
                </Text>
              </View>
              <Text style={styles.profileTitle}>Pre baristu</Text>
              <Text style={styles.text}>{matchResult.baristaSummary}</Text>
              <Text style={styles.profileTitle}>Pre laika</Text>
              <Text style={styles.text}>{matchResult.laymanSummary}</Text>
              <Text style={styles.profileTitle}>Kľúčové zhody</Text>
              <Text style={styles.text}>
                {matchResult.keyMatches.length
                  ? matchResult.keyMatches.join(', ')
                  : 'Žiadne výrazné zhody.'}
              </Text>
              <Text style={styles.profileTitle}>Potenciálne konflikty</Text>
              <Text style={styles.text}>
                {matchResult.keyConflicts.length
                  ? matchResult.keyConflicts.join(', ')
                  : 'Žiadne výrazné konflikty.'}
              </Text>
              <Text style={styles.profileTitle}>Ako si ju upraviť</Text>
              <Text style={styles.text}>{matchResult.suggestedAdjustments}</Text>
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
    backgroundColor: '#FFFFFF',
  },
  container: {
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
  },
  saveRow: {
    marginBottom: 16,
  },
  saveButton: {
    backgroundColor: '#6B4F3A',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveButtonPressed: {
    opacity: 0.8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  saveHint: {
    marginTop: 8,
    color: '#6B4F3A',
    fontWeight: '600',
  },
  saveError: {
    marginTop: 8,
    color: '#B3261E',
    fontWeight: '600',
  },
  inventoryBlock: {
    marginBottom: 20,
  },
  inventoryButton: {
    marginTop: 12,
    backgroundColor: '#8A9A5B',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  packageOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  packageOption: {
    borderWidth: 1,
    borderColor: '#D1CBC2',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  packageOptionActive: {
    borderColor: '#8A9A5B',
    backgroundColor: '#EEF1E5',
  },
  packageOptionText: {
    fontSize: 12,
    color: '#6F6A64',
    fontWeight: '600',
  },
  packageOptionTextActive: {
    color: '#6B4F3A',
  },
  remainingInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  remainingPrefix: {
    color: '#6F6A64',
    fontSize: 12,
  },
  remainingValue: {
    color: '#3E2F25',
    fontSize: 13,
    fontWeight: '600',
  },
  block: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  profileTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 4,
    color: '#6B4F3A',
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
    color: '#2b2b2b',
  },
  errorText: {
    fontSize: 14,
    color: '#B3261E',
    fontWeight: '600',
  },
  verdictBadge: {
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  verdictPositive: {
    backgroundColor: '#EEF1E5',
    borderWidth: 1,
    borderColor: '#8A9A5B',
  },
  verdictNegative: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#B3261E',
  },
  verdictText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#3E2F25',
  },
  verdictSubText: {
    marginTop: 4,
    fontSize: 12,
    color: '#6F6A64',
  },
  helperNote: {
    marginTop: 12,
    fontSize: 12,
    color: '#6F6A64',
  },
});

export default OcrResultScreen;
