import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { HOME_ACTIVE_PREVIEW_LIMIT } from '../../constants/business';
import type { HomeInventoryItem } from '../../hooks/useHomeDashboard';

type Props = {
  activeItems: HomeInventoryItem[];
  emptyCount: number;
  gramsAvailable: number;
  lowStockItem: HomeInventoryItem | undefined;
  onOpenInventory: () => void;
};

function InventorySummarySection({
  activeItems,
  emptyCount,
  gramsAvailable,
  lowStockItem,
  onOpenInventory,
}: Props) {
  const preview = activeItems.slice(0, HOME_ACTIVE_PREVIEW_LIMIT);

  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Stav inventára</Text>
        <Pressable onPress={onOpenInventory}>
          <Text style={styles.textButton}>Doplniť inventár</Text>
        </Pressable>
      </View>

      <Text style={styles.summaryText}>
        Aktívne: {activeItems.length} • Dostupné: {gramsAvailable} g • Dopité: {emptyCount}
      </Text>

      {lowStockItem ? (
        <View style={styles.alertRow}>
          <Text style={styles.alertIcon}>⚠️</Text>
          <Text style={styles.alertText}>
            Dochádza {lowStockItem.correctedText || lowStockItem.rawText || 'káva'} ({lowStockItem.remainingG} g)
          </Text>
        </View>
      ) : (
        <Text style={styles.goodStateText}>Super, zatiaľ nemáš žiadnu nízku zásobu.</Text>
      )}

      {preview.length === 0 ? (
        <Text style={styles.placeholder}>
          Zatiaľ nemáš aktívne kávy. Pridaj prvý balík do inventára.
        </Text>
      ) : (
        preview.map(item => {
          const name = item.correctedText || item.rawText || 'Neznáma káva';
          const remaining = item.remainingG === null ? 'Neznáme' : `${item.remainingG} g`;
          return (
            <View key={item.id} style={styles.listTile}>
              <Text style={styles.listTileIcon}>🫘</Text>
              <View style={styles.listTextWrap}>
                <Text style={styles.listTitle}>{name}</Text>
                <Text style={styles.listMeta}>Zostáva: {remaining}</Text>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionCard: {
    borderRadius: 24,
    padding: 16,
    marginBottom: 14,
    backgroundColor: '#FFFBFF',
    borderWidth: 1,
    borderColor: '#E7DCD1',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 19,
    color: '#2C1F13',
    fontWeight: '700',
  },
  textButton: {
    color: '#71533D',
    fontWeight: '700',
    fontSize: 13,
  },
  summaryText: {
    marginBottom: 10,
    color: '#65584E',
    fontSize: 13,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF1E7',
    borderColor: '#F1D5BC',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  alertIcon: {
    marginRight: 8,
    fontSize: 14,
  },
  alertText: {
    color: '#7A4622',
    fontSize: 13,
    flex: 1,
  },
  goodStateText: {
    color: '#3A6A3D',
    backgroundColor: '#EAF6EA',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  placeholder: {
    color: '#6A5B50',
    fontSize: 14,
    lineHeight: 20,
  },
  listTile: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5D8CC',
    backgroundColor: '#FFF8F3',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  listTileIcon: {
    marginRight: 10,
    fontSize: 16,
  },
  listTextWrap: {
    flex: 1,
  },
  listTitle: {
    color: '#2C1F13',
    fontWeight: '600',
    fontSize: 14,
  },
  listMeta: {
    color: '#66584D',
    marginTop: 2,
    fontSize: 12,
  },
});

export default React.memo(InventorySummarySection);
