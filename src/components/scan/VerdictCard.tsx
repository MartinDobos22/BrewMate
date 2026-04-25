import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme/useTheme';
import { Chip } from '../md3';
import {
  CoffeeProfile,
  MATCH_TIER_COLORS,
  MATCH_TIER_LABELS,
} from '../../utils/tasteVector';
import { MatchBreakdownAxis, MatchResult } from '../../hooks/useCoffeeMatch';
import type { FeedbackState } from '../../hooks/useMatchFeedback';

type Props = {
  matchResult: MatchResult;
  coffeeProfile: CoffeeProfile;
  scanId: string | null;
  ratingValue: number | null;
  ratingState: FeedbackState;
  ratingError: string;
  ratingSavedAt: string | null;
  onSubmitRating: (rating: number) => void;
  questionnaireSavedAt: string | null;
};

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

const formatTimeAgo = (iso: string | null): string => {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return '';
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'pred chvíľou';
  if (minutes < 60) return `pred ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `pred ${hours} h`;
  const days = Math.floor(hours / 24);
  return `pred ${days} d`;
};

function VerdictCardInner({
  matchResult,
  coffeeProfile,
  scanId,
  ratingValue,
  ratingState,
  ratingError,
  ratingSavedAt,
  onSubmitRating,
  questionnaireSavedAt,
}: Props) {
  const { colors, typescale, shape, spacing } = useTheme();
  const [breakdownExpanded, setBreakdownExpanded] = useState(false);

  const verdictLabel = MATCH_TIER_LABELS[matchResult.matchTier] || 'Neznáme hodnotenie';
  const tierColors =
    MATCH_TIER_COLORS[matchResult.matchTier] || MATCH_TIER_COLORS.worth_trying;
  const confidenceBadge = deriveConfidenceBadge(coffeeProfile);
  const axes: MatchBreakdownAxis[] = matchResult.breakdown?.axes ?? [];
  const hasBreakdown = axes.length > 0;

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
        breakdownToggle: {
          ...typescale.labelMedium,
          color: colors.primary,
          marginTop: spacing.sm,
        },
        breakdownBlock: {
          marginTop: spacing.sm,
          gap: spacing.sm,
        },
        axisRow: {
          gap: spacing.xs,
        },
        axisHeaderRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'baseline',
        },
        axisLabel: {
          ...typescale.labelMedium,
          color: colors.onSurface,
        },
        axisMeta: {
          ...typescale.bodySmall,
          color: colors.onSurfaceVariant,
        },
        axisBarTrack: {
          position: 'relative',
          height: 12,
          backgroundColor: colors.outlineVariant,
          borderRadius: 6,
          overflow: 'hidden',
        },
        axisCoffeeDot: {
          position: 'absolute',
          top: 0,
          width: 4,
          height: 12,
          backgroundColor: colors.primary,
          borderRadius: 2,
        },
        axisUserDot: {
          position: 'absolute',
          top: 0,
          width: 4,
          height: 12,
          backgroundColor: colors.tertiary,
          borderRadius: 2,
        },
        axisStatusMatch: {
          color: colors.primary,
          fontWeight: '600',
        },
        axisStatusConflict: {
          color: colors.error,
          fontWeight: '600',
        },
        axisStatusNeutral: {
          color: colors.onSurfaceVariant,
        },
        legendRow: {
          flexDirection: 'row',
          gap: spacing.md,
          marginTop: spacing.xs,
        },
        legendDot: {
          width: 10,
          height: 10,
          borderRadius: 2,
        },
        legendUserDot: {
          backgroundColor: colors.tertiary,
        },
        legendCoffeeDot: {
          backgroundColor: colors.primary,
        },
        legendItem: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
        },
        legendText: {
          ...typescale.bodySmall,
          color: colors.onSurfaceVariant,
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

  // Stars remain tappable after save so the user can correct a misclick; the
  // only lock is while a request is in flight.
  const ratingDisabled = !scanId || ratingState === 'submitting';

  const ratingHint =
    ratingState === 'submitting'
      ? 'Ukladám hodnotenie…'
      : ratingState === 'saved'
      ? `Uložené${ratingValue ? ` (${ratingValue}★)` : ''} · ${formatTimeAgo(ratingSavedAt) || 'teraz'} · klikni na iný počet hviezd pre zmenu.`
      : !scanId && ratingState === 'idle'
      ? 'Hodnotenie bude dostupné po uložení skenu.'
      : null;

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

        {hasBreakdown ? (
          <>
            <Pressable
              onPress={() => setBreakdownExpanded(prev => !prev)}
              accessibilityRole="button"
              accessibilityLabel={
                breakdownExpanded ? 'Skryť detail chuťových osí' : 'Zobraziť prečo'
              }
              accessibilityState={{ expanded: breakdownExpanded }}
              hitSlop={8}
            >
              <Text style={s.breakdownToggle}>
                {breakdownExpanded ? 'Skryť detail ▲' : 'Prečo tento verdikt? ▼'}
              </Text>
            </Pressable>
            {breakdownExpanded ? (
              <View style={s.breakdownBlock}>
                <View style={s.legendRow}>
                  <View style={s.legendItem}>
                    <View style={[s.legendDot, s.legendUserDot]} />
                    <Text style={s.legendText}>Ty</Text>
                  </View>
                  <View style={s.legendItem}>
                    <View style={[s.legendDot, s.legendCoffeeDot]} />
                    <Text style={s.legendText}>Táto káva</Text>
                  </View>
                </View>
                {axes.map(axis => (
                  <View key={axis.axis} style={s.axisRow}>
                    <View style={s.axisHeaderRow}>
                      <Text style={s.axisLabel}>{axis.label}</Text>
                      <Text
                        style={[
                          s.axisMeta,
                          axis.status === 'match'
                            ? s.axisStatusMatch
                            : axis.status === 'conflict'
                            ? s.axisStatusConflict
                            : s.axisStatusNeutral,
                        ]}
                      >
                        {axis.status === 'match'
                          ? 'sedí'
                          : axis.status === 'conflict'
                          ? 'rozdiel'
                          : 'neutrálne'}
                        {` · rozdiel ${Math.abs(Math.round(axis.diff))}`}
                      </Text>
                    </View>
                    <View style={s.axisBarTrack}>
                      <View
                        style={[
                          s.axisUserDot,
                          { left: `${Math.max(0, Math.min(100, axis.userValue))}%` },
                        ]}
                      />
                      <View
                        style={[
                          s.axisCoffeeDot,
                          { left: `${Math.max(0, Math.min(100, axis.coffeeValue))}%` },
                        ]}
                      />
                    </View>
                    <Text style={s.axisMeta}>
                      Tolerancia: {axis.tolerance}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        ) : null}
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
                accessibilityRole="button"
                accessibilityLabel={`Hodnotenie ${n} z 5`}
                accessibilityState={{
                  selected: filled,
                  disabled: ratingDisabled,
                }}
                hitSlop={12}
              >
                <Text style={s.ratingStarText}>{filled ? '★' : '☆'}</Text>
              </Pressable>
            );
          })}
        </View>
        {ratingHint ? <Text style={s.ratingHint}>{ratingHint}</Text> : null}
        {ratingState === 'error' ? <Text style={s.ratingError}>{ratingError}</Text> : null}
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
