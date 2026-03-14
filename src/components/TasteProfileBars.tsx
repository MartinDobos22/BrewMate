import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ProgressBar, Text, useTheme } from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';
import { TasteVector } from '../utils/tasteVector';
import spacing from '../styles/spacing';

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
  const theme = useTheme<MD3Theme>();

  return (
    <View style={styles.wrapper}>
      {AXES.map(({ key, label }) => {
        const value = vector[key] ?? 50;
        const progress = value / 100;

        return (
          <View key={key} style={styles.item}>
            <View style={styles.row}>
              <Text
                variant="labelMedium"
                style={{ color: theme.colors.onSurface }}
              >
                {label}
              </Text>
              <Text
                variant="labelMedium"
                style={{ color: theme.colors.primary }}
              >
                {value}
              </Text>
            </View>
            <ProgressBar
              progress={progress}
              color={theme.colors.primary}
              style={[
                styles.bar,
                { backgroundColor: theme.colors.surfaceVariant },
              ]}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.md,
  },
  item: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bar: {
    height: 6,
    borderRadius: 999,
  },
});

export default TasteProfileBars;
