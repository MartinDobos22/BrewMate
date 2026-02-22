import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { ensureQuestionnaireProfile } from '../utils/tasteVector';
import { apiFetch, DEFAULT_API_HOST } from '../utils/api';

const QUESTIONNAIRE = [
  {
    id: 'flavor-focus',
    title: 'Čo chcete v káve cítiť viac?',
    options: [
      'Čokoláda / orechy / karamel',
      'Ovocie (citrus, bobuľové, tropické)',
      'Klasickú kávovú chuť bez ovocia',
    ],
  },
  {
    id: 'acidity',
    title: 'Kyslosť (šťavnatosť)',
    options: ['Nechcem', 'Trochu', 'Výraznú'],
  },
  {
    id: 'bitterness',
    title: 'Horkosť',
    options: ['Nechcem', 'Trochu', 'Výraznú'],
  },
  {
    id: 'sweetness',
    title: 'Sladkosť v chuti (bez cukru)',
    options: ['Nízka', 'Stredná', 'Vysoká'],
  },
  {
    id: 'body',
    title: 'Telo (pocit v ústach)',
    options: ['Ľahké a čisté', 'Stredné', 'Hutné a krémové'],
  },
  {
    id: 'intensity',
    title: 'Intenzita chuti',
    options: ['Jemná', 'Stredná', 'Výrazná'],
  },
  {
    id: 'aftertaste',
    title: 'Ktorá dochuť je vám príjemnejšia?',
    options: ['Kakaová/horká', 'Ovocná/šťavnatá', 'Sladká/karamelová'],
  },
  {
    id: 'clarity',
    title: 'Preferujete skôr “čistú” chuť alebo “divokejšiu” (výrazné arómy)?',
    options: ['Čistú a jednoduchú', 'Niečo zaujímavejšie', 'Kľudne veľmi výraznú a netradičnú'],
  },
  {
    id: 'dislike',
    title: 'Čo vám vadí viac?',
    options: ['Kyslosť', 'Horkosť', 'Nič, nech je výrazná'],
  },
  {
    id: 'milk',
    title: 'Na záver: chcete to skôr čierne alebo s mliekom?',
    options: ['Čierne', 'S mliekom', 'Je mi to jedno'],
  },
];

type Props = NativeStackScreenProps<RootStackParamList, 'CoffeeQuestionnaire'>;

type AnswerMap = Record<string, string>;

function CoffeeQuestionnaireScreen({ navigation }: Props) {
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const answeredCount = useMemo(
    () => QUESTIONNAIRE.filter((question) => answers[question.id]).length,
    [answers],
  );

  const handleSelect = (questionId: string, option: string) => {
    setAnswers((current) => ({ ...current, [questionId]: option }));
    setErrorMessage('');
  };

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    const missing = QUESTIONNAIRE.filter((question) => !answers[question.id]);
    if (missing.length > 0) {
      setErrorMessage('Prosím vyplňte všetky otázky.');
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);

    try {
      console.log('[CoffeeQuestionnaire] OpenAI questionnaire request via backend', {
        endpoint: '/api/coffee-questionnaire',
      });
      const response = await apiFetch(
        `${DEFAULT_API_HOST}/api/coffee-questionnaire`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            answers: QUESTIONNAIRE.map((question) => ({
              id: question.id,
              question: question.title,
              answer: answers[question.id],
            })),
          }),
        },
        {
          feature: 'CoffeeQuestionnaire',
          action: 'submit',
        },
      );

      const payload = await response.json();
      console.log('[CoffeeQuestionnaire] OpenAI questionnaire response content', {
        payload,
      });

      if (!response.ok) {
        const message =
          payload?.error || 'Nepodarilo sa vyhodnotiť dotazník.';
        console.error('[CoffeeQuestionnaire] Questionnaire request failed', {
          message,
          payload,
        });
        setErrorMessage(message);
        return;
      }

      const profile = ensureQuestionnaireProfile(payload?.profile);

      navigation.navigate('CoffeeQuestionnaireResult', {
        answers: QUESTIONNAIRE.map((question) => ({
          question: question.title,
          answer: answers[question.id],
        })),
        profile,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Nepodarilo sa vyhodnotiť dotazník.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Chuťový dotazník</Text>
        <Text style={styles.subtitle}>
          Vyplňte všetkých 10 otázok. Stav: {answeredCount} / {QUESTIONNAIRE.length}
        </Text>

        {QUESTIONNAIRE.map((question) => (
          <View key={question.id} style={styles.card}>
            <Text style={styles.question}>{question.title}</Text>
            {question.options.map((option) => {
              const isSelected = answers[question.id] === option;
              return (
                <Pressable
                  key={option}
                  style={[styles.option, isSelected && styles.optionSelected]}
                  onPress={() => handleSelect(question.id, option)}
                >
                  <View style={[styles.radio, isSelected && styles.radioSelected]} />
                  <Text style={styles.optionLabel}>{option}</Text>
                </Pressable>
              );
            })}
          </View>
        ))}

        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

        <Pressable
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <View style={styles.submitRow}>
              <ActivityIndicator color="#FFFFFF" />
              <Text style={styles.submitText}>Vyhodnocujem...</Text>
            </View>
          ) : (
            <Text style={styles.submitText}>Vyhodnotiť dotazník</Text>
          )}
        </Pressable>
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
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#F6F3EE',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E3DED6',
  },
  question: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  optionSelected: {
    backgroundColor: '#e0f2f1',
    borderRadius: 16,
    paddingHorizontal: 8,
  },
  radio: {
    width: 16,
    height: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#6F6A64',
    marginRight: 10,
  },
  radioSelected: {
    borderColor: '#6B4F3A',
    backgroundColor: '#6B4F3A',
  },
  optionLabel: {
    flex: 1,
    fontSize: 14,
    color: '#3E2F25',
  },
  error: {
    color: '#B3261E',
    marginBottom: 16,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#6B4F3A',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
});

export default CoffeeQuestionnaireScreen;
