import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme/useTheme';
import { elevation } from '../../theme/theme';
import TasteProfileBars from '../TasteProfileBars';
import type { TasteVector } from '../../utils/tasteVector';
import { Chip, MD3Button } from '../md3';
import { SparklesIcon } from '../icons';

type Props = {
  vector: TasteVector;
  hasProfile: boolean;
  matchScore: number | null;
  matchTierLabel: string | null;
  onEdit: () => void;
};

function TasteProfileCard({
  vector,
  hasProfile,
  matchScore,
  matchTierLabel,
  onEdit,
}: Props) {
  const { colors, typescale, shape } = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          backgroundColor: colors.surfaceContainerLow,
          borderRadius: shape.large,
          padding: 18,
          marginTop: 16,
          ...elevation.level1.shadow,
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        },
        title: {
          ...typescale.titleLarge,
          color: colors.onSurface,
        },
        editLabel: {
          ...typescale.labelLarge,
          color: colors.primary,
        },
        emptyWrap: {
          gap: 12,
          paddingVertical: 8,
        },
        emptyText: {
          ...typescale.bodyMedium,
          color: colors.onSurfaceVariant,
        },
        matchRow: {
          marginTop: 14,
        },
      }),
    [colors, shape.large, typescale],
  );

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Tvoj chuťový profil</Text>
        <Pressable onPress={onEdit} accessibilityRole="button">
          <Text style={styles.editLabel}>Upraviť</Text>
        </Pressable>
      </View>

      {hasProfile ? (
        <>
          <TasteProfileBars vector={vector} />
          {matchScore !== null ? (
            <View style={styles.matchRow}>
              <Chip
                role="tertiary"
                label={`Zhoda ${matchScore}%${matchTierLabel ? ` · ${matchTierLabel}` : ''}`}
              />
            </View>
          ) : null}
        </>
      ) : (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>
            Vyplň krátky dotazník a začneme ti odporúčať kávy a recepty na mieru.
          </Text>
          <MD3Button
            label="Spustiť dotazník"
            variant="filled"
            icon={<SparklesIcon size={18} color={colors.onPrimary} />}
            onPress={onEdit}
          />
        </View>
      )}
    </View>
  );
}

export default React.memo(TasteProfileCard);
