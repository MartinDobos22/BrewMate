import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { apiFetch, DEFAULT_API_HOST } from '../utils/api';
import { saveQuestionnaireResult } from '../utils/localSave';

const SECTION_LABELS = {
  profileSummary: 'Profil chutí',
  recommendedStyle: 'Odporúčaný štýl kávy',
  recommendedOrigins: 'Odporúčaný pôvod',
  brewingTips: 'Tipy na prípravu',
};

type Props = NativeStackScreenProps<RootStackParamList, 'CoffeeQuestionnaireResult'>;

function CoffeeQuestionnaireResultScreen({ route }: Props) {
  const { answers, profile } = route.params;
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const handleSave = useCallback(async () => {
    try {
      setSaveState('saving');
      await saveQuestionnaireResult({ answers, profile });
      const response = await apiFetch(
        `${DEFAULT_API_HOST}/api/user-questionnaire`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            answers,
            profile,
            tasteProfile: profile.tasteVector,
          }),
        },
        {
          feature: 'Questionnaire',
          action: 'save-user-profile',
        },
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Nepodarilo sa uložiť výsledok dotazníka.');
      }
      setSaveState('saved');
    } catch (error) {
      console.error('[QuestionnaireResult] Failed to save questionnaire', error);
      setSaveState('error');
    }
  }, [answers, profile]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Výsledok dotazníka</Text>

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
              {saveState === 'saving' ? 'Ukladám...' : 'Uložiť do profilu'}
            </Text>
          </Pressable>
          {saveState === 'saved' ? (
            <Text style={styles.saveHint}>Uložené lokálne aj do profilu.</Text>
          ) : null}
          {saveState === 'error' ? (
            <Text style={styles.saveError}>Uloženie zlyhalo.</Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AI odporúčanie</Text>
          {(Object.keys(SECTION_LABELS) as Array<keyof typeof SECTION_LABELS>).map(
            (key) => (
              <View key={key} style={styles.profileBlock}>
                <Text style={styles.profileLabel}>{SECTION_LABELS[key]}</Text>
                <Text style={styles.profileText}>{profile[key]}</Text>
              </View>
            ),
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vaše odpovede</Text>
          {answers.map((item) => (
            <View key={item.question} style={styles.answerRow}>
              <Text style={styles.answerQuestion}>{item.question}</Text>
              <Text style={styles.answerValue}>{item.answer}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    padding: 20,
    paddingBottom: 40,
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  profileBlock: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  profileLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f6f5b',
    marginBottom: 6,
  },
  profileText: {
    fontSize: 14,
    color: '#111827',
    lineHeight: 20,
  },
  answerRow: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  answerQuestion: {
    fontWeight: '600',
    marginBottom: 4,
  },
  answerValue: {
    color: '#374151',
  },
});

export default CoffeeQuestionnaireResultScreen;
