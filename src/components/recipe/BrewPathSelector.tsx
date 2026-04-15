import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme/useTheme';
import { CoffeeCupIcon, PortafilterIcon } from '../icons';
import { Chip } from '../md3';

type BrewPath = 'espresso' | 'filter';

type Props = {
  recommendedBrewPath: 'espresso' | 'filter' | 'both';
  roastLevel: string;
  selectedPath: BrewPath | null;
  onSelect: (path: BrewPath) => void;
};

function BrewPathSelector({ recommendedBrewPath, selectedPath, onSelect }: Props) {
  const { colors, typescale, shape, elevation: elev, spacing } = useTheme();

  const s = useMemo(
    () =>
      StyleSheet.create({
        card: {
          backgroundColor: colors.surfaceContainerLow,
          borderRadius: shape.extraLarge,
          padding: spacing.lg,
          ...elev.level1.shadow,
        },
        cardHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          marginBottom: spacing.md,
        },
        cardTitle: {
          ...typescale.titleSmall,
          color: colors.onSurface,
        },
        pathRow: {
          flexDirection: 'row',
          gap: spacing.md,
        },
        pathCard: {
          flex: 1,
          borderWidth: 2,
          borderColor: colors.outlineVariant,
          backgroundColor: colors.surfaceContainerLowest,
          borderRadius: shape.large,
          padding: spacing.lg,
          alignItems: 'center',
          gap: spacing.sm,
        },
        pathCardActive: {
          borderColor: colors.primary,
          backgroundColor: colors.primaryContainer,
        },
        pathIcon: {
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: colors.surfaceContainerHigh,
          alignItems: 'center',
          justifyContent: 'center',
        },
        pathIconActive: {
          backgroundColor: colors.primary,
        },
        pathTitle: {
          ...typescale.titleMedium,
          color: colors.onSurface,
        },
        pathTitleActive: {
          color: colors.onPrimaryContainer,
        },
        pathDescription: {
          ...typescale.bodySmall,
          color: colors.onSurfaceVariant,
          textAlign: 'center',
        },
        pathDescriptionActive: {
          color: colors.onPrimaryContainer,
        },
        badgeRow: {
          marginTop: spacing.xs,
        },
      }),
    [colors, typescale, shape, elev, spacing],
  );

  const espressoRecommended = recommendedBrewPath === 'espresso' || recommendedBrewPath === 'both';
  const filterRecommended = recommendedBrewPath === 'filter' || recommendedBrewPath === 'both';

  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <CoffeeCupIcon size={20} color={colors.primary} />
        <Text style={s.cardTitle}>Ako chceš pripraviť túto kávu?</Text>
      </View>

      <View style={s.pathRow}>
        <Pressable
          style={[s.pathCard, selectedPath === 'espresso' && s.pathCardActive]}
          onPress={() => onSelect('espresso')}
        >
          <View style={[s.pathIcon, selectedPath === 'espresso' && s.pathIconActive]}>
            <PortafilterIcon
              size={24}
              color={selectedPath === 'espresso' ? colors.onPrimary : colors.onSurfaceVariant}
            />
          </View>
          <Text style={[s.pathTitle, selectedPath === 'espresso' && s.pathTitleActive]}>
            Espresso
          </Text>
          <Text style={[s.pathDescription, selectedPath === 'espresso' && s.pathDescriptionActive]}>
            Espresso, latte, cappuccino a ďalšie
          </Text>
          {espressoRecommended ? (
            <View style={s.badgeRow}>
              <Chip label="Odporúčané" role="primary" />
            </View>
          ) : null}
        </Pressable>

        <Pressable
          style={[s.pathCard, selectedPath === 'filter' && s.pathCardActive]}
          onPress={() => onSelect('filter')}
        >
          <View style={[s.pathIcon, selectedPath === 'filter' && s.pathIconActive]}>
            <CoffeeCupIcon
              size={24}
              color={selectedPath === 'filter' ? colors.onPrimary : colors.onSurfaceVariant}
            />
          </View>
          <Text style={[s.pathTitle, selectedPath === 'filter' && s.pathTitleActive]}>
            Filter
          </Text>
          <Text style={[s.pathDescription, selectedPath === 'filter' && s.pathDescriptionActive]}>
            V60, AeroPress, French Press a ďalšie
          </Text>
          {filterRecommended ? (
            <View style={s.badgeRow}>
              <Chip label="Odporúčané" role="primary" />
            </View>
          ) : null}
        </Pressable>
      </View>
    </View>
  );
}

export default React.memo(BrewPathSelector);
