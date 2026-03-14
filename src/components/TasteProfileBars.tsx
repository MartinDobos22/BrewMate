import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';
import { TasteVector } from '../utils/tasteVector';
import spacing, { radii } from '../styles/spacing';
import { extraColors } from '../theme/theme';

const AXES: Array<{ key: keyof TasteVector; label: string }> = [
  { key: 'body', label: 'Intenzita' },
  { key: 'acidity', label: 'Kyslosť' },
  { key: 'sweetness', label: 'Sladkosť' },
  { key: 'bitterness', label: 'Horkosť' },
  { key: 'fruity', label: 'Ovocnosť' },
  { key: 'roast', label: 'Praženie' },
];

type Props = {
  vector: TasteVector;
  /** Show only the first 4 axes (for compact Home view) */
  compact?: boolean;
};

function TasteProfileBars({ vector, compact = false }: Props) {
  const theme = useTheme<MD3Theme>();
  const axes = compact ? AXES.slice(0, 4) : AXES;

  return (
    <View style={styles.wrapper}>
      {axes.map(({ key, label }) => {
        const value = vector[key] ?? 50;
        const displayVal = (value / 10).toFixed(1);

        return (
          <View key={key} style={styles.barRow}>
            <Text style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>
              {label}
            </Text>
            <View style={[styles.track, { backgroundColor: extraColors.surfaceContainerHigh }]}>
              <View
                style={[
                  styles.fill,
                  {
                    width: `${value}%`,
                    backgroundColor: theme.colors.primary,
                  },
                ]}
              />
            </View>
            <Text style={[styles.value, { color: theme.colors.primary }]}>
              {displayVal}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 2,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  label: {
    width: 60,
    fontSize: 12,
    fontWeight: '500',
  },
  track: {
    height: 5,
    borderRadius: 3,
    flex: 1,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
  value: {
    width: 26,
    textAlign: 'right',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});

export default TasteProfileBars;
