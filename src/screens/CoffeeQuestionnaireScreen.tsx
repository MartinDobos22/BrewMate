import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Button,
  Card,
  Chip,
  ProgressBar,
  Text,
  useTheme,
} from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ProfileStackParamList } from '../navigation/types';
import { ensureQuestionnaireProfile } from '../utils/tasteVector';
import { apiFetch, DEFAULT_API_HOST } from '../utils/api';
import spacing from '../styles/spacing';

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
    title: 'Preferujete skôr „čistú" chuť alebo „divokejšiu" (výrazné arómy)?',
    options: [
      'Čistú a jednoduchú',
      'Niečo zaujímavejšie',
      'Kľudne veľmi výraznú a netradičnú',
    ],
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

type Props = NativeStackScreenProps<ProfileStackParamList, 'CoffeeQuestionnaire'>;

type AnswerMap = Record<string, string>;

function CoffeeQuestionnaireScreen({ navigation }: Props) {
  const theme = useTheme<MD3Theme>();
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
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      edges={['bottom']}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text variant="headlineMedium" style={{ color: theme.colors.onSurface }}>
            Chuťový dotazník
          </Text>
          <Text
            variant="bodyMedium"
            style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
          >
            {answeredCount} / {QUESTIONNAIRE.length} otázok zodpovedaných
          </Text>
          <ProgressBar
            progress={answeredCount / QUESTIONNAIRE.length}
            color={theme.colors.primary}
            style={[
              styles.progressBar,
              { backgroundColor: theme.colors.surfaceVariant },
            ]}
          />
        </View>

        {/* Question cards */}
        {QUESTIONNAIRE.map((question, index) => (
          <Card
            key={question.id}
            mode="elevated"
            elevation={1}
            style={[styles.card, { backgroundColor: theme.colors.surface }]}
          >
            <Card.Content style={styles.cardContent}>
              <Text
                variant="labelMedium"
                style={[styles.questionNumber, { color: theme.colors.primary }]}
              >
                Otázka {index + 1}
              </Text>
              <Text
                variant="titleMedium"
                style={[styles.questionTitle, { color: theme.colors.onSurface }]}
              >
                {question.title}
              </Text>
              <View style={styles.chipsContainer}>
                {question.options.map((option) => {
                  const isSelected = answers[question.id] === option;
                  return (
                    <Chip
                      key={option}
                      selected={isSelected}
                      onPress={() => handleSelect(question.id, option)}
                      style={[
                        styles.chip,
                        isSelected
                          ? { backgroundColor: theme.colors.primaryContainer }
                          : { backgroundColor: theme.colors.surfaceVariant },
                      ]}
                      textStyle={[
                        isSelected
                          ? { color: theme.colors.onPrimaryContainer }
                          : { color: theme.colors.onSurfaceVariant },
                      ]}
                      showSelectedCheck={false}
                    >
                      {option}
                    </Chip>
                  );
                })}
              </View>
            </Card.Content>
          </Card>
        ))}

        {/* Error message */}
        {errorMessage ? (
          <Card
            mode="contained"
            style={[
              styles.errorCard,
              { backgroundColor: theme.colors.errorContainer },
            ]}
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

        {/* Submit button */}
        <Button
          mode="contained"
          onPress={handleSubmit}
          disabled={isSubmitting}
          loading={isSubmitting}
          style={styles.submitButton}
          contentStyle={styles.submitButtonContent}
          labelStyle={styles.submitButtonLabel}
        >
          {isSubmitting ? 'Vyhodnocujem...' : 'Vyhodnotiť dotazník'}
        </Button>
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

  // Header
  header: {
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  subtitle: {
    marginTop: spacing.xs,
  },
  progressBar: {
    height: 6,
    borderRadius: 999,
    marginTop: spacing.xs,
  },

  // Question card
  card: {
    borderRadius: spacing.lg,
  },
  cardContent: {
    paddingVertical: spacing.lg,
    gap: spacing.xs,
  },
  questionNumber: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  questionTitle: {
    marginBottom: spacing.md,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    borderRadius: spacing.sm,
  },

  // Error card
  errorCard: {
    borderRadius: spacing.md,
  },

  // Submit button
  submitButton: {
    borderRadius: spacing.md,
    marginTop: spacing.xs,
  },
  submitButtonContent: {
    paddingVertical: spacing.sm,
  },
  submitButtonLabel: {
    fontSize: 15,
    letterSpacing: 0.1,
  },
});

export default CoffeeQuestionnaireScreen;
