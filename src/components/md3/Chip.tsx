import React, { ReactNode, useMemo } from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

import { useTheme } from '../../theme/useTheme';

export type ChipRole = 'neutral' | 'primary' | 'secondary' | 'tertiary' | 'error';

type Props = {
  label: string;
  icon?: ReactNode;
  role?: ChipRole;
  style?: ViewStyle;
};

const ROLE_TOKENS: Record<
  ChipRole,
  { bgKey: keyof ReturnType<typeof useTheme>['colors']; onKey: keyof ReturnType<typeof useTheme>['colors'] }
> = {
  neutral: { bgKey: 'surfaceContainerHigh', onKey: 'onSurface' },
  primary: { bgKey: 'primaryContainer', onKey: 'onPrimaryContainer' },
  secondary: { bgKey: 'secondaryContainer', onKey: 'onSecondaryContainer' },
  tertiary: { bgKey: 'tertiaryContainer', onKey: 'onTertiaryContainer' },
  error: { bgKey: 'errorContainer', onKey: 'onErrorContainer' },
};

function Chip({ label, icon, role = 'neutral', style }: Props) {
  const { colors, typescale, shape } = useTheme();
  const tokens = ROLE_TOKENS[role];

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          alignSelf: 'flex-start',
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: shape.small,
          backgroundColor: colors[tokens.bgKey],
        },
        label: {
          ...typescale.labelMedium,
          color: colors[tokens.onKey],
        },
      }),
    [colors, shape.small, tokens.bgKey, tokens.onKey, typescale.labelMedium],
  );

  return (
    <View style={[styles.root, style]}>
      {icon}
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

export default React.memo(Chip);
