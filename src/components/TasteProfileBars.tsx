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
    fontSize: 14,
    fontWeight: '600',
    color: '#3E2F25',
  },
  value: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B4F3A',
  },
  bar: {
    height: 8,
    backgroundColor: '#E3DED6',
    borderRadius: 999,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: '#6B4F3A',
    borderRadius: 999,
  },
});

export default TasteProfileBars;
