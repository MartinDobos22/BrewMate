import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme/useTheme';
import LeafIcon from '../icons/LeafIcon';
import ArrowRightIcon from '../icons/ArrowRightIcon';

type Props = {
  title?: string;
  body: string;
  ctaLabel: string;
  onPressCta: () => void;
};

function DailyTipCard({
  title = 'Dnešný tip',
  body,
  ctaLabel,
  onPressCta,
}: Props) {
  const { colors, typescale, shape, stateLayer } = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          backgroundColor: colors.tertiaryContainer,
          borderRadius: shape.large,
          padding: 18,
          marginTop: 16,
        },
        topRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginBottom: 8,
        },
        overline: {
          ...typescale.labelMedium,
          color: colors.onTertiaryContainer,
          letterSpacing: 1.1,
          textTransform: 'uppercase',
        },
        body: {
          ...typescale.titleMedium,
          color: colors.onTertiaryContainer,
        },
        ctaRow: {
          flexDirection: 'row',
          justifyContent: 'flex-end',
          alignItems: 'center',
          marginTop: 14,
          gap: 6,
        },
        ctaLabel: {
          ...typescale.labelLarge,
          color: colors.onTertiaryContainer,
        },
        pressedOverlay: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: colors.onTertiaryContainer,
          opacity: stateLayer.pressed,
          borderRadius: shape.large,
        },
      }),
    [colors, shape.large, stateLayer.pressed, typescale],
  );

  return (
    <View style={styles.root}>
      <View style={styles.topRow}>
        <LeafIcon size={18} color={colors.onTertiaryContainer} />
        <Text style={styles.overline}>{title}</Text>
      </View>
      <Text style={styles.body}>{body}</Text>
      <Pressable
        onPress={onPressCta}
        accessibilityRole="button"
        accessibilityLabel={ctaLabel}
        style={styles.ctaRow}>
        {({ pressed }) => (
          <>
            <Text style={styles.ctaLabel}>{ctaLabel}</Text>
            <ArrowRightIcon size={16} color={colors.onTertiaryContainer} />
            {pressed ? <View style={styles.pressedOverlay} /> : null}
          </>
        )}
      </Pressable>
    </View>
  );
}

export default React.memo(DailyTipCard);
