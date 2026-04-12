import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../navigation/types';
import { apiFetch, DEFAULT_API_HOST } from '../utils/api';
import BottomNavBar from '../components/BottomNavBar';
import { useTheme } from '../theme/useTheme';
import { CoffeeCupIcon, SparklesIcon, PortafilterIcon } from '../components/icons';
import { MD3Button } from '../components/md3';

type Props = NativeStackScreenProps<RootStackParamList, 'CoffeePhotoRecipeResult'>;

const APPROVAL_THRESHOLD = 70;

function CoffeePhotoRecipeResultScreen({ route, navigation }: Props) {
  const { analysis, selectedPreparation, strengthPreference, recipe, likePrediction } = route.params;
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const canSave = useMemo(() => likePrediction.score >= APPROVAL_THRESHOLD, [likePrediction.score]);

  const handleSaveRecipe = async () => {
    if (!canSave || saveState === 'saving') {
      return;
    }

    try {
      setSaveState('saving');
      setErrorMessage('');

      const response = await apiFetch(
        `${DEFAULT_API_HOST}/api/coffee-recipes`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            analysis,
            recipe,
            selectedPreparation,
            strengthPreference,
            likeScore: likePrediction.score,
            approved: true,
          }),
        },
      );

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Nepodarilo sa uložiť recept.');
      }

      setSaveState('saved');
    } catch (error) {
      setSaveState('error');
      setErrorMessage(error instanceof Error ? error.message : 'Nepodarilo sa uložiť recept.');
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
          gap: spacing.md,
        },
        headerRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
        },
        overline: {
          ...typescale.labelMedium,
          color: colors.onSurfaceVariant,
          textTransform: 'uppercase',
        },
        title: {
          ...typescale.headlineMedium,
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
        highlight: {
          ...typescale.titleSmall,
          color: colors.primary,
          marginBottom: spacing.sm,
        },
        bodyText: {
          ...typescale.bodyMedium,
          color: colors.onSurface,
          marginBottom: spacing.xs,
        },
        warning: {
          ...typescale.bodySmall,
          color: colors.error,
          fontWeight: '600',
          marginTop: spacing.sm,
        },
        paramRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingVertical: spacing.xs + 2,
          borderBottomWidth: 1,
          borderBottomColor: colors.outlineVariant,
        },
        paramLabel: {
          ...typescale.labelMedium,
          color: colors.onSurfaceVariant,
        },
        paramValue: {
          ...typescale.bodyMedium,
          color: colors.onSurface,
          fontWeight: '600',
        },
        stepRow: {
          flexDirection: 'row',
          gap: spacing.sm,
          marginBottom: spacing.sm,
        },
        stepNumber: {
          ...typescale.labelLarge,
          color: colors.primary,
          minWidth: 20,
        },
        stepText: {
          ...typescale.bodyMedium,
          color: colors.onSurface,
          flex: 1,
        },
        tipText: {
          ...typescale.bodyMedium,
          color: colors.onSurface,
          marginBottom: spacing.sm,
          paddingLeft: spacing.sm,
        },
        tipBullet: {
          ...typescale.bodyMedium,
          color: colors.tertiary,
        },
        success: {
          ...typescale.bodySmall,
          color: colors.tertiary,
          fontWeight: '600',
        },
        error: {
          ...typescale.bodySmall,
          color: colors.error,
          fontWeight: '600',
        },
      }),
    [colors, typescale, shape, elev, spacing],
  );

  return (
    <SafeAreaView style={s.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.container}>
        <View style={s.headerRow}>
          <CoffeeCupIcon size={20} color={colors.onSurfaceVariant} />
          <Text style={s.overline}>BrewMate Recipe AI</Text>
        </View>
        <Text style={s.title}>{recipe.title}</Text>

        <View style={s.card}>
          <View style={s.cardHeader}>
            <SparklesIcon size={20} color={colors.primary} />
            <Text style={s.cardTitle}>AI predikcia chuti</Text>
          </View>
          <Text style={s.highlight}>
            Pravdepodobnosť, že ti bude chutiť: {likePrediction.score}%
          </Text>
          <Text style={s.bodyText}>{likePrediction.verdict}</Text>
          <Text style={s.bodyText}>{likePrediction.reason}</Text>
          {!canSave ? (
            <Text style={s.warning}>
              Recept sa dá uložiť až od {APPROVAL_THRESHOLD}%.
            </Text>
          ) : null}
        </View>

        <View style={s.card}>
          <View style={s.cardHeader}>
            <PortafilterIcon size={20} color={colors.primary} />
            <Text style={s.cardTitle}>Parametre</Text>
          </View>
          <View style={s.paramRow}>
            <Text style={s.paramLabel}>Metóda</Text>
            <Text style={s.paramValue}>{selectedPreparation}</Text>
          </View>
          <View style={s.paramRow}>
            <Text style={s.paramLabel}>Sila</Text>
            <Text style={s.paramValue}>{strengthPreference}</Text>
          </View>
          <View style={s.paramRow}>
            <Text style={s.paramLabel}>Dávka</Text>
            <Text style={s.paramValue}>{recipe.dose}</Text>
          </View>
          <View style={s.paramRow}>
            <Text style={s.paramLabel}>Voda</Text>
            <Text style={s.paramValue}>{recipe.water}</Text>
          </View>
          <View style={s.paramRow}>
            <Text style={s.paramLabel}>Mletie</Text>
            <Text style={s.paramValue}>{recipe.grind}</Text>
          </View>
          <View style={s.paramRow}>
            <Text style={s.paramLabel}>Teplota</Text>
            <Text style={s.paramValue}>{recipe.waterTemp}</Text>
          </View>
          <View style={[s.paramRow, { borderBottomWidth: 0 }]}>
            <Text style={s.paramLabel}>Čas</Text>
            <Text style={s.paramValue}>{recipe.totalTime}</Text>
          </View>
        </View>

        <View style={s.card}>
          <View style={s.cardHeader}>
            <CoffeeCupIcon size={20} color={colors.primary} />
            <Text style={s.cardTitle}>Postup</Text>
          </View>
          {recipe.steps.map((step: string, index: number) => (
            <View key={`${step}-${index}`} style={s.stepRow}>
              <Text style={s.stepNumber}>{index + 1}.</Text>
              <Text style={s.stepText}>{step}</Text>
            </View>
          ))}
        </View>

        <View style={s.card}>
          <View style={s.cardHeader}>
            <SparklesIcon size={20} color={colors.primary} />
            <Text style={s.cardTitle}>Barista tipy</Text>
          </View>
          {recipe.baristaTips.map((tip: string, index: number) => (
            <View key={`${tip}-${index}`} style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
              <Text style={s.tipBullet}>•</Text>
              <Text style={[s.stepText]}>{tip}</Text>
            </View>
          ))}
        </View>

        <MD3Button
          label={saveState === 'saving' ? 'Ukladám…' : 'Uložiť recept'}
          onPress={handleSaveRecipe}
          disabled={!canSave || saveState === 'saving'}
          loading={saveState === 'saving'}
        />

        <MD3Button
          label="Prejsť na uložené recepty"
          variant="outlined"
          onPress={() => navigation.navigate('CoffeeRecipesSaved')}
        />

        {saveState === 'saved' ? <Text style={s.success}>Recept uložený.</Text> : null}
        {saveState === 'error' ? <Text style={s.error}>{errorMessage}</Text> : null}
      </ScrollView>
      <BottomNavBar />
    </SafeAreaView>
  );
}

export default CoffeePhotoRecipeResultScreen;
