import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { CoffeeBeanIcon } from '../components/icons';

function AuthLoadingScreen() {
  const { colors, typescale, spacing } = useTheme();

  const s = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background,
          gap: spacing.lg,
        },
        text: {
          ...typescale.bodyLarge,
          color: colors.onSurfaceVariant,
        },
      }),
    [colors, typescale, spacing],
  );

  return (
    <View style={s.container}>
      <CoffeeBeanIcon size={48} color={colors.primary} />
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={s.text}>Načítavam účet...</Text>
    </View>
  );
}

export default AuthLoadingScreen;
