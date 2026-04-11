import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export type RecentActivityEntry = {
  id: string;
  icon: string;
  title: string;
  meta: string;
};

type Props = {
  entries: RecentActivityEntry[];
};

function RecentActivitySection({ entries }: Props) {
  return (
    <View style={styles.sectionCard}>
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
            <Text style={styles.listTileIcon}>{item.icon}</Text>
            <View style={styles.listTextWrap}>
              <Text style={styles.listTitle}>{item.title}</Text>
              <Text style={styles.listMeta}>{item.meta}</Text>
            </View>
          </View>
        ))
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

export default React.memo(RecentActivitySection);
