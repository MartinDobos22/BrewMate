import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../../theme/useTheme';
import { Tile } from '../md3';
import { CoffeeBeanIcon, CoffeeCupIcon, ScanIcon, SparklesIcon } from '../icons';

type Props = {
  activeCount: number;
  recipeCount: number;
  onPressInventory: () => void;
  onPressScan: () => void;
  onPressRecipes: () => void;
  onPressGenerate: () => void;
};

/**
 * Bento-style quick actions grid. Two columns: the left column stacks two
 * square neutral tiles (Inventár, Recepty); the right column hosts one tall
 * accent tile (Skenovať). A wide accent tile spans both columns underneath
 * (Generovať recept).
 */
function BentoQuickActions({
  activeCount,
  recipeCount,
  onPressInventory,
  onPressScan,
  onPressRecipes,
  onPressGenerate,
}: Props) {
  const { colors } = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: 'row',
          gap: 12,
        },
        leftColumn: {
          flex: 1,
          gap: 12,
        },
        rightColumn: {
          flex: 1,
        },
        wideTile: {
          marginTop: 12,
        },
      }),
    [],
  );

  const inventorySubtitle = `${activeCount} ${activeCount === 1 ? 'káva' : activeCount >= 2 && activeCount <= 4 ? 'kávy' : 'káv'}`;
  const recipeSubtitle = `${recipeCount} ${recipeCount === 1 ? 'recept' : recipeCount >= 2 && recipeCount <= 4 ? 'recepty' : 'receptov'}`;

  return (
    <View>
      <View style={styles.row}>
        <View style={styles.leftColumn}>
          <Tile
            title="Inventár"
            subtitle={inventorySubtitle}
            role="neutral"
            icon={<CoffeeBeanIcon size={22} color={colors.primary} />}
            onPress={onPressInventory}
            accessibilityLabel="Otvoriť inventár"
          />
          <Tile
            title="Recepty"
            subtitle={recipeSubtitle}
            role="neutral"
            icon={<CoffeeCupIcon size={22} color={colors.primary} />}
            onPress={onPressRecipes}
            accessibilityLabel="Otvoriť obľúbené recepty"
          />
        </View>
        <View style={styles.rightColumn}>
          <Tile
            title="Skenovať kávu"
            subtitle="Naskenuj etiketu a doplň profil"
            role="secondary"
            minHeight={220}
            icon={<ScanIcon size={26} color={colors.onSecondaryContainer} />}
            onPress={onPressScan}
            accessibilityLabel="Naskenovať novú kávu"
          />
        </View>
      </View>
      <Tile
        title="Generuj AI recept"
        subtitle="Z fotky vašej kávy navrhnem prípravu"
        role="tertiary"
        minHeight={104}
        style={styles.wideTile}
        icon={<SparklesIcon size={26} color={colors.onTertiaryContainer} />}
        onPress={onPressGenerate}
        accessibilityLabel="Generovať recept z fotky"
      />
    </View>
  );
}

export default React.memo(BentoQuickActions);
