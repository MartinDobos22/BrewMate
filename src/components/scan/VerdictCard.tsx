import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme/useTheme';
import { Chip } from '../md3';
import {
  CoffeeProfile,
  MATCH_TIER_COLORS,
  MATCH_TIER_LABELS,
} from '../../utils/tasteVector';
import { MatchResult } from '../../hooks/useCoffeeMatch';
import type { FeedbackState } from '../../hooks/useMatchFeedback';

type Props = {
  matchResult: MatchResult;
  coffeeProfile: CoffeeProfile;
  scanId: string | null;
  ratingValue: number | null;
  ratingState: FeedbackState;
  ratingError: string;
  onSubmitRating: (rating: number) => void;
  questionnaireSavedAt: string | null;
};

// Confidence / source badge for the current profile. Returns null when the
// profile is fully label-sourced with healthy confidence.
const deriveConfidenceBadge = (
  profile: CoffeeProfile,
): { label: string; role: 'error' | 'tertiary' } | null => {
  if (profile.confidence < 0.5) {
    return { label: 'Odhadnuté z obmedzených údajov', role: 'error' };
  }
  switch (profile.source) {
    case 'low_info':
      return { label: 'Etiketa mala málo údajov', role: 'error' };
    case 'inferred':
      return { label: 'AI odhadla z obrázka', role: 'tertiary' };
    case 'mixed':
      return { label: 'Čiastočne overené', role: 'tertiary' };
    default:
      return null;
  }
};

function VerdictCardInner({
  matchResult,
  coffeeProfile,
  scanId,
  ratingValue,
  ratingState,
  ratingError,
  onSubmitRating,
  questionnaireSavedAt,
}: Props) {
  const { colors, typescale, shape, spacing } = useTheme();

  const verdictLabel = MATCH_TIER_LABELS[matchResult.matchTier] || 'Neznáme hodnotenie';
  const tierColors =
    MATCH_TIER_COLORS[matchResult.matchTier] || MATCH_TIER_COLORS.worth_trying;
  const confidenceBadge = deriveConfidenceBadge(coffeeProfile);

  const s = useMemo(
    () =>
      StyleSheet.create({
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
        verdictBadge: {
          borderRadius: shape.large,
          padding: spacing.md,
          marginBottom: spacing.md,
          borderWidth: 1,
          backgroundColor: tierColors.bg,
          borderColor: tierColors.border,
        },
        verdictText: {
          ...typescale.titleMedium,
          color: colors.onSurface,
        },
        confidenceBadgeWrap: {
          marginTop: spacing.sm,
        },
        scoreRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: spacing.xs + 2,
        },
        scoreText: {
          ...typescale.labelLarge,
          color: colors.onSurface,
        },
        verdictSubText: {
          ...typescale.bodySmall,
          color: colors.onSurfaceVariant,
        },
        scoreBarBackground: {
          height: 6,
          borderRadius: 3,
          backgroundColor: colors.outlineVariant,
          marginTop: spacing.sm,
          overflow: 'hidden',
        },
        scoreBarFill: {
          height: 6,
          borderRadius: 3,
          width: `${Math.round(matchResult.matchScore)}%`,
          backgroundColor: tierColors.border,
        },
        ratingBlock: {
          marginTop: spacing.md,
        },
        ratingTitle: {
          ...typescale.labelLarge,
          color: colors.primary,
          marginBottom: spacing.xs,
        },
        ratingRow: {
          flexDirection: 'row',
          gap: spacing.sm,
        },
        ratingStarButton: {
          paddingHorizontal: spacing.xs + 2,
          paddingVertical: spacing.xs,
        },
        ratingStarText: {
          fontSize: 28,
          color: colors.primary,
        },
        ratingHint: {
          ...typescale.bodySmall,
          color: colors.onSurfaceVariant,
          marginTop: spacing.xs + 2,
        },
        ratingError: {
          ...typescale.bodySmall,
          color: colors.error,
          marginTop: spacing.xs + 2,
        },
        adventureNoteBlock: {
          backgroundColor: colors.secondaryContainer,
          borderRadius: shape.medium,
          padding: spacing.md,
          marginBottom: spacing.sm,
        },
        adventureTitle: {
          ...typescale.labelLarge,
          color: colors.primary,
          marginBottom: spacing.xs,
        },
        helperNote: {
          ...typescale.bodySmall,
          color: colors.onSurfaceVariant,
          marginTop: spacing.md,
        },
      }),
    [colors, typescale, shape, spacing, tierColors.bg, tierColors.border, matchResult.matchScore],
  );

  const ratingDisabled = !scanId || ratingState === 'submitting' || ratingState === 'saved';

  return (
    <>
      <View style={s.verdictBadge}>
        <Text style={s.verdictText}>{verdictLabel}</Text>
        {confidenceBadge ? (
          <View style={s.confidenceBadgeWrap}>
            <Chip label={confidenceBadge.label} role={confidenceBadge.role} />
          </View>
        ) : null}
        <View style={s.scoreRow}>
          <Text style={s.scoreText}>Zhoda: {Math.round(matchResult.matchScore)}%</Text>
          <Text style={s.verdictSubText}>
            Istota: {Math.round(matchResult.confidence * 100)}%
          </Text>
        </View>
        <View style={s.scoreBarBackground}>
          <View style={s.scoreBarFill} />
        </View>
      </View>
      <View style={s.ratingBlock}>
        <Text style={s.ratingTitle}>Ako ti káva v skutočnosti chutila?</Text>
        <View style={s.ratingRow}>
          {[1, 2, 3, 4, 5].map(n => {
            const filled = ratingValue !== null && n <= ratingValue;
            return (
              <Pressable
                key={n}
                onPress={() => onSubmitRating(n)}
                disabled={ratingDisabled}
                style={s.ratingStarButton}
                accessibilityLabel={`Hodnotenie ${n} z 5`}
              >
                <Text style={s.ratingStarText}>{filled ? '★' : '☆'}</Text>
              </Pressable>
            );
          })}
        </View>
        {ratingState === 'saved' ? (
          <Text style={s.ratingHint}>Ďakujeme za spätnú väzbu.</Text>
        ) : null}
        {ratingState === 'submitting' ? (
          <Text style={s.ratingHint}>Ukladám hodnotenie…</Text>
        ) : null}
        {ratingState === 'error' ? <Text style={s.ratingError}>{ratingError}</Text> : null}
        {!scanId && ratingState === 'idle' ? (
          <Text style={s.ratingHint}>Hodnotenie bude dostupné po uložení skenu.</Text>
        ) : null}
      </View>
      {matchResult.adventureNote ? (
        <View style={s.adventureNoteBlock}>
          <Text style={s.adventureTitle}>Prečo to skúsiť</Text>
          <Text style={s.bodyText}>{matchResult.adventureNote}</Text>
        </View>
      ) : null}
      <Text style={s.subsectionTitle}>Pre laika</Text>
      <Text style={s.bodyText}>{matchResult.laymanSummary}</Text>
      <Text style={s.subsectionTitle}>Pre baristu</Text>
      <Text style={s.bodyText}>{matchResult.baristaSummary}</Text>
      <Text style={s.subsectionTitle}>Kľúčové zhody</Text>
      <Text style={s.bodyText}>
        {matchResult.keyMatches.length
          ? matchResult.keyMatches.join(', ')
          : 'Žiadne výrazné zhody.'}
      </Text>
      {matchResult.keyConflicts.length > 0 ? (
        <>
          <Text style={s.subsectionTitle}>Potenciálne konflikty</Text>
          <Text style={s.bodyText}>{matchResult.keyConflicts.join(', ')}</Text>
        </>
      ) : null}
      <Text style={s.subsectionTitle}>Ako si ju upraviť</Text>
      <Text style={s.bodyText}>{matchResult.suggestedAdjustments}</Text>
      {questionnaireSavedAt ? (
        <Text style={s.helperNote}>
          Porovnávané s posledným uloženým dotazníkom z{' '}
          {new Date(questionnaireSavedAt).toLocaleDateString('sk-SK')}.
        </Text>
      ) : null}
    </>
  );
}

export default React.memo(VerdictCardInner);
