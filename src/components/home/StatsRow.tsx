import React, { ReactNode, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme/useTheme';
import CoffeeBeanIcon from '../icons/CoffeeBeanIcon';
import CoffeeCupIcon from '../icons/CoffeeCupIcon';
import FlameIcon from '../icons/FlameIcon';

type Props = {
  activeCoffeeCount: number;
  gramsAvailable: number;
  recipeCount: number;
};

type StatProps = {
  icon: ReactNode;
  value: string;
  label: string;
  styles: ReturnType<typeof createStyles>;
};

function Stat({ icon, value, label, styles }: StatProps) {
  return (
    <View style={styles.stat}>
      {icon}
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

function createStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  typescale: ReturnType<typeof useTheme>['typescale'],
  shapeMedium: number,
) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 16,
    },
    stat: {
      flex: 1,
      backgroundColor: colors.surfaceContainerLow,
      borderRadius: shapeMedium,
      padding: 14,
      alignItems: 'flex-start',
      gap: 8,
    },
    value: {
      ...typescale.headlineSmall,
      color: colors.onSurface,
    },
    label: {
      ...typescale.labelSmall,
      color: colors.onSurfaceVariant,
    },
  });
}

function StatsRow({ activeCoffeeCount, gramsAvailable, recipeCount }: Props) {
  const { colors, typescale, shape } = useTheme();

  const styles = useMemo(
    () => createStyles(colors, typescale, shape.medium),
    [colors, shape.medium, typescale],
  );

  return (
    <View style={styles.row}>
      <Stat
        styles={styles}
        icon={<CoffeeBeanIcon size={20} color={colors.primary} />}
        value={String(activeCoffeeCount)}
        label="Aktívne kávy"
      />
      <Stat
        styles={styles}
        icon={<FlameIcon size={20} color={colors.tertiary} />}
        value={`${gramsAvailable}g`}
        label="Zásoba"
      />
      <Stat
        styles={styles}
        icon={<CoffeeCupIcon size={20} color={colors.primary} />}
        value={String(recipeCount)}
        label="Recepty"
      />
    </View>
  );
}

export default React.memo(StatsRow);
