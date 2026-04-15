import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme/useTheme';
import { SparklesIcon } from '../icons';
import { Chip } from '../md3';

type PhotoAnalysis = {
  tasteProfile: string;
  flavorNotes: string[];
  roastLevel: string;
  recommendedBrewPath: string;
  confidence: number;
  summary: string;
};

type Props = {
  analysis: PhotoAnalysis;
};

const ROAST_LABELS: Record<string, string> = {
  light: 'Svetlé praženie',
  medium: 'Stredné praženie',
  'medium-dark': 'Stredne tmavé praženie',
  dark: 'Tmavé praženie',
};

function AnalysisResultCard({ analysis }: Props) {
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
        subsectionTitle: {
          ...typescale.labelLarge,
          color: colors.primary,
          marginTop: spacing.md,
          marginBottom: spacing.xs,
        },
        bodyText: {
          ...typescale.bodyMedium,
          color: colors.onSurface,
        },
        flavorRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.sm,
        },
        roastRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          marginTop: spacing.sm,
        },
      }),
    [colors, typescale, shape, elev, spacing],
  );

  const roastLabel = ROAST_LABELS[analysis.roastLevel] || analysis.roastLevel;

  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <SparklesIcon size={20} color={colors.primary} />
        <Text style={s.cardTitle}>Chuť kávy podľa AI</Text>
      </View>

      <View style={s.roastRow}>
        <Chip label={roastLabel} role="secondary" />
      </View>

      <Text style={s.subsectionTitle}>Chuťové tóny</Text>
      {analysis.flavorNotes.length > 0 ? (
        <View style={s.flavorRow}>
          {analysis.flavorNotes.map((note: string, i: number) => (
            <Chip key={i} label={note} role="tertiary" />
          ))}
        </View>
      ) : (
        <Text style={s.bodyText}>Neurčené</Text>
      )}

      <Text style={s.subsectionTitle}>Profil chuti</Text>
      <Text style={s.bodyText}>{analysis.tasteProfile}</Text>

      <Text style={s.subsectionTitle}>Krátke zhrnutie</Text>
      <Text style={s.bodyText}>{analysis.summary}</Text>

      <Text style={s.subsectionTitle}>Istota</Text>
      <Text style={s.bodyText}>{Math.round(analysis.confidence * 100)}%</Text>
    </View>
  );
}

export default React.memo(AnalysisResultCard);
