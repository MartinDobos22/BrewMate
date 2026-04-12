import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme/useTheme';
import { elevation } from '../../theme/theme';
import { PortafilterIcon, SparklesIcon, ArrowRightIcon } from '../icons';
import { Chip } from '../md3';
import type { HomeInventoryItem } from '../../hooks/useHomeDashboard';

type Props = {
  /** Currently active coffee — usually the most-recently opened. */
  highlightedCoffee: HomeInventoryItem | null;
  /** Optional match score (0–100) computed against the user's taste profile. */
  matchScore: number | null;
  /** Tier label corresponding to the match score (e.g. "Skvelá zhoda"). */
  matchTierLabel?: string;
  onPress: () => void;
};

/**
 * Hero card on the home page — recommends a brew based on the user's coffees
 * and taste profile. Falls back to an "explore" CTA when the user has no
 * profile or no active coffees yet.
 */
function BrewSuggestionCard({
  highlightedCoffee,
  matchScore,
  matchTierLabel,
  onPress,
}: Props) {
  const { colors, typescale, shape, stateLayer } = useTheme();

  const hasCoffee = highlightedCoffee !== null;
  const coffeeName =
    highlightedCoffee?.correctedText?.trim() ||
    highlightedCoffee?.rawText?.trim() ||
    'Tvoja vybraná káva';

  // Pick a brew method suggestion based on roast level (cheap heuristic).
  const suggestedMethod = useMemo(() => {
    const roast = highlightedCoffee?.coffeeProfile?.roastLevel?.toLowerCase() ?? '';
    if (roast.includes('light') || roast.includes('svet')) return 'V60';
    if (roast.includes('medium') || roast.includes('stred')) return 'AeroPress';
    if (roast.includes('dark') || roast.includes('tmav')) return 'Espresso';
    return 'V60';
  }, [highlightedCoffee?.coffeeProfile?.roastLevel]);

  const detailLine = useMemo(() => {
    if (!hasCoffee) return 'Vyplň dotazník a naskenuj kávu, ukážeme ti dnešný brew.';
    return `${suggestedMethod} • 1:16 • 92 °C`;
  }, [hasCoffee, suggestedMethod]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          backgroundColor: colors.primaryContainer,
          borderRadius: shape.extraLarge,
          padding: 20,
          ...elevation.level1.shadow,
          overflow: 'hidden',
        },
        topRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          marginBottom: 12,
        },
        iconWrap: {
          width: 48,
          height: 48,
          borderRadius: 16,
          backgroundColor: colors.surfaceContainerLowest,
          alignItems: 'center',
          justifyContent: 'center',
        },
        overline: {
          ...typescale.labelMedium,
          color: colors.onPrimaryContainer,
          opacity: 0.85,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
        },
        topRight: {
          flex: 1,
        },
        title: {
          ...typescale.titleLarge,
          color: colors.onPrimaryContainer,
          marginTop: 4,
        },
        detail: {
          ...typescale.bodyMedium,
          color: colors.onPrimaryContainer,
          opacity: 0.82,
          marginTop: 8,
        },
        bottomRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 16,
        },
        ctaWrap: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        },
        ctaLabel: {
          ...typescale.labelLarge,
          color: colors.onPrimaryContainer,
        },
        pressedOverlay: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: colors.onPrimaryContainer,
          opacity: stateLayer.pressed,
          borderRadius: shape.extraLarge,
        },
      }),
    [colors, shape.extraLarge, stateLayer.pressed, typescale],
  );

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Otvoriť dnešný brew"
      style={styles.root}>
      {({ pressed }) => (
        <>
          <View style={styles.topRow}>
            <View style={styles.iconWrap}>
              <PortafilterIcon size={26} color={colors.onPrimaryContainer} />
            </View>
            <View style={styles.topRight}>
              <Text style={styles.overline}>Dnešný brew</Text>
            </View>
            <SparklesIcon size={20} color={colors.onPrimaryContainer} />
          </View>

          <Text style={styles.title} numberOfLines={2}>
            {hasCoffee ? `${suggestedMethod} z ${coffeeName}` : 'Objav svoju ďalšiu obľúbenú'}
          </Text>
          <Text style={styles.detail}>{detailLine}</Text>

          <View style={styles.bottomRow}>
            {matchScore !== null ? (
              <Chip
                role="tertiary"
                label={`Zhoda ${matchScore}%${matchTierLabel ? ` · ${matchTierLabel}` : ''}`}
              />
            ) : (
              <View />
            )}
            <View style={styles.ctaWrap}>
              <Text style={styles.ctaLabel}>Pripraviť</Text>
              <ArrowRightIcon size={18} color={colors.onPrimaryContainer} />
            </View>
          </View>

          {pressed ? <View style={styles.pressedOverlay} /> : null}
        </>
      )}
    </Pressable>
  );
}

export default React.memo(BrewSuggestionCard);
