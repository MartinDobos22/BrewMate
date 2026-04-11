import React, { ReactNode, useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

import { useTheme } from '../../theme/useTheme';

export type MD3ButtonVariant = 'filled' | 'tonal' | 'outlined' | 'text';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: MD3ButtonVariant;
  icon?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
};

function MD3Button({
  label,
  onPress,
  variant = 'filled',
  icon,
  disabled = false,
  loading = false,
  style,
  accessibilityLabel,
}: Props) {
  const { colors, shape, typescale, stateLayer } = useTheme();

  const styles = useMemo(() => {
    const isFilled = variant === 'filled';
    const isTonal = variant === 'tonal';
    const isOutlined = variant === 'outlined';

    const bg = isFilled
      ? colors.primary
      : isTonal
      ? colors.secondaryContainer
      : 'transparent';

    const fg = isFilled
      ? colors.onPrimary
      : isTonal
      ? colors.onSecondaryContainer
      : colors.primary;

    return StyleSheet.create({
      root: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        height: 40,
        paddingHorizontal: variant === 'text' ? 12 : 24,
        borderRadius: shape.full,
        backgroundColor: bg,
        borderWidth: isOutlined ? 1 : 0,
        borderColor: colors.outline,
        opacity: disabled ? 0.4 : 1,
      },
      label: {
        ...typescale.labelLarge,
        color: fg,
      },
      pressedOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: fg,
        opacity: stateLayer.pressed,
        borderRadius: shape.full,
      },
    });
  }, [colors, disabled, shape.full, stateLayer.pressed, typescale.labelLarge, variant]);

  return (
    <Pressable
      disabled={disabled || loading}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={[styles.root, style]}>
      {({ pressed }) => (
        <>
          {icon}
          {loading ? (
            <ActivityIndicator size="small" color={styles.label.color as string} />
          ) : (
            <Text style={styles.label}>{label}</Text>
          )}
          {pressed ? <View style={styles.pressedOverlay} /> : null}
        </>
      )}
    </Pressable>
  );
}

export default React.memo(MD3Button);
