import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { TasteVector } from '../utils/tasteVector';
import { useTheme } from '../theme/useTheme';

const AXES: Array<{ key: keyof TasteVector; label: string }> = [
  { key: 'acidity', label: 'Kyslosť' },
  { key: 'sweetness', label: 'Sladkosť' },
  { key: 'bitterness', label: 'Horkosť' },
  { key: 'body', label: 'Telo' },
  { key: 'fruity', label: 'Ovocnosť' },
  { key: 'roast', label: 'Praženie' },
];

type Props = {
  vector: TasteVector;
};

function TasteProfileBars({ vector }: Props) {
  const { colors, typescale, shape } = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrapper: {
          gap: 12,
        },
        item: {
          gap: 6,
        },
        row: {
          flexDirection: 'row',
          justifyContent: 'space-between',
        },
        label: {
          ...typescale.labelLarge,
          color: colors.onSurface,
        },
        value: {
          ...typescale.labelLarge,
          color: colors.primary,
        },
        bar: {
          height: 10,
          backgroundColor: colors.outlineVariant,
          borderRadius: shape.full,
          overflow: 'hidden',
        },
        barFill: {
          height: '100%',
          backgroundColor: colors.primary,
          borderRadius: shape.full,
        },
      }),
    [colors, shape.full, typescale],
  );

  return (
    <View style={styles.wrapper}>
      {AXES.map(({ key, label }) => {
        const value = vector[key] ?? 50;
        return (
          <View key={key} style={styles.item}>
            <View style={styles.row}>
              <Text style={styles.label}>{label}</Text>
              <Text style={styles.value}>{value}</Text>
            </View>
            <View style={styles.bar}>
              <View style={[styles.barFill, { width: `${value}%` }]} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

export default TasteProfileBars;
