import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/types';
import {ensureCoffeeProfile} from '../utils/tasteVector';
import {apiFetch, DEFAULT_API_HOST} from '../utils/api';
import BottomNavBar from '../components/BottomNavBar';
import {useTheme} from '../theme/useTheme';
import {elevation} from '../theme/theme';
import {ScanIcon} from '../components/icons';
import {MD3Button} from '../components/md3';
import {BOTTOM_NAV_SAFE_PADDING} from '../constants/ui';
import {useImagePicker} from '../hooks/useImagePicker';

type Props = NativeStackScreenProps<RootStackParamList, 'CoffeeScanner'>;

function CoffeeScannerScreen({navigation}: Props) {
  const {colors, typescale, shape} = useTheme();
  const picker = useImagePicker();
  const [languageHints, setLanguageHints] = useState('sk, en');
  // Submit-path errors are tracked separately from picker errors so the
  // hook can stay focused on image acquisition.
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState(0);
  const [submitElapsedMs, setSubmitElapsedMs] = useState(0);
  const [submitStage, setSubmitStage] = useState<
    'idle' | 'upload' | 'ocr' | 'profile' | 'done'
  >('idle');
  const submitStartRef = useRef<number | null>(null);
  // Kept outside state so the Cancel button can abort the fetches without
  // triggering a re-render first.
  const submitAbortRef = useRef<AbortController | null>(null);

  const submitStageTarget = useMemo(
    () => ({
      upload: 25,
      ocr: 70,
      profile: 95,
      done: 100,
    }),
    [],
  );

  const languageHintList = useMemo(
    () =>
      languageHints
        .split(',')
        .map(hint => hint.trim())
        .filter(Boolean),
    [languageHints],
  );

  useEffect(() => {
    if (!isSubmitting) {
      submitStartRef.current = null;
      setSubmitProgress(0);
      setSubmitElapsedMs(0);
      setSubmitStage('idle');
      return;
    }

    if (!submitStartRef.current) {
      submitStartRef.current = Date.now();
    }

    const PROGRESS_TICK_MS = 500;
    const intervalId = setInterval(() => {
      const startedAt = submitStartRef.current ?? Date.now();
      const elapsed = Date.now() - startedAt;
      const target =
        submitStage === 'idle' ? 0 : submitStageTarget[submitStage];

      setSubmitElapsedMs(elapsed);
      setSubmitProgress(current => {
        if (current >= target) return current;
        const increment = target === 100 ? 15 : 5;
        return Math.min(target, current + increment);
      });
    }, PROGRESS_TICK_MS);

    return () => clearInterval(intervalId);
  }, [isSubmitting, submitStage, submitStageTarget]);

  const handleCancel = () => {
    const controller = submitAbortRef.current;
    if (!controller) return;
    console.log('[CoffeeScanner] User cancelled submit');
    controller.abort();
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

    const trimmedBase64 = picker.imageBase64.trim();
    if (!trimmedBase64) {
      setSubmitError('Najprv vyberte alebo odfoťte obrázok.');
      return;
    }

    const controller = new AbortController();
    submitAbortRef.current = controller;

    setSubmitError('');
    picker.clearError();
    setIsSubmitting(true);
    setSubmitStage('upload');
    setSubmitProgress(current => Math.max(current, 5));
    const submitStartedAt = Date.now();

    console.log('[CoffeeScanner] Submitting OCR request', {
      imageBase64Length: trimmedBase64.length,
      languageHintList,
      apiHost: DEFAULT_API_HOST,
    });
    console.log('[CoffeeScanner] OpenAI OCR correction request via backend', {
      endpoint: '/api/ocr-correct',
    });

    try {
      const ocrRequestStart = Date.now();
      setSubmitStage('ocr');
      const response = await apiFetch(
        `${DEFAULT_API_HOST}/api/ocr-correct`,
        {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          credentials: 'include',
          signal: controller.signal,
          body: JSON.stringify({
            imageBase64: trimmedBase64,
            languageHints: languageHintList,
          }),
        },
        {feature: 'CoffeeScanner', action: 'ocr-correct'},
      );

      console.log('[CoffeeScanner] OCR response received', {
        status: response.status,
        durationMs: Date.now() - ocrRequestStart,
      });

      const payload = await response.json().catch(parseError => {
        console.warn('[CoffeeScanner] Failed to parse OCR response', parseError);
        return null;
      });
      console.log('[CoffeeScanner] OCR response content', {payload});

      if (!response.ok) {
        const message = payload?.error || 'OCR request failed.';
        console.error('[CoffeeScanner] OCR request failed', {message, payload});
        setSubmitError(message);
        return;
      }

      if (
        !payload ||
        typeof payload.correctedText !== 'string' ||
        typeof payload.rawText !== 'string'
      ) {
        console.error('[CoffeeScanner] OCR response malformed', {payload});
        setSubmitError('Server vrátil neočakávanú OCR odpoveď.');
        return;
      }

      setSubmitStage('profile');
      const profileRequestStart = Date.now();
      console.log('[CoffeeScanner] OpenAI coffee profile request via backend', {
        endpoint: '/api/coffee-profile',
      });
      const profileResponse = await apiFetch(
        `${DEFAULT_API_HOST}/api/coffee-profile`,
        {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          credentials: 'include',
          signal: controller.signal,
          body: JSON.stringify({
            text: payload.correctedText,
            rawText: payload.rawText,
          }),
        },
        {feature: 'CoffeeScanner', action: 'coffee-profile'},
      );

      console.log('[CoffeeScanner] Coffee profile response received', {
        status: profileResponse.status,
        durationMs: Date.now() - profileRequestStart,
      });

      const profilePayload = await profileResponse.json().catch(parseError => {
        console.warn('[CoffeeScanner] Failed to parse profile response', parseError);
        return null;
      });
      console.log('[CoffeeScanner] Coffee profile response content', {
        payload: profilePayload,
      });

      if (!profileResponse.ok) {
        const message =
          profilePayload?.error || 'Coffee profile request failed.';
        console.error('[CoffeeScanner] Coffee profile request failed', {
          message,
          payload: profilePayload,
        });
        setSubmitError(message);
        return;
      }

      setSubmitStage('done');
      setSubmitProgress(100);
      console.log('[CoffeeScanner] OCR flow completed', {
        totalDurationMs: Date.now() - submitStartedAt,
      });

      const coffeeProfile = ensureCoffeeProfile(profilePayload?.profile);

      navigation.navigate('OcrResult', {
        rawText: payload.rawText,
        correctedText: payload.correctedText,
        coffeeProfile,
        labelImageBase64: trimmedBase64,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        console.log('[CoffeeScanner] Submit aborted by user');
        setSubmitError('Skenovanie bolo zrušené.');
        setSubmitStage('idle');
      } else {
        const message =
          error instanceof Error ? error.message : 'OCR request failed.';
        console.error('[CoffeeScanner] OCR request failed', error);
        setSubmitError(message);
      }
    } finally {
      if (submitAbortRef.current === controller) {
        submitAbortRef.current = null;
      }
      setIsSubmitting(false);
    }
  };

  const stageLabel = useMemo(() => {
    switch (submitStage) {
      case 'upload':
        return 'Nahrávam obrázok';
      case 'ocr':
        return 'Spracúvam OCR';
      case 'profile':
        return 'Tvorím chuťový profil';
      case 'done':
        return 'Hotovo';
      default:
        return 'Pripravujem požiadavku';
    }
  }, [submitStage]);

  const formatElapsed = (elapsedMs: number) => {
    const seconds = Math.max(0, elapsedMs) / 1000;
    return `${seconds.toFixed(1)} s`;
  };


  // ---------------------------------------------------------------------------
  // Styles
  // ---------------------------------------------------------------------------

  const s = useMemo(
    () =>
      StyleSheet.create({
        safeArea: {
          flex: 1,
          backgroundColor: colors.background,
        },
        flex: {flex: 1},
        container: {
          flex: 1,
          paddingHorizontal: 20,
          paddingVertical: 16,
          paddingBottom: BOTTOM_NAV_SAFE_PADDING + 24,
        },
        headerRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          marginBottom: 6,
        },
        overline: {
          ...typescale.labelMedium,
          letterSpacing: 1,
          textTransform: 'uppercase',
          color: colors.onSurfaceVariant,
        },
        title: {
          ...typescale.headlineMedium,
          color: colors.onBackground,
          marginBottom: 10,
        },
        description: {
          ...typescale.bodyMedium,
          lineHeight: 22,
          color: colors.onSurfaceVariant,
          marginBottom: 14,
        },
        sectionCard: {
          borderRadius: shape.extraLarge,
          padding: 16,
          marginBottom: 12,
          backgroundColor: colors.surfaceContainerLow,
          ...elevation.level1.shadow,
        },
        label: {
          ...typescale.labelLarge,
          marginBottom: 10,
          color: colors.onSurface,
        },
        buttonRow: {
          flexDirection: 'row',
          gap: 12,
        },
        helperText: {
          ...typescale.bodySmall,
          marginTop: 8,
          color: colors.onSurfaceVariant,
        },
        hintInput: {
          borderWidth: 1,
          borderColor: colors.outlineVariant,
          backgroundColor: colors.surfaceContainerLowest,
          borderRadius: shape.large,
          paddingVertical: 10,
          paddingHorizontal: 12,
          ...typescale.bodyMedium,
          color: colors.onSurface,
        },
        errorText: {
          ...typescale.bodySmall,
          color: colors.error,
          marginBottom: 12,
        },
        statusText: {
          ...typescale.labelLarge,
          color: colors.primary,
          marginBottom: 12,
        },
        submitButton: {
          backgroundColor: colors.primary,
          paddingVertical: 14,
          borderRadius: shape.full,
          alignItems: 'center',
        },
        submitButtonDisabled: {
          opacity: 0.7,
        },
        submitButtonText: {
          ...typescale.labelLarge,
          color: colors.onPrimary,
        },
        loadingContainer: {
          alignItems: 'stretch',
          alignSelf: 'stretch',
          gap: 6,
          paddingHorizontal: 16,
        },
        progressTrack: {
          height: 8,
          backgroundColor: colors.onPrimary,
          opacity: 0.3,
          borderRadius: shape.full,
          overflow: 'hidden',
        },
        progressFill: {
          height: '100%',
          backgroundColor: colors.onPrimary,
          borderRadius: shape.full,
        },
        loadingMetaRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
        },
        loadingText: {
          ...typescale.labelSmall,
          color: colors.onPrimary,
        },
        loadingStageText: {
          ...typescale.bodySmall,
          color: colors.onPrimary,
        },
      }),
    [colors, shape, typescale],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView style={s.safeArea} edges={['bottom']}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={s.container}
          keyboardShouldPersistTaps="handled">
          <View style={s.headerRow}>
            <ScanIcon size={22} color={colors.primary} />
            <Text style={s.overline}>BrewMate Scanner</Text>
          </View>
          <Text style={s.title}>Skenovanie kávy</Text>
          <Text style={s.description}>
            Odfoť etiketu alebo vyber fotku z galérie. Po skene dostaneš
            čitateľný text, chuťový profil a odporúčanie, či sa káva hodí k
            tvojmu dotazníku.
          </Text>

          <View style={s.sectionCard}>
            <Text style={s.label}>Obrázok etikety</Text>
            <View style={s.buttonRow}>
              <MD3Button
                label="Vybrať z galérie"
                variant="outlined"
                onPress={picker.pickFromGallery}
                disabled={picker.isPicking}
                style={{flex: 1}}
              />
              <MD3Button
                label="Odfotiť"
                variant="tonal"
                onPress={picker.takePhoto}
                disabled={picker.isPicking}
                style={{flex: 1}}
              />
            </View>
            <Text style={s.helperText}>
              {picker.imageUri
                ? 'Obrázok pripravený na odoslanie.'
                : 'Zatiaľ nie je vybraný žiadny obrázok.'}
            </Text>
          </View>

          <View style={s.sectionCard}>
            <Text style={s.label}>Jazyky na etikete (oddelené čiarkou)</Text>
            <TextInput
              style={s.hintInput}
              placeholder="sk, en"
              placeholderTextColor={colors.onSurfaceVariant}
              value={languageHints}
              onChangeText={setLanguageHints}
              autoCapitalize="none"
            />
          </View>

          {picker.isPicking ? (
            <Text style={s.statusText}>Načítavam obrázok…</Text>
          ) : null}

          {(submitError || picker.errorMessage) ? (
            <Text
              style={s.errorText}
              accessibilityRole="alert"
              accessibilityLiveRegion="polite">
              {submitError || picker.errorMessage}
            </Text>
          ) : null}

          <Pressable
            style={[s.submitButton, isSubmitting && s.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting || picker.isPicking}
            accessibilityRole="button"
            accessibilityLabel="Odoslať na OCR"
            accessibilityHint="Spustí rozpoznanie textu z fotky etikety"
            accessibilityState={{
              disabled: isSubmitting || picker.isPicking,
              busy: isSubmitting,
            }}>
            {isSubmitting ? (
              <View style={s.loadingContainer}>
                <View style={s.progressTrack}>
                  <View
                    style={[s.progressFill, {width: `${submitProgress}%`}]}
                  />
                </View>
                <View style={s.loadingMetaRow}>
                  <Text style={s.loadingText}>{submitProgress}%</Text>
                  <Text style={s.loadingText}>
                    Trvanie: {formatElapsed(submitElapsedMs)}
                  </Text>
                </View>
                <Text style={s.loadingStageText}>{stageLabel}</Text>
              </View>
            ) : (
              <Text style={s.submitButtonText}>Odoslať na OCR</Text>
            )}
          </Pressable>

          {isSubmitting ? (
            <MD3Button
              label="Zrušiť"
              variant="outlined"
              onPress={handleCancel}
              accessibilityLabel="Zrušiť skenovanie"
            />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
      <BottomNavBar />
    </SafeAreaView>
  );
}

export default CoffeeScannerScreen;
