import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useTheme } from '../../theme/useTheme';
import { CoffeeBeanIcon } from '../icons';

const GRINDER_TYPES = ['elektrický', 'ručný', 'nemám mlynček'];

type Props = {
  grinderType: string | null;
  onGrinderTypeChange: (value: string) => void;
  grinderModel: string;
  onGrinderModelChange: (value: string) => void;
  grinderSettingScale: string;
  onGrinderSettingScaleChange: (value: string) => void;
};

function GrinderConfig({
  grinderType,
  onGrinderTypeChange,
  grinderModel,
  onGrinderModelChange,
  grinderSettingScale,
  onGrinderSettingScaleChange,
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
        helperText: {
          ...typescale.bodySmall,
          color: colors.onSurfaceVariant,
          marginTop: spacing.sm,
        },
        chipsRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.sm,
          marginTop: spacing.sm,
        },
        chipButton: {
          borderWidth: 1,
          borderColor: colors.outlineVariant,
          borderRadius: shape.large,
          paddingVertical: spacing.xs,
          paddingHorizontal: spacing.md,
          backgroundColor: colors.surfaceContainerLowest,
        },
        chipButtonActive: {
          borderColor: colors.primary,
          backgroundColor: colors.primaryContainer,
        },
        chipButtonText: {
          ...typescale.bodySmall,
          color: colors.onSurface,
        },
        chipButtonTextActive: {
          color: colors.onPrimaryContainer,
          fontWeight: '600',
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
      }),
    [colors, typescale, shape, elev, spacing],
  );

  const showModelFields = grinderType && grinderType !== 'nemám mlynček';

  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <CoffeeBeanIcon size={20} color={colors.primary} />
        <Text style={s.cardTitle}>Tvoj mlynček (voliteľné)</Text>
      </View>
      <Text style={s.helperText}>
        Ak zadáš mlynček, AI rozpozná model a odporúči presné nastavenie mletia. Inak odporúči mletie slovne.
      </Text>
      <View style={s.chipsRow}>
        {GRINDER_TYPES.map((type) => {
          const isActive = grinderType === type;
          return (
            <Pressable
              key={type}
              onPress={() => onGrinderTypeChange(type)}
              style={[s.chipButton, isActive && s.chipButtonActive]}
            >
              <Text style={[s.chipButtonText, isActive && s.chipButtonTextActive]}>
                {type}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {showModelFields ? (
        <>
          <View style={s.inputGroup}>
            <Text style={s.inputLabel}>Model mlynčeka (voliteľné)</Text>
            <TextInput
              style={s.input}
              value={grinderModel}
              onChangeText={onGrinderModelChange}
              placeholder="napr. Comandante C40, Baratza Encore, Niche Zero"
              placeholderTextColor={colors.onSurfaceVariant}
            />
          </View>
          <View style={s.inputGroup}>
            <Text style={s.inputLabel}>Škála nastavenia (voliteľné)</Text>
            <TextInput
              style={s.input}
              value={grinderSettingScale}
              onChangeText={onGrinderSettingScaleChange}
              placeholder="napr. kliky 1-30 alebo čísla 1-40"
              placeholderTextColor={colors.onSurfaceVariant}
            />
          </View>
        </>
      ) : null}
    </View>
  );
}

export default React.memo(GrinderConfig);
