import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme/useTheme';
import { LOW_STOCK_THRESHOLD_G } from '../../constants/business';
import CoffeeBeanIcon from '../icons/CoffeeBeanIcon';
import FlameIcon from '../icons/FlameIcon';
import type { HomeInventoryItem } from '../../hooks/useHomeDashboard';

/** Assumed roasted-bag size in grams. Used to render the fill bar percentage. */
const ASSUMED_PACK_SIZE_G = 250;

type Props = {
  item: HomeInventoryItem;
  onPress: () => void;
};

function CoffeeShelfCard({ item, onPress }: Props) {
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

export default React.memo(CoffeeShelfCard);
