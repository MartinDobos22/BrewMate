import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme/useTheme';
import CoffeeBeanIcon from '../icons/CoffeeBeanIcon';
import CoffeeCupIcon from '../icons/CoffeeCupIcon';

export type RecentActivityIconKind = 'bean' | 'recipe';

export type RecentActivityEntry = {
  id: string;
  iconKind: RecentActivityIconKind;
  title: string;
  meta: string;
};

type Props = {
  entries: RecentActivityEntry[];
};

function RecentActivitySection({ entries }: Props) {
  const { colors, typescale, shape } = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrapper: {
          marginTop: 24,
        },
        sectionHeader: {
          marginBottom: 12,
        },
        sectionTitle: {
          ...typescale.titleLarge,
          color: colors.onBackground,
        },
        placeholder: {
          ...typescale.bodyMedium,
          color: colors.onSurfaceVariant,
        },
        listTile: {
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: shape.medium,
          backgroundColor: colors.surfaceContainerLow,
          paddingHorizontal: 14,
          paddingVertical: 12,
          marginBottom: 8,
        },
        iconWrap: {
          width: 36,
          height: 36,
          borderRadius: 12,
          backgroundColor: colors.surfaceContainerLowest,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        },
        listTextWrap: {
          flex: 1,
        },
        listTitle: {
          ...typescale.titleSmall,
          color: colors.onSurface,
        },
        listMeta: {
          ...typescale.bodySmall,
          color: colors.onSurfaceVariant,
          marginTop: 2,
        },
      }),
    [colors, shape.medium, typescale],
  );

  return (
    <View style={styles.wrapper}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Posledná aktivita</Text>
      </View>
      {entries.length === 0 ? (
        <Text style={styles.placeholder}>
          Zatiaľ tu nič nie je. Začni skenom alebo pridaním zásoby.
        </Text>
      ) : (
        entries.map(item => (
          <View key={item.id} style={styles.listTile}>
            <View style={styles.iconWrap}>
              {item.iconKind === 'bean' ? (
                <CoffeeBeanIcon size={18} color={colors.primary} />
              ) : (
                <CoffeeCupIcon size={18} color={colors.primary} />
              )}
            </View>
            <View style={styles.listTextWrap}>
              <Text style={styles.listTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.listMeta} numberOfLines={1}>
                {item.meta}
              </Text>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

export default React.memo(RecentActivitySection);
