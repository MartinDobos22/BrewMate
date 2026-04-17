import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useTheme } from '../../theme/useTheme';
import { CoffeeCupIcon, FlameIcon } from '../icons';
import { MD3Button } from '../md3';
import { DEFAULT_ESPRESSO_RATIO, normalizeEspressoBrew } from '../../utils/brewCalc';

const PURE_ESPRESSO_DRINKS = ['Espresso', 'Ristretto', 'Lungo', 'Doppio'];
const MILK_DRINKS = ['Latte', 'Cappuccino', 'Flat White', 'Cortado', 'Macchiato'];
const MACHINE_TYPES = ['Pákový stroj', 'Automatický kávovar'];

type Props = {
  drinkType: string | null;
  onDrinkTypeChange: (value: string) => void;
  machineType: string | null;
  onMachineTypeChange: (value: string) => void;
  targetDoseG: string;
  onDoseChange: (value: string) => void;
  targetYieldG: string;
  onYieldChange: (value: string) => void;
  targetRatio: string;
  onRatioChange: (value: string) => void;
};

function EspressoConfig({
  drinkType,
  onDrinkTypeChange,
  machineType,
  onMachineTypeChange,
  targetDoseG,
  onDoseChange,
  targetYieldG,
  onYieldChange,
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
        subsectionTitle: {
          ...typescale.labelLarge,
          color: colors.primary,
          marginTop: spacing.md,
          marginBottom: spacing.xs,
        },
        chipsRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.sm,
          marginTop: spacing.xs,
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
    const normalized = normalizeEspressoBrew({
      dose: targetDoseG,
      yieldG: targetYieldG,
      ratio: DEFAULT_ESPRESSO_RATIO,
    });
    onRatioChange(String(DEFAULT_ESPRESSO_RATIO));
    if (normalized.targetDoseG != null) {
      onDoseChange(String(normalized.targetDoseG));
    }
    if (normalized.targetYieldG != null) {
      onYieldChange(String(normalized.targetYieldG));
    }
  };

  const renderChip = (label: string, isActive: boolean, onPress: () => void) => (
    <Pressable
      key={label}
      onPress={onPress}
      style={[s.chipButton, isActive && s.chipButtonActive]}
    >
      <Text style={[s.chipButtonText, isActive && s.chipButtonTextActive]}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <>
      {/* Drink type */}
      <View style={s.card}>
        <View style={s.cardHeader}>
          <CoffeeCupIcon size={20} color={colors.primary} />
          <Text style={s.cardTitle}>Typ nápoja</Text>
        </View>

        <Text style={s.subsectionTitle}>Espresso nápoje</Text>
        <View style={s.chipsRow}>
          {PURE_ESPRESSO_DRINKS.map((drink) =>
            renderChip(drink, drinkType === drink, () => onDrinkTypeChange(drink)),
          )}
        </View>

        <Text style={s.subsectionTitle}>Mliečne nápoje</Text>
        <View style={s.chipsRow}>
          {MILK_DRINKS.map((drink) =>
            renderChip(drink, drinkType === drink, () => onDrinkTypeChange(drink)),
          )}
        </View>
      </View>

      {/* Machine type */}
      <View style={s.card}>
        <View style={s.cardHeader}>
          <FlameIcon size={20} color={colors.primary} />
          <Text style={s.cardTitle}>Typ kávovaru</Text>
        </View>
        <View style={s.chipsRow}>
          {MACHINE_TYPES.map((type) =>
            renderChip(type, machineType === type, () => onMachineTypeChange(type)),
          )}
        </View>
      </View>

      {/* Dose / Yield / Ratio */}
      <View style={s.card}>
        <View style={s.cardHeader}>
          <CoffeeCupIcon size={20} color={colors.primary} />
          <Text style={s.cardTitle}>Dávka a výťažok</Text>
        </View>
        <Text style={s.helperText}>
          Zadaj dávku kávy alebo požadovaný výťažok. Zvyšok dopočítame.
        </Text>
        <MD3Button
          label={`Použiť pomer 1:${DEFAULT_ESPRESSO_RATIO} (štandard)`}
          variant="outlined"
          onPress={applyRecommendedRatio}
          style={{ marginTop: spacing.md }}
        />
        <View style={s.inputGroup}>
          <Text style={s.inputLabel}>Dávka kávy (g)</Text>
          <TextInput
            style={s.input}
            value={targetDoseG}
            onChangeText={onDoseChange}
            keyboardType="decimal-pad"
            placeholder="napr. 18"
            placeholderTextColor={colors.onSurfaceVariant}
          />
        </View>
        <View style={s.inputGroup}>
          <Text style={s.inputLabel}>Výťažok (g)</Text>
          <TextInput
            style={s.input}
            value={targetYieldG}
            onChangeText={onYieldChange}
            keyboardType="decimal-pad"
            placeholder="napr. 36"
            placeholderTextColor={colors.onSurfaceVariant}
          />
        </View>
        <View style={s.inputGroup}>
          <Text style={s.inputLabel}>Pomer (1:X)</Text>
          <TextInput
            style={s.input}
            value={targetRatio}
            onChangeText={onRatioChange}
            keyboardType="decimal-pad"
            placeholder="napr. 2"
            placeholderTextColor={colors.onSurfaceVariant}
          />
        </View>
        <View style={s.previewCard}>
          <Text style={s.bodyText}>
            {targetDoseG || '—'}g kávy → {targetYieldG || '—'}g výťažok → 1:{targetRatio || String(DEFAULT_ESPRESSO_RATIO)}
          </Text>
        </View>
      </View>
    </>
  );
}

export default React.memo(EspressoConfig);
