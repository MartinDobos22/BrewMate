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
import BottomNavBar from '../components/BottomNavBar';

const QUESTIONNAIRE = [
  {
    id: 'flavor-focus',
    title: 'Čo chcete v káve cítiť viac?',
    options: [
      'Čokoláda / orechy / karamel',
      'Ovocie (citrus, bobuľové, tropické)',
      'Klasickú kávovú chuť bez ovocia',
      'Kombináciu všetkého, záleží na nálade',
    ],
  },
  {
    id: 'acidity',
    title: 'Kyslosť (šťavnatosť)',
    options: [
      'Aktívne sa jej vyhýbam',
      'Radšej nie, ale nevadí mi',
      'Trochu',
      'Mám ju rád/a',
      'Výraznú',
    ],
  },
  {
    id: 'bitterness',
    title: 'Horkosť',
    options: [
      'Aktívne sa jej vyhýbam',
      'Radšej nie, ale nevadí mi',
      'Trochu',
      'Mám ju rád/a',
      'Výraznú',
    ],
  },
  {
    id: 'sweetness',
    title: 'Sladkosť v chuti (bez cukru)',
    options: ['Nízka', 'Skôr nižšia', 'Stredná', 'Vyššia', 'Vysoká'],
  },
  {
    id: 'body',
    title: 'Telo (pocit v ústach)',
    options: ['Ľahké a čisté', 'Skôr ľahšie', 'Stredné', 'Skôr hutnejšie', 'Hutné a krémové'],
  },
  {
    id: 'intensity',
    title: 'Intenzita chuti',
    options: ['Jemná', 'Skôr jemnejšia', 'Stredná', 'Skôr výraznejšia', 'Výrazná'],
  },
  {
    id: 'aftertaste',
    title: 'Ktorá dochuť je vám príjemnejšia?',
    options: [
      'Kakaová/horká',
      'Ovocná/šťavnatá',
      'Sladká/karamelová',
      'Nemám preferenciu',
    ],
  },
  {
    id: 'clarity',
    title: 'Preferujete skôr “čistú” chuť alebo “divokejšiu” (výrazné arómy)?',
    options: ['Čistú a jednoduchú', 'Niečo zaujímavejšie', 'Kľudne veľmi výraznú a netradičnú'],
  },
  {
    id: 'dislike',
    title: 'Čo vám v káve skutočne vadí? (dealbreaker)',
    options: [
      'Výrazná kyslosť',
      'Výrazná horkosť',
      'Slabá/vodová chuť',
      'Nič mi extra nevadí',
    ],
  },
  {
    id: 'openness',
    title: 'Aký ste typ kávičkára?',
    options: [
      'Konzervatívny — chcem presne to čo poznám a viem že mi chutí',
      'Otvorený — rád/a skúšam nové veci ale opatrne',
      'Dobrodruh — baví ma objavovať nové chute aj mimo komfortnú zónu',
    ],
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
          Vyplňte všetky otázky. Stav: {answeredCount} / {QUESTIONNAIRE.length}
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
      <BottomNavBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    padding: 20,
    paddingBottom: 90,
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
  card: {
    backgroundColor: '#F5F1EC',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#DDD3C9',
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
  radioSelected: {
    borderColor: '#6B4F3A',
    backgroundColor: '#6B4F3A',
  },
  optionLabel: {
    flex: 1,
    fontSize: 14,
    color: '#271508',
  },
  error: {
    color: '#BA1A1A',
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
