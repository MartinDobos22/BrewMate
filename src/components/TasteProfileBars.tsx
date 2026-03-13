import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { TasteVector } from '../utils/tasteVector';

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

const styles = StyleSheet.create({
  wrapper: {
    gap: 14,
  },
  item: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  value: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8B7355',
  },
  bar: {
    height: 6,
    backgroundColor: '#F0F0F0',
    borderRadius: 999,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: '#8B7355',
    borderRadius: 999,
  },
});

export default TasteProfileBars;
