import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme/useTheme';
import ArrowRightIcon from '../icons/ArrowRightIcon';
import PlusIcon from '../icons/PlusIcon';
import CoffeeShelfCard from './CoffeeShelfCard';
import type { HomeInventoryItem } from '../../hooks/useHomeDashboard';

type Props = {
  items: HomeInventoryItem[];
  onOpenInventory: () => void;
};

function CoffeeShelfScroller({ items, onOpenInventory }: Props) {
  const { colors, typescale, shape } = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrapper: {
          marginTop: 24,
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        },
        title: {
          ...typescale.titleLarge,
          color: colors.onBackground,
        },
        moreButton: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingVertical: 4,
        },
        moreLabel: {
          ...typescale.labelLarge,
          color: colors.primary,
        },
        scrollContent: {
          gap: 12,
          paddingRight: 4,
        },
        emptyCard: {
          width: 220,
          height: 132,
          borderRadius: shape.large,
          backgroundColor: colors.surfaceContainerLow,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        },
        emptyText: {
          ...typescale.bodyMedium,
          color: colors.onSurfaceVariant,
          textAlign: 'center',
        },
        addCard: {
          width: 132,
          borderRadius: shape.large,
          borderWidth: 1.5,
          borderStyle: 'dashed',
          borderColor: colors.outline,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 14,
        },
        addLabel: {
          ...typescale.labelLarge,
          color: colors.primary,
          marginTop: 6,
          textAlign: 'center',
        },
      }),
    [colors, shape.large, typescale],
  );

  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <Text style={styles.title}>Tvoja polica</Text>
        <Pressable onPress={onOpenInventory} style={styles.moreButton} accessibilityRole="button">
          <Text style={styles.moreLabel}>Doplniť</Text>
          <ArrowRightIcon size={16} color={colors.primary} />
        </Pressable>
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            Polica je prázdna. Pridaj prvú kávu pomocou skenera alebo manuálne.
          </Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}>
          {items.map(item => (
            <CoffeeShelfCard key={item.id} item={item} onPress={onOpenInventory} />
          ))}
          <Pressable
            style={styles.addCard}
            onPress={onOpenInventory}
            accessibilityRole="button"
            accessibilityLabel="Pridať novú kávu">
            <PlusIcon size={28} color={colors.primary} />
            <Text style={styles.addLabel}>Pridať</Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

export default React.memo(CoffeeShelfScroller);
