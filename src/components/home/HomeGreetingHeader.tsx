import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme/useTheme';

// ---------------------------------------------------------------------------
// Greeting helpers (inlined — previously in utils/greeting.ts)
// ---------------------------------------------------------------------------

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Dobré ráno';
  if (hour >= 12 && hour < 18) return 'Dobrý deň';
  return 'Dobrý večer';
}

function formatSlovakDate(): string {
  try {
    const formatted = new Date().toLocaleDateString('sk-SK', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Props = {
  userName: string | null | undefined;
  userEmail?: string | null;
  onPressAvatar: () => void;
};

function HomeGreetingHeader({ userName, userEmail, onPressAvatar }: Props) {
  const { colors, typescale } = useTheme();

  const greeting = useMemo(() => getTimeGreeting(), []);
  const dateLabel = useMemo(() => formatSlovakDate(), []);

  const initial = useMemo(() => {
    const fromName = userName?.trim().charAt(0);
    if (fromName) return fromName.toUpperCase();
    const fromEmail = userEmail?.trim().charAt(0);
    if (fromEmail) return fromEmail.toUpperCase();
    return '☕';
  }, [userEmail, userName]);

  const displayName = userName?.trim() || 'priateľ kávy';

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
        },
        textWrap: {
          flex: 1,
          paddingRight: 12,
        },
        greeting: {
          ...typescale.headlineMedium,
          color: colors.onBackground,
        },
        date: {
          ...typescale.bodyMedium,
          color: colors.onSurfaceVariant,
          marginTop: 2,
        },
        avatar: {
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: colors.primaryContainer,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: colors.outlineVariant,
        },
        avatarText: {
          ...typescale.titleLarge,
          color: colors.onPrimaryContainer,
        },
      }),
    [colors, typescale],
  );

  return (
    <View style={styles.root}>
      <View style={styles.textWrap}>
        <Text style={styles.greeting} numberOfLines={1}>
          {greeting}, {displayName}
        </Text>
        <Text style={styles.date} numberOfLines={1}>
          {dateLabel}
        </Text>
      </View>
      <Pressable
        onPress={onPressAvatar}
        accessibilityRole="button"
        accessibilityLabel="Otvoriť profil"
        style={styles.avatar}>
        <Text style={styles.avatarText}>{initial}</Text>
      </Pressable>
    </View>
  );
}

export default React.memo(HomeGreetingHeader);
