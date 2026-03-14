import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Button,
  Card,
  Divider,
  Surface,
  Text,
  useTheme,
} from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ProfileStackParamList } from '../navigation/types';
import { apiFetch, DEFAULT_API_HOST } from '../utils/api';
import { saveQuestionnaireResult } from '../utils/localSave';
import TasteProfileBars from '../components/TasteProfileBars';
import spacing from '../styles/spacing';

const SECTION_LABELS = {
  profileSummary: 'Profil chutí',
  recommendedStyle: 'Odporúčaný štýl kávy',
  recommendedOrigins: 'Odporúčaný pôvod',
  brewingTips: 'Tipy na prípravu',
};

type Props = NativeStackScreenProps<ProfileStackParamList, 'CoffeeQuestionnaireResult'>;

function CoffeeQuestionnaireResultScreen({ route }: Props) {
  const theme = useTheme<MD3Theme>();
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
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      edges={['bottom']}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Page title */}
        <View style={styles.header}>
          <Text variant="headlineMedium" style={{ color: theme.colors.onSurface }}>
            Výsledok dotazníka
          </Text>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            Váš chuťový profil a odporúčania
          </Text>
        </View>

        {/* Save action */}
        <View style={styles.saveRow}>
          <Button
            mode="contained"
            onPress={handleSave}
            disabled={saveState === 'saving' || saveState === 'saved'}
            loading={saveState === 'saving'}
            style={styles.saveButton}
            contentStyle={styles.saveButtonContent}
            labelStyle={styles.saveButtonLabel}
            icon={saveState === 'saved' ? 'check' : undefined}
          >
            {saveState === 'saving'
              ? 'Ukladám...'
              : saveState === 'saved'
              ? 'Uložené'
              : 'Uložiť do profilu'}
          </Button>
          {saveState === 'saved' ? (
            <Text
              variant="bodySmall"
              style={[styles.saveHint, { color: theme.colors.secondary }]}
            >
              Uložené lokálne aj do profilu.
            </Text>
          ) : null}
          {saveState === 'error' ? (
            <Text
              variant="bodySmall"
              style={[styles.saveError, { color: theme.colors.error }]}
            >
              Uloženie zlyhalo.
            </Text>
          ) : null}
        </View>

        {/* Taste profile bars */}
        <Card
          mode="elevated"
          elevation={1}
          style={[styles.card, { backgroundColor: theme.colors.surface }]}
        >
          <Card.Content style={styles.cardContent}>
            <Text
              variant="titleMedium"
              style={[styles.sectionTitle, { color: theme.colors.onSurface }]}
            >
              Chuťový vektor
            </Text>
            <TasteProfileBars vector={profile.tasteVector} />
          </Card.Content>
        </Card>

        {/* AI recommendation section */}
        <Card
          mode="elevated"
          elevation={1}
          style={[styles.card, { backgroundColor: theme.colors.surface }]}
        >
          <Card.Content style={styles.cardContent}>
            <Text
              variant="titleMedium"
              style={[styles.sectionTitle, { color: theme.colors.onSurface }]}
            >
              AI odporúčanie
            </Text>
            {(Object.keys(SECTION_LABELS) as Array<keyof typeof SECTION_LABELS>).map(
              (key, index, arr) => (
                <View key={key}>
                  <Surface
                    style={[
                      styles.profileBlock,
                      { backgroundColor: theme.colors.surfaceVariant },
                    ]}
                    elevation={0}
                  >
                    <Text
                      variant="labelMedium"
                      style={[
                        styles.profileLabel,
                        { color: theme.colors.primary },
                      ]}
                    >
                      {SECTION_LABELS[key]}
                    </Text>
                    <Text
                      variant="bodyMedium"
                      style={{ color: theme.colors.onSurface }}
                    >
                      {profile[key]}
                    </Text>
                  </Surface>
                  {index < arr.length - 1 ? (
                    <View style={styles.dividerSpacer} />
                  ) : null}
                </View>
              ),
            )}
          </Card.Content>
        </Card>

        {/* Answers section */}
        <Card
          mode="elevated"
          elevation={1}
          style={[styles.card, { backgroundColor: theme.colors.surface }]}
        >
          <Card.Content style={styles.cardContent}>
            <Text
              variant="titleMedium"
              style={[styles.sectionTitle, { color: theme.colors.onSurface }]}
            >
              Vaše odpovede
            </Text>
            {answers.map((item, index) => (
              <View key={item.question}>
                <View style={styles.answerRow}>
                  <Text
                    variant="labelMedium"
                    style={[
                      styles.answerQuestion,
                      { color: theme.colors.onSurfaceVariant },
                    ]}
                  >
                    {item.question}
                  </Text>
                  <Text
                    variant="bodyMedium"
                    style={{ color: theme.colors.onSurface }}
                  >
                    {item.answer}
                  </Text>
                </View>
                {index < answers.length - 1 ? (
                  <Divider
                    style={[
                      styles.answerDivider,
                      { backgroundColor: theme.colors.outlineVariant },
                    ]}
                  />
                ) : null}
              </View>
            ))}
          </Card.Content>
        </Card>
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
    gap: spacing.lg,
  },

  // Header
  header: {
    gap: spacing.xs,
  },

  // Save row
  saveRow: {
    gap: spacing.sm,
  },
  saveButton: {
    borderRadius: spacing.md,
  },
  saveButtonContent: {
    paddingVertical: spacing.sm,
  },
  saveButtonLabel: {
    fontSize: 15,
    letterSpacing: 0.1,
  },
  saveHint: {
    marginTop: spacing.xs,
  },
  saveError: {
    marginTop: spacing.xs,
  },

  // Cards
  card: {
    borderRadius: spacing.lg,
  },
  cardContent: {
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  sectionTitle: {
    marginBottom: spacing.xs,
  },

  // Profile blocks
  profileBlock: {
    borderRadius: spacing.md,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  profileLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  dividerSpacer: {
    height: spacing.sm,
  },

  // Answer rows
  answerRow: {
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  answerQuestion: {
    marginBottom: spacing.xs,
  },
  answerDivider: {
    marginVertical: spacing.xs,
  },
});

export default CoffeeQuestionnaireResultScreen;
