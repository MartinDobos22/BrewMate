import React, { ReactNode, useMemo } from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';

import { useTheme } from '../../theme/useTheme';
import { elevation } from '../../theme/theme';

type Props = {
  icon: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  accessibilityLabel: string;
};

/**
 * MD3 Floating Action Button (regular size, primary container variant).
 * Position absolutely from the parent — this component does not place itself.
 */
function FAB({ icon, onPress, style, accessibilityLabel }: Props) {
  const { colors, shape, stateLayer } = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          width: 56,
          height: 56,
          borderRadius: shape.large,
          backgroundColor: colors.primaryContainer,
          alignItems: 'center',
          justifyContent: 'center',
          ...elevation.level3.shadow,
        },
        pressedOverlay: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: colors.onPrimaryContainer,
          opacity: stateLayer.pressed,
          borderRadius: shape.large,
        },
      }),
    [colors.onPrimaryContainer, colors.primaryContainer, shape.large, stateLayer.pressed],
  );

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[styles.root, style]}>
      {({ pressed }) => (
        <>
          {icon}
          {pressed ? <View style={styles.pressedOverlay} /> : null}
        </>
      )}
    </Pressable>
  );
}

export default React.memo(FAB);
