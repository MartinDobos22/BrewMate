import React, { ReactNode, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { useTheme } from '../../theme/useTheme';
import { shape as shapeTokens } from '../../theme/theme';

export type TileRole = 'neutral' | 'primary' | 'secondary' | 'tertiary';

type Props = {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  /** Color role decides background + text colors via container tokens. */
  role?: TileRole;
  /** Shape token name. Defaults to `large` (16 px) for `neutral`, `extraLarge` for accent roles. */
  shape?: keyof typeof shapeTokens;
  /** Optional fixed minimum height (used for tall bento tiles). */
  minHeight?: number;
  style?: ViewStyle;
  onPress?: () => void;
  accessibilityLabel?: string;
};

const ROLE_TOKENS: Record<
  TileRole,
  { bgKey: keyof ReturnType<typeof useTheme>['colors']; onKey: keyof ReturnType<typeof useTheme>['colors'] }
> = {
  neutral: { bgKey: 'surfaceContainer', onKey: 'onSurface' },
  primary: { bgKey: 'primaryContainer', onKey: 'onPrimaryContainer' },
  secondary: { bgKey: 'secondaryContainer', onKey: 'onSecondaryContainer' },
  tertiary: { bgKey: 'tertiaryContainer', onKey: 'onTertiaryContainer' },
};

function Tile({
  title,
  subtitle,
  icon,
  role = 'neutral',
  shape: shapeKey,
  minHeight,
  style,
  onPress,
  accessibilityLabel,
}: Props) {
  const theme = useTheme();
  const { colors, typescale, stateLayer } = theme;

  const tokens = ROLE_TOKENS[role];
  const bg = colors[tokens.bgKey];
  const onColor = colors[tokens.onKey];

  // Default shape: neutral tiles get `large`, accent tiles get `extraLarge`.
  const radius =
    shapeTokens[shapeKey ?? (role === 'neutral' ? 'large' : 'extraLarge')];

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          backgroundColor: bg,
          borderRadius: radius,
          padding: 16,
          minHeight: minHeight ?? 104,
          justifyContent: 'space-between',
        },
        iconWrap: {
          width: 44,
          height: 44,
          borderRadius: 14,
          backgroundColor: colors.surfaceContainerLowest,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 8,
        },
        title: {
          ...typescale.titleMedium,
          color: onColor,
        },
        subtitle: {
          ...typescale.bodySmall,
          color: onColor,
          opacity: 0.78,
          marginTop: 2,
        },
        pressedOverlay: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: colors.onSurface,
          opacity: stateLayer.pressed,
          borderRadius: radius,
        },
      }),
    [bg, colors, minHeight, onColor, radius, stateLayer.pressed, typescale],
  );

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      style={[styles.root, style]}>
      {({ pressed }) => (
        <>
          <View>
            {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
          </View>
          <View>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {pressed ? <View style={styles.pressedOverlay} /> : null}
        </>
      )}
    </Pressable>
  );
}

export default React.memo(Tile);
