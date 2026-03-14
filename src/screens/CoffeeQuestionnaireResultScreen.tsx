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
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Page title */}
        <View style={styles.header}>
          <Text style={styles.title}>Výsledok dotazníka</Text>
          <Text style={styles.subtitle}>Váš chuťový profil a odporúčania</Text>
        </View>

        {/* Save action row */}
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

        {/* AI recommendation section */}
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

        {/* Answers section */}
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
    backgroundColor: '#FAFAFA',
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 48,
  },

  // Header
  header: {
    marginBottom: 20,
    paddingTop: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B6B6B',
    fontWeight: '400',
  },

  // Save row
  saveRow: {
    marginBottom: 24,
  },
  saveButton: {
    backgroundColor: '#2C2C2C',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  saveButtonPressed: {
    opacity: 0.85,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
    letterSpacing: 0.1,
  },
  saveHint: {
    marginTop: 10,
    color: '#4A9B6E',
    fontWeight: '600',
    fontSize: 14,
  },
  saveError: {
    marginTop: 10,
    color: '#D64545',
    fontWeight: '600',
    fontSize: 14,
  },

  // Sections
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },

  // Profile blocks (AI recommendation)
  profileBlock: {
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
  profileLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8B7355',
    letterSpacing: 0.2,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  profileText: {
    fontSize: 15,
    color: '#1A1A1A',
    lineHeight: 22,
    fontWeight: '400',
  },

  // Answer rows
  answerRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  answerQuestion: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B6B6B',
    marginBottom: 4,
    lineHeight: 18,
  },
  answerValue: {
    fontSize: 15,
    color: '#1A1A1A',
    fontWeight: '400',
    lineHeight: 22,
  },
});

export default CoffeeQuestionnaireResultScreen;
