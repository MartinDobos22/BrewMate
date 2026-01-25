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
  const { rawText, correctedText, coffeeProfile } = route.params;
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [matchState, setMatchState] = useState<
    'idle' | 'loading' | 'ready' | 'missing' | 'error'
  >('idle');
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [matchError, setMatchError] = useState('');
  const [questionnaireSnapshot, setQuestionnaireSnapshot] = useState<
    SaveEntry<QuestionnaireResultPayload> | null
  >(null);

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
          throw new Error(payload?.error || 'Nepodarilo sa porovnať kávu s dotazníkom.');
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
    backgroundColor: '#ffffff',
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
    backgroundColor: '#1f6f5b',
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
    color: '#ffffff',
    fontWeight: '700',
  },
  saveHint: {
    marginTop: 8,
    color: '#14532d',
    fontWeight: '600',
  },
  saveError: {
    marginTop: 8,
    color: '#b91c1c',
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
    color: '#1f6f5b',
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
    color: '#2b2b2b',
  },
  errorText: {
    fontSize: 14,
    color: '#b91c1c',
    fontWeight: '600',
  },
  verdictBadge: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  verdictPositive: {
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#16a34a',
  },
  verdictNegative: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  verdictText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  verdictSubText: {
    marginTop: 4,
    fontSize: 12,
    color: '#374151',
  },
  helperNote: {
    marginTop: 12,
    fontSize: 12,
    color: '#6b7280',
  },
});

export default OcrResultScreen;
