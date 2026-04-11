import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export type QuickAction = {
  key: string;
  label: string;
  icon: string;
  onPress: () => void;
};

type Props = {
  actions: QuickAction[];
};

function QuickActionsGrid({ actions }: Props) {
  return (
    <View style={styles.quickGrid}>
      {actions.map(action => (
        <Pressable key={action.key} style={styles.quickCard} onPress={action.onPress}>
          <Text style={styles.quickIcon}>{action.icon}</Text>
          <Text style={styles.quickLabel}>{action.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickCard: {
    width: '48%',
    borderRadius: 18,
    padding: 12,
    minHeight: 82,
    borderWidth: 1,
    borderColor: '#E5D8CC',
    backgroundColor: '#FFF8F3',
    justifyContent: 'space-between',
  },
  quickIcon: {
    fontSize: 20,
  },
  quickLabel: {
    marginTop: 6,
    color: '#2C1F13',
    fontWeight: '600',
    fontSize: 14,
  },
});

export default React.memo(QuickActionsGrid);
