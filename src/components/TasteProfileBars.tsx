import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { TasteAxis, TasteVector } from '../utils/tasteVector';
import { useTheme } from '../theme/useTheme';

const AXES: Array<{
  key: TasteAxis;
  label: string;
  colorRole: 'primary' | 'tertiary';
}> = [
  { key: 'acidity', label: 'Kyslosť', colorRole: 'tertiary' },
  { key: 'sweetness', label: 'Sladkosť', colorRole: 'tertiary' },
  { key: 'bitterness', label: 'Horkosť', colorRole: 'primary' },
  { key: 'body', label: 'Telo', colorRole: 'primary' },
  { key: 'fruity', label: 'Ovocnosť', colorRole: 'tertiary' },
  { key: 'roast', label: 'Praženie', colorRole: 'primary' },
];

type Props = {
  vector: TasteVector;
};

function TasteProfileBars({ vector }: Props) {
  const { colors, typescale, shape, spacing } = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrapper: {
          gap: spacing.md,
        },
        item: {
          gap: spacing.sm,
        },
        row: {
          flexDirection: 'row',
          justifyContent: 'space-between',
        },
        label: {
          ...typescale.labelLarge,
          color: colors.onSurface,
        },
        bar: {
          height: spacing.md,
          backgroundColor: colors.surfaceVariant,
          borderRadius: shape.full,
          overflow: 'hidden',
        },
        barFill: {
          height: '100%',
          borderRadius: shape.full,
        },
      }),
    [colors, shape.full, spacing.md, spacing.sm, typescale.labelLarge],
  );

  return (
    <View style={styles.wrapper}>
      {AXES.map(({ key, label, colorRole }) => {
        const value = vector[key] ?? 50;
        const fillColor = colors[colorRole];
        return (
          <View key={key} style={styles.item}>
            <View style={styles.row}>
              <Text style={styles.label}>{label}</Text>
              <Text style={[styles.label, { color: fillColor }]}>{value}%</Text>
            </View>
            <View style={styles.bar}>
              <View
                style={[
                  styles.barFill,
                  { width: `${value}%`, backgroundColor: fillColor },
                ]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

export default TasteProfileBars;
