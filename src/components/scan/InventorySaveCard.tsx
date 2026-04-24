import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme/useTheme';
import { CoffeeBeanIcon } from '../icons';
import { MD3Button } from '../md3';
import { apiFetch, DEFAULT_API_HOST } from '../../utils/api';
import { CoffeeProfile } from '../../utils/tasteVector';
import { MatchResult } from '../../hooks/useCoffeeMatch';

type Props = {
  authenticated: boolean;
  rawText: string;
  correctedText: string;
  coffeeProfile: CoffeeProfile;
  matchResult: MatchResult | null;
  labelImageBase64: string;
};

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const PACKAGE_OPTIONS = ['', '250', '500', '1000'];
const REMAINING_OPTIONS = ['', '50', '100', '150', '200'];

function InventorySaveCardInner({
  authenticated,
  rawText,
  correctedText,
  coffeeProfile,
  matchResult,
  labelImageBase64,
}: Props) {
  const { colors, typescale, shape, elevation, spacing } = useTheme();
  const [showDetails, setShowDetails] = useState(false);
  const [packageSizeG, setPackageSizeG] = useState('');
  const [remainingG, setRemainingG] = useState('');
  const [state, setState] = useState<SaveState>('idle');
  const [error, setError] = useState('');

  const onSave = useCallback(async () => {
    if (!authenticated) {
      setState('error');
      setError('Najprv sa prihlás.');
      return;
    }

    try {
      setState('saving');
      setError('');
      const response = await apiFetch(
        `${DEFAULT_API_HOST}/api/user-coffee`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            rawText,
            correctedText,
            labelImageBase64,
            coffeeProfile,
            aiMatchResult: matchResult,
            packageSizeG:
              packageSizeG.trim().length > 0 ? Number.parseInt(packageSizeG, 10) : null,
            remainingG:
              remainingG.trim().length > 0 ? Number.parseInt(remainingG, 10) : null,
            trackingMode:
              remainingG.trim().length > 0 || packageSizeG.trim().length > 0
                ? 'manual'
                : 'estimated',
          }),
        },
        { feature: 'OcrResult', action: 'save-user-coffee' },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error || 'Nepodarilo sa uložiť kávu do inventára.');
        setState('error');
        return;
      }
      setState('saved');
      setShowDetails(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepodarilo sa uložiť kávu do inventára.');
      setState('error');
    }
  }, [
    authenticated,
    coffeeProfile,
    correctedText,
    labelImageBase64,
    matchResult,
    packageSizeG,
    rawText,
    remainingG,
  ]);

  const s = useMemo(
    () =>
      StyleSheet.create({
        card: {
          backgroundColor: colors.surfaceContainerLow,
          borderRadius: shape.extraLarge,
          padding: spacing.lg,
          ...elevation.level1.shadow,
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
        bodyText: {
          ...typescale.bodyMedium,
          color: colors.onSurface,
        },
        subsectionTitle: {
          ...typescale.labelLarge,
          color: colors.primary,
          marginTop: spacing.md,
          marginBottom: spacing.xs,
        },
        packageOptionsRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.sm,
          marginBottom: spacing.sm,
        },
        packageOption: {
          borderWidth: 1,
          borderColor: colors.outlineVariant,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          borderRadius: shape.full,
          backgroundColor: colors.surfaceContainerLowest,
        },
        packageOptionActive: {
          borderColor: colors.tertiary,
          backgroundColor: colors.tertiaryContainer,
        },
        packageOptionText: {
          ...typescale.labelSmall,
          color: colors.onSurfaceVariant,
        },
        packageOptionTextActive: {
          color: colors.onTertiaryContainer,
        },
        remainingInputWrap: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs + 2,
          marginBottom: spacing.sm,
        },
        remainingPrefix: {
          ...typescale.bodySmall,
          color: colors.onSurfaceVariant,
        },
        remainingValue: {
          ...typescale.labelMedium,
          color: colors.onSurface,
        },
        openButton: {
          marginTop: spacing.md,
        },
        saveButton: {
          backgroundColor: colors.tertiary,
          marginTop: spacing.md,
        },
        helperNote: {
          ...typescale.bodySmall,
          color: colors.onSurfaceVariant,
          marginTop: spacing.md,
        },
        saveHint: {
          ...typescale.bodySmall,
          color: colors.tertiary,
          fontWeight: '600',
          marginTop: spacing.sm,
        },
        saveError: {
          ...typescale.bodySmall,
          color: colors.error,
          fontWeight: '600',
          marginTop: spacing.sm,
        },
      }),
    [colors, typescale, shape, elevation, spacing],
  );

  const renderChip = (
    value: string,
    active: boolean,
    onPress: () => void,
    labelIfEmpty: string,
  ) => (
    <Pressable
      key={value || labelIfEmpty}
      style={[s.packageOption, active && s.packageOptionActive]}
      onPress={onPress}
    >
      <Text style={[s.packageOptionText, active && s.packageOptionTextActive]}>
        {value ? `${value} g` : 'nechať prázdne'}
      </Text>
    </Pressable>
  );

  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <CoffeeBeanIcon size={20} color={colors.primary} />
        <Text style={s.cardTitle}>Inventár</Text>
      </View>
      <Text style={s.bodyText}>
        Ak si túto kávu nekúpil, nič nemusíš vypĺňať. Inventár je len voliteľný.
      </Text>
      {!showDetails ? (
        <MD3Button
          label="Kúpil som ju, pridať do inventára"
          variant="tonal"
          onPress={() => {
            setState('idle');
            setError('');
            setShowDetails(true);
          }}
          style={s.openButton}
        />
      ) : null}
      {showDetails ? (
        <>
          <Text style={s.subsectionTitle}>Veľkosť balíka (voliteľné)</Text>
          <View style={s.packageOptionsRow}>
            {PACKAGE_OPTIONS.map(value =>
              renderChip(value, packageSizeG === value, () => setPackageSizeG(value), 'empty'),
            )}
          </View>
          <Text style={s.subsectionTitle}>Zostáva teraz (voliteľné)</Text>
          <View style={s.remainingInputWrap}>
            <Text style={s.remainingPrefix}>g</Text>
            <Text style={s.remainingValue}>
              {remainingG.trim().length > 0 ? remainingG : 'nevyplnené'}
            </Text>
          </View>
          <View style={s.packageOptionsRow}>
            {REMAINING_OPTIONS.map(value =>
              renderChip(value, remainingG === value, () => setRemainingG(value), 'none'),
            )}
          </View>
          <MD3Button
            label={state === 'saving' ? 'Ukladám...' : 'Uložiť do inventára'}
            onPress={onSave}
            disabled={state === 'saving' || !authenticated}
            loading={state === 'saving'}
            style={s.saveButton}
          />
        </>
      ) : null}
      {!authenticated ? (
        <Text style={s.helperNote}>Pre uloženie do inventára sa musíš prihlásiť.</Text>
      ) : null}
      {state === 'saved' ? <Text style={s.saveHint}>Káva uložená v inventári.</Text> : null}
      {state === 'error' ? <Text style={s.saveError}>{error}</Text> : null}
    </View>
  );
}

export default React.memo(InventorySaveCardInner);
