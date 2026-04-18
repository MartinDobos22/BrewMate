import React, { useMemo, useState } from 'react';
import {
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
import { useTheme } from '../theme/useTheme';
import { SparklesIcon } from '../components/icons';
import { MD3Button } from '../components/md3';

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
    title: 'Preferujete skôr "čistú" chuť alebo "divokejšiu" (výrazné arómy)?',
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
          credentials: 'include',
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

  const { colors, typescale, shape, elevation: elev, spacing } = useTheme();

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
          gap: spacing.lg,
        },
        headerRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
        },
        title: {
          ...typescale.headlineSmall,
          color: colors.onSurface,
        },
        subtitle: {
          ...typescale.bodyMedium,
          color: colors.onSurfaceVariant,
        },
        progressBar: {
          height: 6,
          borderRadius: 3,
          backgroundColor: colors.outlineVariant,
          overflow: 'hidden' as const,
        },
        progressFill: {
          height: 6,
          borderRadius: 3,
          backgroundColor: colors.primary,
        },
        card: {
          backgroundColor: colors.surfaceContainerLow,
          borderRadius: shape.extraLarge,
          padding: spacing.lg,
          ...elev.level1.shadow,
        },
        question: {
          ...typescale.titleSmall,
          color: colors.onSurface,
          marginBottom: spacing.md,
        },
        option: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.sm,
          borderRadius: shape.medium,
        },
        optionSelected: {
          backgroundColor: colors.primaryContainer,
        },
        radio: {
          width: 20,
          height: 20,
          borderRadius: 10,
          borderWidth: 2,
          borderColor: colors.outline,
          marginRight: spacing.md,
          alignItems: 'center',
          justifyContent: 'center',
        },
        radioSelected: {
          borderColor: colors.primary,
        },
        radioInner: {
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: colors.primary,
        },
        optionLabel: {
          ...typescale.bodyMedium,
          color: colors.onSurface,
          flex: 1,
        },
        optionLabelSelected: {
          color: colors.onPrimaryContainer,
        },
        error: {
          ...typescale.bodySmall,
          color: colors.error,
          fontWeight: '600',
        },
      }),
    [colors, typescale, shape, elev, spacing],
  );

  const progressPercent = (answeredCount / QUESTIONNAIRE.length) * 100;

  return (
    <SafeAreaView style={s.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.container}>
        <View style={s.headerRow}>
          <SparklesIcon size={22} color={colors.primary} />
          <Text style={s.title}>Chuťový dotazník</Text>
        </View>
        <Text style={s.subtitle}>
          Vyplňte všetky otázky. Stav: {answeredCount} / {QUESTIONNAIRE.length}
        </Text>
        <View style={s.progressBar}>
          <View style={[s.progressFill, { width: `${progressPercent}%` }]} />
        </View>

        {QUESTIONNAIRE.map((question) => (
          <View key={question.id} style={s.card}>
            <Text style={s.question}>{question.title}</Text>
            {question.options.map((option) => {
              const isSelected = answers[question.id] === option;
              return (
                <Pressable
                  key={option}
                  style={[s.option, isSelected && s.optionSelected]}
                  onPress={() => handleSelect(question.id, option)}
                >
                  <View style={[s.radio, isSelected && s.radioSelected]}>
                    {isSelected ? <View style={s.radioInner} /> : null}
                  </View>
                  <Text style={[s.optionLabel, isSelected && s.optionLabelSelected]}>
                    {option}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}

        {errorMessage ? <Text style={s.error}>{errorMessage}</Text> : null}

        <MD3Button
          label={isSubmitting ? 'Vyhodnocujem...' : 'Vyhodnotiť dotazník'}
          onPress={handleSubmit}
          disabled={isSubmitting}
          loading={isSubmitting}
        />
      </ScrollView>
      <BottomNavBar />
    </SafeAreaView>
  );
}

export default CoffeeQuestionnaireScreen;
