import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme/useTheme';
import { LOW_STOCK_THRESHOLD_G } from '../../constants/business';
import { ArrowRightIcon, CoffeeBeanIcon, FlameIcon, PlusIcon } from '../icons';
import type { HomeInventoryItem } from '../../hooks/useHomeDashboard';

// ---------------------------------------------------------------------------
// CoffeeShelfCard (inlined — previously a separate file)
// ---------------------------------------------------------------------------

const ASSUMED_PACK_SIZE_G = 250;

type CardProps = {
  item: HomeInventoryItem;
  onPress: () => void;
};

function CoffeeShelfCard({ item, onPress }: CardProps) {
  const { colors, typescale, shape, stateLayer } = useTheme();

  const isLowStock =
    typeof item.remainingG === 'number' &&
    item.remainingG > 0 &&
    item.remainingG <= LOW_STOCK_THRESHOLD_G;

  const fillPercent = useMemo(() => {
    if (typeof item.remainingG !== 'number' || item.remainingG <= 0) return 0;
    return Math.min(100, Math.round((item.remainingG / ASSUMED_PACK_SIZE_G) * 100));
  }, [item.remainingG]);

  const name =
    item.correctedText?.trim() || item.rawText?.trim() || 'Neznáma káva';

  const remainingLabel =
    typeof item.remainingG === 'number' ? `${item.remainingG} g` : 'neznáme';

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          width: 156,
          padding: 14,
          borderRadius: shape.large,
          backgroundColor: colors.surfaceContainerLow,
          borderWidth: isLowStock ? 1 : 0,
          borderColor: isLowStock ? colors.error : 'transparent',
          gap: 10,
        },
        topRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        iconWrap: {
          width: 36,
          height: 36,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surfaceContainerLowest,
        },
        title: {
          ...typescale.titleSmall,
          color: colors.onSurface,
        },
        track: {
          height: 6,
          borderRadius: shape.full,
          backgroundColor: colors.outlineVariant,
          overflow: 'hidden',
        },
        fill: {
          height: '100%',
          backgroundColor: isLowStock ? colors.error : colors.primary,
          borderRadius: shape.full,
        },
        meta: {
          ...typescale.bodySmall,
          color: colors.onSurfaceVariant,
        },
        pressedOverlay: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: colors.onSurface,
          opacity: stateLayer.pressed,
          borderRadius: shape.large,
        },
      }),
    [colors, isLowStock, shape.full, shape.large, stateLayer.pressed, typescale],
  );

  return (
    <Pressable onPress={onPress} style={styles.root} accessibilityRole="button" accessibilityLabel={name}>
      {({ pressed }) => (
        <>
          <View style={styles.topRow}>
            <View style={styles.iconWrap}>
              <CoffeeBeanIcon size={18} color={colors.primary} />
            </View>
            {isLowStock ? <FlameIcon size={18} color={colors.error} /> : null}
          </View>
          <Text style={styles.title} numberOfLines={2}>
            {name}
          </Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${fillPercent}%` }]} />
          </View>
          <Text style={styles.meta}>Zostáva {remainingLabel}</Text>
          {pressed ? <View style={styles.pressedOverlay} /> : null}
        </>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// CoffeeShelfScroller
// ---------------------------------------------------------------------------

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
