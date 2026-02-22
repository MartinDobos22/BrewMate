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
  const [currentIndex, setCurrentIndex] = useState(0);
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

  const currentQuestion = QUESTIONNAIRE[currentIndex];

  const handleNext = async () => {
    if (!answers[currentQuestion.id]) {
      setErrorMessage('Najprv vyber odpoveď.');
      return;
    }
    setErrorMessage('');
    if (currentIndex < QUESTIONNAIRE.length - 1) {
      setCurrentIndex((idx) => idx + 1);
      return;
    }
    await handleSubmit();
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex((idx) => idx - 1);
    }
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
        <Text style={styles.title}>Chuťový test</Text>
        <Text style={styles.subtitle}>Stav: {answeredCount} / {QUESTIONNAIRE.length}</Text>

        <View style={styles.stepDots}>
          {QUESTIONNAIRE.map((question, idx) => (
            <View
              key={question.id}
              style={[
                styles.dot,
                idx < currentIndex ? styles.dotDone : null,
                idx === currentIndex ? styles.dotCurrent : null,
              ]}
            />
          ))}
        </View>

        <View style={styles.progressHeader}>
          <Text style={styles.progressMeta}>
            Otázka {currentIndex + 1} z {QUESTIONNAIRE.length}
          </Text>
          <Text style={styles.progressPercent}>{Math.round(((currentIndex + 1) / QUESTIONNAIRE.length) * 100)} %</Text>
        </View>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${((currentIndex + 1) / QUESTIONNAIRE.length) * 100}%` },
            ]}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.question}>{currentQuestion.title}</Text>
          <View style={styles.optionsGrid}>
            {currentQuestion.options.map((option) => {
              const isSelected = answers[currentQuestion.id] === option;
              return (
                <Pressable
                  key={option}
                  style={[styles.optionCard, isSelected && styles.optionSelected]}
                  onPress={() => handleSelect(currentQuestion.id, option)}
                >
                  <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>{option}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

        <View style={styles.actionsRow}>
          <Pressable style={styles.backButton} onPress={handleBack}>
            <Text style={styles.backButtonText}>Späť</Text>
          </Pressable>
          <Pressable
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleNext}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <View style={styles.submitRow}>
                <ActivityIndicator color="#FFFFFF" />
                <Text style={styles.submitText}>Vyhodnocujem...</Text>
              </View>
            ) : (
              <Text style={styles.submitText}>
                {currentIndex === QUESTIONNAIRE.length - 1 ? 'Vyhodnotiť' : 'Ďalšia otázka'}
              </Text>
            )}
          </Pressable>
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
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B5C52',
    marginBottom: 16,
  },
  stepDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 12,
  },
  dot: {
    width: 8,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#DDD3C9',
  },
  dotDone: {
    width: 18,
    backgroundColor: '#7A9255',
  },
  dotCurrent: {
    width: 24,
    backgroundColor: '#6B4F3A',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressMeta: { color: '#6B5C52' },
  progressPercent: { color: '#6B4F3A', fontWeight: '700' },
  progressTrack: {
    height: 5,
    backgroundColor: '#EDE7DF',
    borderRadius: 4,
    marginBottom: 14,
  },
  progressFill: { height: '100%', backgroundColor: '#6B4F3A', borderRadius: 4 },
  card: {
    backgroundColor: '#F5F1EC',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#DDD3C9',
  },
  question: {
    fontSize: 22,
    fontWeight: '500',
    marginBottom: 12,
    color: '#271508',
  },
  optionsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  optionSelected: {
    backgroundColor: '#D8ECBA',
    borderRadius: 16,
    paddingHorizontal: 8,
  },
  radio: {
    width: 16,
    height: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#6B5C52',
    marginRight: 10,
  },
  optionSelected: {
    borderColor: '#6B4F3A',
    backgroundColor: '#EDE0D4',
  },
  optionLabel: {
    fontSize: 14,
    color: '#271508',
  },
  error: {
    color: '#BA1A1A',
    marginBottom: 16,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  backButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#C8BAB0',
    borderRadius: 99,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: { color: '#6B4F3A', fontWeight: '600' },
  submitButton: {
    flex: 2,
    backgroundColor: '#6B4F3A',
    paddingVertical: 14,
    borderRadius: 99,
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
