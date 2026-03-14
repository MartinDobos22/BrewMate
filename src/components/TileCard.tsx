import React from 'react';
import { StyleSheet, Pressable } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import type { MD3Theme } from 'react-native-paper';
import spacing from '../styles/spacing';

type TileCardProps = {
  title: string;
  subtitle?: string;
  icon?: string;
  onPress?: () => void;
};

function TileCard({ title, subtitle, icon, onPress }: TileCardProps) {
  const theme = useTheme<MD3Theme>();

  return (
    <Pressable onPress={onPress} style={styles.pressable}>
      <Card
        mode="contained"
        style={[
          styles.card,
          { backgroundColor: theme.colors.surfaceVariant },
        ]}
      >
        <Card.Content style={styles.content}>
          {icon ? (
            <Icon
              name={icon}
              size={28}
              color={theme.colors.primary}
              style={styles.icon}
            />
          ) : null}
          <Text
            variant="titleMedium"
            style={[styles.title, { color: theme.colors.onSurface }]}
            numberOfLines={2}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              variant="bodySmall"
              style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
              numberOfLines={2}
            >
              {subtitle}
            </Text>
          ) : null}
        </Card.Content>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    flex: 1,
  },
  card: {
    borderRadius: spacing.lg,
    elevation: 0,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.xs,
  },
  icon: {
    marginBottom: spacing.xs,
  },
  title: {
    fontWeight: '500',
  },
  subtitle: {
    marginTop: spacing.xs / 2,
  },
});

export default TileCard;
