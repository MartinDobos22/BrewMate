import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../navigation/types';
import { apiFetch, DEFAULT_API_HOST } from '../utils/api';
import BottomNavBar from '../components/BottomNavBar';
import { useTheme } from '../theme/useTheme';
import { CoffeeBeanIcon } from '../components/icons';
import { Chip } from '../components/md3';
import {
  CoffeeProfile,
  ensureCoffeeProfile,
  MATCH_TIER_LABELS,
  MatchTier,
} from '../utils/tasteVector';
import { BOTTOM_NAV_SAFE_PADDING } from '../constants/ui';

type Props = NativeStackScreenProps<RootStackParamList, 'RecentScans'>;

type ScanItem = {
  id: string;
  rawText: string | null;
  correctedText: string | null;
  coffeeProfile: CoffeeProfile;
  aiMatchResult: {
    matchScore?: number;
    matchTier?: MatchTier;
  } | null;
  createdAt: string;
};

const parseScanItem = (raw: unknown): ScanItem | null => {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const candidate = raw as Record<string, unknown>;
  if (typeof candidate.id !== 'string') {
    return null;
  }
  return {
    id: candidate.id,
    rawText: typeof candidate.rawText === 'string' ? candidate.rawText : null,
    correctedText:
      typeof candidate.correctedText === 'string' ? candidate.correctedText : null,
    coffeeProfile: ensureCoffeeProfile(candidate.coffeeProfile),
    aiMatchResult:
      candidate.aiMatchResult && typeof candidate.aiMatchResult === 'object'
        ? (candidate.aiMatchResult as ScanItem['aiMatchResult'])
        : null,
    createdAt:
      typeof candidate.createdAt === 'string' ? candidate.createdAt : new Date().toISOString(),
  };
};

function RecentScansScreen({ navigation }: Props) {
  const { colors, typescale, shape, spacing, elevation } = useTheme();
  const [items, setItems] = useState<ScanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadScans = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await apiFetch(
        `${DEFAULT_API_HOST}/api/coffee-scans?limit=50`,
        { method: 'GET', credentials: 'include' },
        { feature: 'RecentScans', action: 'load' },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || 'Nepodarilo sa načítať históriu skenov.');
      }
      const parsed = Array.isArray(payload?.items)
        ? (payload.items as unknown[]).map(parseScanItem).filter(Boolean) as ScanItem[]
        : [];
      setItems(parsed);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Nepodarilo sa načítať históriu skenov.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadScans();
    return navigation.addListener('focus', loadScans);
  }, [loadScans, navigation]);

  const handleOpen = useCallback(
    (item: ScanItem) => {
      navigation.navigate('OcrResult', {
        rawText: item.rawText ?? '',
        correctedText: item.correctedText ?? '',
        coffeeProfile: item.coffeeProfile,
        labelImageBase64: '',
      });
    },
    [navigation],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safeArea: {
          flex: 1,
          backgroundColor: colors.background,
        },
        container: {
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.lg,
          paddingBottom: BOTTOM_NAV_SAFE_PADDING,
          gap: spacing.md,
        },
        headerRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
        },
        title: {
          ...typescale.headlineMedium,
          color: colors.onSurface,
        },
        subtitle: {
          ...typescale.bodyMedium,
          color: colors.onSurfaceVariant,
        },
        card: {
          backgroundColor: colors.surfaceContainerLow,
          borderRadius: shape.extraLarge,
          padding: spacing.lg,
          ...elevation.level1.shadow,
        },
        cardTitle: {
          ...typescale.titleSmall,
          color: colors.onSurface,
        },
        cardMeta: {
          ...typescale.bodySmall,
          color: colors.onSurfaceVariant,
          marginTop: spacing.xs,
        },
        chipRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.sm,
          marginTop: spacing.sm,
        },
        loadingRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          marginTop: spacing.md,
        },
        errorText: {
          ...typescale.bodyMedium,
          color: colors.error,
          fontWeight: '600',
        },
        empty: {
          ...typescale.bodyMedium,
          color: colors.onSurfaceVariant,
        },
      }),
    [colors, typescale, shape, spacing, elevation],
  );

  const formatDate = useCallback((iso: string) => {
    try {
      return new Date(iso).toLocaleString('sk-SK');
    } catch {
      return iso;
    }
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <CoffeeBeanIcon size={22} color={colors.primary} />
          <Text style={styles.title}>Posledné skeny</Text>
        </View>
        <Text style={styles.subtitle}>
          Všetky kávy, ktoré si oskenoval — aj tie, ktoré si nepridal do inventára.
        </Text>

        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.subtitle}>Načítavam skeny…</Text>
          </View>
        ) : null}

        {!loading && error ? <Text style={styles.errorText}>{error}</Text> : null}

        {!loading && !error && items.length === 0 ? (
          <Text style={styles.empty}>Zatiaľ nemáš žiadny sken.</Text>
        ) : null}

        {items.map(item => {
          const title = item.correctedText || item.rawText || 'Neznáma káva';
          const tier = item.aiMatchResult?.matchTier;
          const score = item.aiMatchResult?.matchScore;
          const tierLabel = tier ? (MATCH_TIER_LABELS[tier] ?? tier) : null;
          const a11yLabel = [
            title,
            formatDate(item.createdAt),
            tierLabel,
            typeof score === 'number' ? `${Math.round(score)} percent zhoda` : null,
          ]
            .filter(Boolean)
            .join(', ');
          return (
            <Pressable
              key={item.id}
              onPress={() => handleOpen(item)}
              style={styles.card}
              accessibilityRole="button"
              accessibilityLabel={a11yLabel}
              accessibilityHint="Otvorí detail skenu"
            >
              <Text style={styles.cardTitle}>{title}</Text>
              <Text style={styles.cardMeta}>{formatDate(item.createdAt)}</Text>
              {tier ? (
                <View style={styles.chipRow}>
                  <Chip label={tierLabel ?? ''} role="primary" />
                  {typeof score === 'number' ? (
                    <Chip label={`${Math.round(score)}% zhoda`} role="secondary" />
                  ) : null}
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
      <BottomNavBar />
    </SafeAreaView>
  );
}

export default RecentScansScreen;
