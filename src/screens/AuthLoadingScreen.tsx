import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';
import spacing from '../styles/spacing';

function AuthLoadingScreen() {
  const theme = useTheme<MD3Theme>();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ActivityIndicator
        animating
        size="large"
        color={theme.colors.primary}
      />
      <Text variant="bodyMedium" style={[styles.text, { color: theme.colors.onSurfaceVariant }]}>
        Načítavam účet...
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  text: {
    marginTop: spacing.sm,
  },
});

export default AuthLoadingScreen;
