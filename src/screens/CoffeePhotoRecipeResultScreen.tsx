import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../navigation/types';
import { apiFetch, DEFAULT_API_HOST } from '../utils/api';
import BottomNavBar from '../components/BottomNavBar';
import { useTheme } from '../theme/useTheme';
import { CoffeeCupIcon, SparklesIcon, PortafilterIcon } from '../components/icons';
import { MD3Button } from '../components/md3';
import {
  MATCH_TIER_LABELS,
  MATCH_TIER_COLORS,
  matchScoreToTier,
} from '../utils/tasteVector';
import type { MatchTier } from '../utils/tasteVector';

type Props = NativeStackScreenProps<RootStackParamList, 'CoffeePhotoRecipeResult'>;

function CoffeePhotoRecipeResultScreen({ route, navigation }: Props) {
  const {
    analysis,
    brewPath: rawBrewPath,
    selectedPreparation,
    strengthPreference,
    drinkType,
    machineType,
    recipe,
    likePrediction,
  } = route.params;

  // Backwards compatibility: old recipes without brewPath default to filter
  const brewPath = rawBrewPath || 'filter';

  // Resolve match tier — prefer backend value, fall back to local computation
  const matchTier: MatchTier = (likePrediction.matchTier as MatchTier) || matchScoreToTier(likePrediction.score);
  const tierColors = MATCH_TIER_COLORS[matchTier];
  const tierLabel = MATCH_TIER_LABELS[matchTier];
  const hasQuestionnaire = likePrediction.hasQuestionnaire !== false;

  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // Warn user before leaving if recipe is not saved
  const handleBeforeRemove = useCallback(
    (e: { data: { action: { type: string } }; preventDefault: () => void }) => {
      if (saveState === 'saved' || saveState === 'saving') {
        return;
      }

      // Allow explicit "Upraviť parametre" (goBack) without blocking
      if (e.data.action.type === 'GO_BACK') {
        return;
      }

      e.preventDefault();

      Alert.alert(
        'Neuložený recept',
        'Recept ešte nie je uložený. Naozaj chceš odísť?',
        [
          { text: 'Zostať', style: 'cancel' },
          {
            text: 'Odísť',
            style: 'destructive',
            onPress: () => navigation.dispatch(e.data.action),
          },
        ],
      );
    },
    [saveState, navigation],
  );

  useEffect(
    () => navigation.addListener('beforeRemove', handleBeforeRemove),
    [navigation, handleBeforeRemove],
  );

  const handleSaveRecipe = async () => {
    if (saveState === 'saving') {
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
            recipe: { ...recipe, brewPath },
            selectedPreparation: selectedPreparation || null,
            strengthPreference: strengthPreference || null,
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
        paramRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingVertical: spacing.xs + 2,
          borderBottomWidth: 1,
          borderBottomColor: colors.outlineVariant,
        },
        paramRowLast: {
          borderBottomWidth: 0,
        },
        paramLabel: {
          ...typescale.labelMedium,
          color: colors.onSurfaceVariant,
        },
        paramValue: {
          ...typescale.bodyMedium,
          color: colors.onSurface,
          fontWeight: '600',
          flexShrink: 1,
          textAlign: 'right',
          maxWidth: '60%',
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
        tierBadge: {
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          borderWidth: 1,
          borderRadius: shape.large,
          paddingVertical: spacing.xs,
          paddingHorizontal: spacing.md,
          marginBottom: spacing.sm,
          gap: spacing.sm,
        },
        tierScore: {
          ...typescale.titleMedium,
          fontWeight: '700',
        },
        tierLabel: {
          ...typescale.labelLarge,
          fontWeight: '600',
        },
        noQuestionnaireHint: {
          ...typescale.bodySmall,
          color: colors.onSurfaceVariant,
          fontStyle: 'italic',
          marginTop: spacing.xs,
        },
      }),
    [colors, typescale, shape, elev, spacing],
  );

  const renderParamRow = (label: string, value: string | undefined, isLast = false) => {
    if (!value) {
      return null;
    }
    return (
      <View style={[s.paramRow, isLast && s.paramRowLast]} key={label}>
        <Text style={s.paramLabel}>{label}</Text>
        <Text style={s.paramValue}>{value}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.container}>
        <View style={s.headerRow}>
          <CoffeeCupIcon size={20} color={colors.onSurfaceVariant} />
          <Text style={s.overline}>BrewMate Recipe AI</Text>
        </View>
        <Text style={s.title}>{recipe.title}</Text>

        {/* AI prediction card */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <SparklesIcon size={20} color={colors.primary} />
            <Text style={s.cardTitle}>AI predikcia chuti</Text>
          </View>
          <View
            style={[
              s.tierBadge,
              { backgroundColor: tierColors.bg, borderColor: tierColors.border },
            ]}
          >
            <Text style={[s.tierScore, { color: tierColors.border }]}>
              {likePrediction.score}%
            </Text>
            <Text style={[s.tierLabel, { color: tierColors.border }]}>
              {tierLabel}
            </Text>
          </View>
          <Text style={s.bodyText}>{likePrediction.verdict}</Text>
          <Text style={s.bodyText}>{likePrediction.reason}</Text>
          {!hasQuestionnaire ? (
            <Text style={s.noQuestionnaireHint}>
              Pre presnejšiu predikciu vyplň chuťový dotazník v profile.
            </Text>
          ) : null}
          {recipe.whyThisRecipe ? (
            <>
              <Text style={s.highlight}>Prečo tento recept?</Text>
              <Text style={s.bodyText}>{recipe.whyThisRecipe}</Text>
            </>
          ) : null}
        </View>

        {/* Parameters card */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <PortafilterIcon size={20} color={colors.primary} />
            <Text style={s.cardTitle}>Parametre</Text>
          </View>

          {brewPath === 'espresso' ? (
            <>
              {renderParamRow('Typ nápoja', drinkType || recipe.drinkType)}
              {renderParamRow('Stroj', machineType || recipe.machineType)}
              {renderParamRow('Dávka', recipe.dose)}
              {renderParamRow('Výťažok', recipe.yield)}
              {renderParamRow('Pomer', recipe.ratio)}
              {renderParamRow('Mletie', recipe.grind)}
              {renderParamRow('Teplota', recipe.waterTemp)}
              {renderParamRow('Čas extrakcie', recipe.extractionTime)}
              {recipe.pressure && recipe.pressure !== 'N/A'
                ? renderParamRow('Tlak', recipe.pressure, true)
                : renderParamRow('Čas extrakcie', undefined, true)}
            </>
          ) : (
            <>
              {renderParamRow('Metóda', selectedPreparation || recipe.method)}
              {renderParamRow('Sila', strengthPreference || recipe.strengthPreference)}
              {renderParamRow('Dávka', recipe.dose)}
              {renderParamRow('Voda', recipe.water)}
              {renderParamRow('Mletie', recipe.grind)}
              {renderParamRow('Teplota', recipe.waterTemp)}
              {renderParamRow('Čas', recipe.totalTime, true)}
            </>
          )}
        </View>

        {/* Steps card */}
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

        {/* Milk instructions (espresso only) */}
        {brewPath === 'espresso' && recipe.milkInstructions ? (
          <View style={s.card}>
            <View style={s.cardHeader}>
              <CoffeeCupIcon size={20} color={colors.primary} />
              <Text style={s.cardTitle}>Príprava mlieka</Text>
            </View>
            <Text style={s.bodyText}>{recipe.milkInstructions}</Text>
          </View>
        ) : null}

        {/* Barista tips */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <SparklesIcon size={20} color={colors.primary} />
            <Text style={s.cardTitle}>Barista tipy</Text>
          </View>
          {recipe.baristaTips.map((tip: string, index: number) => (
            <View key={`${tip}-${index}`} style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
              <Text style={s.tipBullet}>•</Text>
              <Text style={s.stepText}>{tip}</Text>
            </View>
          ))}
        </View>

        {/* Action buttons */}
        <MD3Button
          label={saveState === 'saving' ? 'Ukladám…' : 'Uložiť recept'}
          onPress={handleSaveRecipe}
          disabled={saveState === 'saving'}
          loading={saveState === 'saving'}
        />

        <MD3Button
          label="Upraviť parametre"
          variant="tonal"
          onPress={() => navigation.goBack()}
        />

        {!hasQuestionnaire ? (
          <MD3Button
            label="Vyplniť chuťový dotazník"
            variant="tonal"
            onPress={() => navigation.navigate('CoffeeQuestionnaire')}
          />
        ) : null}

        <MD3Button
          label="Prejsť na uložené recepty"
          variant="outlined"
          onPress={() => navigation.navigate('CoffeeRecipesSaved')}
        />

        {saveState === 'saved' ? (
          <>
            <Text style={s.success}>Recept uložený.</Text>
            <MD3Button
              label="Nový recept"
              variant="tonal"
              onPress={() =>
                navigation.reset({
                  index: 1,
                  routes: [{ name: 'Home' }, { name: 'CoffeePhotoRecipe' }],
                })
              }
            />
          </>
        ) : null}
        {saveState === 'error' ? (
          <>
            <Text style={s.error}>{errorMessage}</Text>
            <MD3Button
              label="Skúsiť znovu"
              variant="outlined"
              onPress={handleSaveRecipe}
            />
          </>
        ) : null}
      </ScrollView>
      <BottomNavBar />
    </SafeAreaView>
  );
}

export default CoffeePhotoRecipeResultScreen;
