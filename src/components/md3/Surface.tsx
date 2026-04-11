import React from 'react';
import { StyleSheet, View, ViewProps, ViewStyle } from 'react-native';

import { ElevationLevel, elevation, shape as shapeTokens } from '../../theme/theme';
import { useTheme } from '../../theme/useTheme';

type ShapeKey = keyof typeof shapeTokens;

type Props = ViewProps & {
  /** MD3 elevation level. Determines shadow depth + tonal tint. */
  level?: ElevationLevel;
  /** Shape token name from the MD3 shape scale. Defaults to `large` (16 px). */
  shape?: ShapeKey;
  /** Background color override. Defaults to surface containers based on level. */
  background?: string;
};

const LEVEL_TO_BACKGROUND_KEY = {
  level0: 'surface',
  level1: 'surfaceContainerLow',
  level2: 'surfaceContainer',
  level3: 'surfaceContainerHigh',
  level4: 'surfaceContainerHigh',
  level5: 'surfaceContainerHighest',
} as const;

/**
 * MD3 tonal surface. Backgrounds map to the surface-container scale based on
 * elevation level (per the spec); shadows come from the matching `elevation`
 * token. Pass `background` to override (e.g. for accent containers).
 */
function Surface({
  level = 'level0',
  shape: shapeKey = 'large',
  background,
  style,
  children,
  ...rest
}: Props) {
  const { colors } = useTheme();
  const bg = background ?? colors[LEVEL_TO_BACKGROUND_KEY[level]];
  const radius = shapeTokens[shapeKey];

  const elevationStyle: ViewStyle = elevation[level].shadow;

  return (
    <View
      {...rest}
      style={StyleSheet.flatten([
        {
          backgroundColor: bg,
          borderRadius: radius,
        },
        elevationStyle,
        style,
      ])}>
      {children}
    </View>
  );
}

export default Surface;
