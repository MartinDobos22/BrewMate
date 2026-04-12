import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { apiFetch, DEFAULT_API_HOST } from '../utils/api';
import { saveQuestionnaireResult } from '../utils/localSave';
import BottomNavBar from '../components/BottomNavBar';
import { useTheme } from '../theme/useTheme';
import { SparklesIcon, CoffeeCupIcon } from '../components/icons';
import { MD3Button } from '../components/md3';

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
          gap: spacing.md,
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
        card: {
          backgroundColor: colors.surfaceContainerLow,
          borderRadius: shape.extraLarge,
          padding: spacing.lg,
          ...elev.level1.shadow,
        },
        cardHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          marginBottom: spacing.md,
        },
        cardTitle: {
          ...typescale.titleSmall,
          color: colors.onSurface,
        },
        profileBlock: {
          backgroundColor: colors.surfaceContainerLowest,
          borderRadius: shape.large,
          padding: spacing.lg,
          marginBottom: spacing.md,
        },
        profileLabel: {
          ...typescale.labelLarge,
          color: colors.primary,
          marginBottom: spacing.xs + 2,
        },
        profileText: {
          ...typescale.bodyMedium,
          color: colors.onSurface,
        },
        answerRow: {
          backgroundColor: colors.surfaceContainerLowest,
          borderRadius: shape.medium,
          padding: spacing.md,
          marginBottom: spacing.sm,
        },
        answerQuestion: {
          ...typescale.labelMedium,
          color: colors.onSurface,
          marginBottom: spacing.xs,
        },
        answerValue: {
          ...typescale.bodyMedium,
          color: colors.onSurfaceVariant,
        },
        saveHint: {
          ...typescale.bodySmall,
          color: colors.tertiary,
          fontWeight: '600',
          marginTop: spacing.sm,
        },
        saveError: {
          ...typescale.bodySmall,
          color: colors.error,
          fontWeight: '600',
          marginTop: spacing.sm,
        },
      }),
    [colors, typescale, shape, elev, spacing],
  );

  return (
    <SafeAreaView style={s.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.container}>
        <View style={s.headerRow}>
          <SparklesIcon size={22} color={colors.primary} />
          <Text style={s.title}>Výsledok dotazníka</Text>
        </View>

        <View>
          <MD3Button
            label={saveState === 'saving' ? 'Ukladám...' : 'Uložiť do profilu'}
            onPress={handleSave}
            disabled={saveState === 'saving'}
            loading={saveState === 'saving'}
          />
          {saveState === 'saved' ? (
            <Text style={s.saveHint}>Uložené lokálne aj do profilu.</Text>
          ) : null}
          {saveState === 'error' ? (
            <Text style={s.saveError}>Uloženie zlyhalo.</Text>
          ) : null}
        </View>

        <View style={s.card}>
          <View style={s.cardHeader}>
            <SparklesIcon size={20} color={colors.primary} />
            <Text style={s.cardTitle}>AI odporúčanie</Text>
          </View>
          {(Object.keys(SECTION_LABELS) as Array<keyof typeof SECTION_LABELS>).map(
            (key) => (
              <View key={key} style={s.profileBlock}>
                <Text style={s.profileLabel}>{SECTION_LABELS[key]}</Text>
                <Text style={s.profileText}>{profile[key]}</Text>
              </View>
            ),
          )}
        </View>

        <View style={s.card}>
          <View style={s.cardHeader}>
            <CoffeeCupIcon size={20} color={colors.primary} />
            <Text style={s.cardTitle}>Vaše odpovede</Text>
          </View>
          {answers.map((item) => (
            <View key={item.question} style={s.answerRow}>
              <Text style={s.answerQuestion}>{item.question}</Text>
              <Text style={s.answerValue}>{item.answer}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
      <BottomNavBar />
    </SafeAreaView>
  );
}

export default CoffeeQuestionnaireResultScreen;
