import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useTheme } from '../../theme/useTheme';
import { CoffeeBeanIcon, CoffeeCupIcon, FlameIcon } from '../icons';
import { MD3Button } from '../md3';

const CUSTOM_PREPARATION_VALUE = '__custom_preparation__';
const DEFAULT_BREW_RATIO = 15.5;

const STRENGTH_OPTIONS = ['jemnejšie', 'vyvážene', 'výraznejšie'];

type PhotoPreparation = {
  method: string;
  description: string;
};

type Props = {
  preparations: PhotoPreparation[];
  selectedPreparation: string | null;
  onPreparationChange: (value: string) => void;
  customPreparationText: string;
  onCustomPreparationTextChange: (value: string) => void;
  strengthPreference: string | null;
  onStrengthChange: (value: string) => void;
  targetDoseG: string;
  onDoseChange: (value: string) => void;
  targetWaterMl: string;
  onWaterChange: (value: string) => void;
  targetRatio: string;
  onRatioChange: (value: string) => void;
};

function FilterConfig({
  preparations,
  selectedPreparation,
  onPreparationChange,
  customPreparationText,
  onCustomPreparationTextChange,
  strengthPreference,
  onStrengthChange,
  targetDoseG,
  onDoseChange,
  targetWaterMl,
  onWaterChange,
  targetRatio,
  onRatioChange,
}: Props) {
  const { colors, typescale, shape, elevation: elev, spacing } = useTheme();

  const s = useMemo(
    () =>
      StyleSheet.create({
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
        optionCard: {
          borderWidth: 1,
          borderColor: colors.outlineVariant,
          backgroundColor: colors.surfaceContainerLowest,
          borderRadius: shape.medium,
          padding: spacing.md,
          marginBottom: spacing.sm,
        },
        optionCardActive: {
          borderColor: colors.primary,
          backgroundColor: colors.primaryContainer,
        },
        optionTitle: {
          ...typescale.titleSmall,
          color: colors.onSurface,
          marginBottom: spacing.xs,
        },
        optionTitleActive: {
          color: colors.onPrimaryContainer,
        },
        optionText: {
          ...typescale.bodySmall,
          color: colors.onSurfaceVariant,
        },
        optionTextActive: {
          color: colors.onPrimaryContainer,
        },
        radioGroup: {
          gap: spacing.md,
        },
        radioRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
        },
        radioOuter: {
          width: 20,
          height: 20,
          borderRadius: 10,
          borderWidth: 2,
          borderColor: colors.outline,
          alignItems: 'center',
          justifyContent: 'center',
        },
        radioOuterActive: {
          borderColor: colors.primary,
        },
        radioInner: {
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: colors.primary,
        },
        radioLabel: {
          ...typescale.bodyMedium,
          color: colors.onSurface,
        },
        inputGroup: {
          marginTop: spacing.sm,
          gap: spacing.sm,
        },
        inputLabel: {
          ...typescale.labelMedium,
          color: colors.onSurfaceVariant,
        },
        input: {
          ...typescale.bodyMedium,
          color: colors.onSurface,
          borderWidth: 1,
          borderColor: colors.outlineVariant,
          borderRadius: shape.medium,
          backgroundColor: colors.surfaceContainerLowest,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
        },
        helperText: {
          ...typescale.bodySmall,
          color: colors.onSurfaceVariant,
          marginTop: spacing.sm,
        },
        previewCard: {
          marginTop: spacing.sm,
          borderRadius: shape.medium,
          borderWidth: 1,
          borderColor: colors.outlineVariant,
          backgroundColor: colors.surfaceContainerLowest,
          padding: spacing.md,
          gap: spacing.xs,
        },
        bodyText: {
          ...typescale.bodyMedium,
          color: colors.onSurface,
        },
      }),
    [colors, typescale, shape, elev, spacing],
  );

  const applyRecommendedRatio = () => {
    onRatioChange(String(DEFAULT_BREW_RATIO));
    const parsedDose = parseFloat(targetDoseG);
    const parsedWater = parseFloat(targetWaterMl);
    if (parsedDose && !parsedWater) {
      onWaterChange(String(Math.round(parsedDose * DEFAULT_BREW_RATIO * 10) / 10));
    } else if (parsedWater && !parsedDose) {
      onDoseChange(String(Math.round((parsedWater / DEFAULT_BREW_RATIO) * 10) / 10));
    }
  };

  const isCustom = selectedPreparation === CUSTOM_PREPARATION_VALUE;

  return (
    <>
      {/* Preparation method */}
      <View style={s.card}>
        <View style={s.cardHeader}>
          <CoffeeCupIcon size={20} color={colors.primary} />
          <Text style={s.cardTitle}>Najvhodnejšia príprava</Text>
        </View>
        {preparations.map((prep) => {
          const isActive = selectedPreparation === prep.method;
          return (
            <Pressable
              key={prep.method}
              style={[s.optionCard, isActive && s.optionCardActive]}
              onPress={() => onPreparationChange(prep.method)}
            >
              <Text style={[s.optionTitle, isActive && s.optionTitleActive]}>
                {prep.method}
              </Text>
              <Text style={[s.optionText, isActive && s.optionTextActive]}>
                {prep.description}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          style={[s.optionCard, isCustom && s.optionCardActive]}
          onPress={() => onPreparationChange(CUSTOM_PREPARATION_VALUE)}
        >
          <Text style={[s.optionTitle, isCustom && s.optionTitleActive]}>
            Chcem vlastnú prípravu
          </Text>
          <Text style={[s.optionText, isCustom && s.optionTextActive]}>
            Napr. Origami, Kalita, experimentálny recept.
          </Text>
        </Pressable>
        {isCustom ? (
          <View style={s.inputGroup}>
            <Text style={s.inputLabel}>Zadaj vlastný spôsob prípravy</Text>
            <TextInput
              style={s.input}
              value={customPreparationText}
              onChangeText={onCustomPreparationTextChange}
              placeholder="napr. V60 s jemnejším mletím"
              placeholderTextColor={colors.onSurfaceVariant}
            />
          </View>
        ) : null}
      </View>

      {/* Strength */}
      <View style={s.card}>
        <View style={s.cardHeader}>
          <FlameIcon size={20} color={colors.primary} />
          <Text style={s.cardTitle}>Aké chute chceš?</Text>
        </View>
        <View style={s.radioGroup}>
          {STRENGTH_OPTIONS.map((option) => (
            <Pressable
              key={option}
              style={s.radioRow}
              onPress={() => onStrengthChange(option)}
            >
              <View
                style={[
                  s.radioOuter,
                  strengthPreference === option && s.radioOuterActive,
                ]}
              >
                {strengthPreference === option ? <View style={s.radioInner} /> : null}
              </View>
              <Text style={s.radioLabel}>{option}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Dose / Water / Ratio */}
      <View style={s.card}>
        <View style={s.cardHeader}>
          <CoffeeBeanIcon size={20} color={colors.primary} />
          <Text style={s.cardTitle}>Voda, gramáž a pomer (aspoň 1 hodnota)</Text>
        </View>
        <Text style={s.helperText}>
          Zadaj aspoň gramáž kávy alebo množstvo vody. Druhú hodnotu dopočítame automaticky.
        </Text>
        <MD3Button
          label="Použiť odporúčaný pomer 1:15,5"
          variant="outlined"
          onPress={applyRecommendedRatio}
          style={{ marginTop: spacing.md }}
        />
        <View style={s.inputGroup}>
          <Text style={s.inputLabel}>Gramáž kávy (g)</Text>
          <TextInput
            style={s.input}
            value={targetDoseG}
            onChangeText={onDoseChange}
            keyboardType="decimal-pad"
            placeholder="napr. 20"
            placeholderTextColor={colors.onSurfaceVariant}
          />
        </View>
        <View style={s.inputGroup}>
          <Text style={s.inputLabel}>Množstvo vody (g / ml)</Text>
          <TextInput
            style={s.input}
            value={targetWaterMl}
            onChangeText={onWaterChange}
            keyboardType="decimal-pad"
            placeholder="napr. 310"
            placeholderTextColor={colors.onSurfaceVariant}
          />
        </View>
        <View style={s.inputGroup}>
          <Text style={s.inputLabel}>Pomer vody ku káve</Text>
          <TextInput
            style={s.input}
            value={targetRatio}
            onChangeText={onRatioChange}
            keyboardType="decimal-pad"
            placeholder="napr. 15.5"
            placeholderTextColor={colors.onSurfaceVariant}
          />
        </View>
        <View style={s.previewCard}>
          <Text style={s.bodyText}>
            {targetDoseG || '—'} g kávy • {targetWaterMl || '—'} g vody • 1:{targetRatio || '15.5'}
          </Text>
          <Text style={s.helperText}>
            Keď zadáš jednu hodnotu + pomer, ostatné dopočítame automaticky.
          </Text>
        </View>
      </View>
    </>
  );
}

export { CUSTOM_PREPARATION_VALUE };
export default React.memo(FilterConfig);
