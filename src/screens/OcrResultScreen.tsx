import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../navigation/types';
import { saveCoffeeProfile } from '../utils/localSave';
import { useAuth } from '../context/AuthContext';
import BottomNavBar from '../components/BottomNavBar';
import { useTheme } from '../theme/useTheme';
import { ScanIcon, CoffeeBeanIcon, SparklesIcon } from '../components/icons';
import { MD3Button, Chip } from '../components/md3';
import { useCoffeeMatch } from '../hooks/useCoffeeMatch';
import { useAutoSaveScan } from '../hooks/useAutoSaveScan';
import { useMatchFeedback } from '../hooks/useMatchFeedback';
import VerdictCard from '../components/scan/VerdictCard';
import InventorySaveCard from '../components/scan/InventorySaveCard';
import {
  SCAN_WITHOUT_QUESTIONNAIRE_THRESHOLD,
  incrementScansWithoutQuestionnaire,
  resetScansWithoutQuestionnaire,
} from '../utils/scanCounter';

type Props = NativeStackScreenProps<RootStackParamList, 'OcrResult'>;

type LocalSaveState = 'idle' | 'saving' | 'saved' | 'error';

function OcrResultScreen({ route, navigation }: Props) {
  const { rawText, correctedText, coffeeProfile, labelImageBase64 } = route.params;
  const { user } = useAuth();

  const [saveState, setSaveState] = useState<LocalSaveState>('idle');
  const [scansWithoutQuestionnaire, setScansWithoutQuestionnaire] = useState(0);

  const match = useCoffeeMatch(coffeeProfile);
  const scanId = useAutoSaveScan({
    enabled: match.state === 'ready',
    rawText,
    correctedText,
    coffeeProfile,
    matchResult: match.result,
  });
  const feedback = useMatchFeedback(scanId, match.result);

  const handleSaveLocal = useCallback(async () => {
    try {
      setSaveState('saving');
      await saveCoffeeProfile({ rawText, correctedText, coffeeProfile });
      setSaveState('saved');
    } catch (error) {
      console.error('[OcrResult] Failed to save locally', error);
      setSaveState('error');
    }
  }, [coffeeProfile, correctedText, rawText]);

  const handleRescan = useCallback(() => {
    navigation.navigate('CoffeeScanner');
  }, [navigation]);

  // Sticky questionnaire reminder: bump the counter each time the match
  // machine settles on `missing`, reset it when a questionnaire is found.
  // Reacts to the match state so the user who finally fills the questionnaire
  // stops seeing escalated warnings.
  useEffect(() => {
    let cancelled = false;
    if (match.state === 'missing') {
      incrementScansWithoutQuestionnaire().then(n => {
        if (!cancelled) setScansWithoutQuestionnaire(n);
      });
    } else if (match.state === 'ready' && match.questionnaire) {
      resetScansWithoutQuestionnaire();
      setScansWithoutQuestionnaire(0);
    }
    return () => {
      cancelled = true;
    };
  }, [match.state, match.questionnaire]);

  const stickyMissingMessage = useMemo(() => {
    if (match.state !== 'missing') return null;
    if (scansWithoutQuestionnaire >= SCAN_WITHOUT_QUESTIONNAIRE_THRESHOLD) {
      return `Už ${scansWithoutQuestionnaire}. sken bez dotazníka — verdikty sú hrubé odhady. Vyplň ho za 2 minúty a ušetríš si sklamania.`;
    }
    return 'Aby som ti vedel povedať, či ti káva bude chutiť, najprv vyplň krátky chuťový dotazník. Zaberie ti to 2 minúty.';
  }, [match.state, scansWithoutQuestionnaire]);

  const { colors, typescale, shape, elevation: elev, spacing } = useTheme();

  const s = useMemo(
    () =>
      StyleSheet.create({
        safeArea: { flex: 1, backgroundColor: colors.background },
        container: {
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.lg,
          paddingBottom: 106,
          gap: spacing.md,
        },
        headerRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
        },
        overline: {
          ...typescale.labelMedium,
          color: colors.onSurfaceVariant,
          textTransform: 'uppercase',
        },
        title: {
          ...typescale.headlineMedium,
          color: colors.onSurface,
        },
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
        errorText: {
          ...typescale.bodyMedium,
          color: colors.error,
          fontWeight: '600',
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
        flavorRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.sm,
        },
        loadingRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
        },
        missingBlock: {
          gap: spacing.md,
        },
        stickyReminder: {
          backgroundColor: colors.errorContainer,
          borderRadius: shape.large,
          padding: spacing.md,
          borderWidth: 1,
          borderColor: colors.error,
        },
        stickyReminderText: {
          ...typescale.bodyMedium,
          color: colors.onErrorContainer,
          fontWeight: '600',
        },
      }),
    [colors, typescale, shape, elev, spacing],
  );

  return (
    <SafeAreaView style={s.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.container}>
        <View style={s.headerRow}>
          <ScanIcon size={20} color={colors.onSurfaceVariant} />
          <Text style={s.overline}>BrewMate Scanner</Text>
        </View>
        <Text style={s.title}>Výsledok skenovania kávy</Text>

        <View>
          <MD3Button
            label={saveState === 'saving' ? 'Ukladám...' : 'Uložiť lokálne'}
            onPress={handleSaveLocal}
            disabled={saveState === 'saving'}
            loading={saveState === 'saving'}
            accessibilityLabel="Uložiť výsledok skenu lokálne na zariadenie"
          />
          {saveState === 'saved' ? (
            <Text style={s.saveHint} accessibilityRole="alert">
              Uložené do zariadenia.
            </Text>
          ) : null}
          {saveState === 'error' ? (
            <Text style={s.saveError} accessibilityRole="alert">
              Uloženie zlyhalo.
            </Text>
          ) : null}
        </View>

        <MD3Button
          label="Naskenovať inú fotku"
          variant="outlined"
          onPress={handleRescan}
          accessibilityLabel="Naskenovať inú fotku"
          accessibilityHint="Vráti späť na skenovaciu obrazovku"
        />

        {match.state === 'missing'
        && scansWithoutQuestionnaire >= SCAN_WITHOUT_QUESTIONNAIRE_THRESHOLD ? (
          <View
            style={s.stickyReminder}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite">
            <Text style={s.stickyReminderText}>{stickyMissingMessage}</Text>
          </View>
        ) : null}

        <InventorySaveCard
          authenticated={Boolean(user)}
          rawText={rawText}
          correctedText={correctedText}
          coffeeProfile={coffeeProfile}
          matchResult={match.result}
          labelImageBase64={labelImageBase64}
        />

        <View style={s.card}>
          <View style={s.cardHeader}>
            <ScanIcon size={20} color={colors.primary} />
            <Text style={s.cardTitle}>Oskenovaný text</Text>
          </View>
          <Text style={s.bodyText}>{rawText}</Text>
        </View>

        <View style={s.card}>
          <View style={s.cardHeader}>
            <SparklesIcon size={20} color={colors.primary} />
            <Text style={s.cardTitle}>Opravený text</Text>
          </View>
          <Text style={s.bodyText}>{correctedText}</Text>
        </View>

        <View style={s.card}>
          <View style={s.cardHeader}>
            <CoffeeBeanIcon size={20} color={colors.primary} />
            <Text style={s.cardTitle}>Chuťový profil</Text>
          </View>

          <Text style={s.subsectionTitle}>Chuťové tóny</Text>
          {coffeeProfile.flavorNotes.length > 0 ? (
            <View style={s.flavorRow}>
              {coffeeProfile.flavorNotes.map((note, i) => (
                <Chip key={i} label={note} role="tertiary" />
              ))}
            </View>
          ) : (
            <Text style={s.bodyText}>Neurčené</Text>
          )}

          <Text style={s.subsectionTitle}>Profil chuti</Text>
          <Text style={s.bodyText}>{coffeeProfile.tasteProfile}</Text>
          <Text style={s.subsectionTitle}>Odborný popis</Text>
          <Text style={s.bodyText}>{coffeeProfile.expertSummary}</Text>
          <Text style={s.subsectionTitle}>Popis pre laika</Text>
          <Text style={s.bodyText}>{coffeeProfile.laymanSummary}</Text>
          <Text style={s.subsectionTitle}>Komu bude chutiť</Text>
          <Text style={s.bodyText}>{coffeeProfile.preferenceHint}</Text>
          <Text style={s.subsectionTitle}>Prečo tieto tóny</Text>
          <Text style={s.bodyText}>{coffeeProfile.reasoning}</Text>
          <Text style={s.subsectionTitle}>Istota</Text>
          <Text style={s.bodyText}>{Math.round(coffeeProfile.confidence * 100)}%</Text>
          {coffeeProfile.missingInfo?.length ? (
            <>
              <Text style={s.subsectionTitle}>Chýbajúce informácie</Text>
              <Text style={s.bodyText}>{coffeeProfile.missingInfo.join(', ')}</Text>
            </>
          ) : null}
        </View>

        <View style={s.card}>
          <View style={s.cardHeader}>
            <SparklesIcon size={20} color={colors.primary} />
            <Text style={s.cardTitle}>Zhoda s dotazníkom</Text>
          </View>

          {match.state === 'loading' ? (
            <View style={s.loadingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={s.bodyText}>Porovnávam s dotazníkom…</Text>
            </View>
          ) : null}
          {match.state === 'missing' ? (
            <View style={s.missingBlock}>
              <Text style={s.bodyText}>
                {stickyMissingMessage ||
                  'Aby som ti vedel povedať, či ti káva bude chutiť, najprv vyplň krátky chuťový dotazník. Zaberie ti to 2 minúty.'}
              </Text>
              <MD3Button
                label="Vyplniť dotazník"
                onPress={() => navigation.navigate('CoffeeQuestionnaire')}
              />
            </View>
          ) : null}
          {match.state === 'error' ? (
            <Text style={s.errorText}>{match.error}</Text>
          ) : null}
          {match.state === 'ready' && match.result ? (
            <VerdictCard
              matchResult={match.result}
              coffeeProfile={coffeeProfile}
              scanId={scanId}
              ratingValue={feedback.ratingValue}
              ratingState={feedback.state}
              ratingError={feedback.error}
              ratingSavedAt={feedback.lastSavedAt}
              onSubmitRating={feedback.submit}
              questionnaireSavedAt={match.questionnaire?.savedAt ?? null}
            />
          ) : null}
        </View>
      </ScrollView>
      <BottomNavBar />
    </SafeAreaView>
  );
}

export default OcrResultScreen;
