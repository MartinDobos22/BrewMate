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
import {
  Asset,
  ImagePickerResponse,
  launchCamera,
  launchImageLibrary,
} from 'react-native-image-picker';
import {RootStackParamList} from '../navigation/types';
import {ensureCoffeeProfile} from '../utils/tasteVector';
import {apiFetch, DEFAULT_API_HOST} from '../utils/api';
import BottomNavBar from '../components/BottomNavBar';
import {useTheme} from '../theme/useTheme';
import {elevation} from '../theme/theme';
import {ScanIcon} from '../components/icons';
import {MD3Button} from '../components/md3';
import {BOTTOM_NAV_SAFE_PADDING} from '../constants/ui';

type Props = NativeStackScreenProps<RootStackParamList, 'CoffeeScanner'>;

const PICKER_TIMEOUT_MS = 30_000;
const MAX_IMAGE_DIMENSION = 1600;
const IMAGE_QUALITY = 0.6;
const MAX_BASE64_BYTES = 2_000_000;

const estimateBase64Bytes = (base64: string) =>
  Math.ceil((base64.length * 3) / 4);

function CoffeeScannerScreen({navigation}: Props) {
  const {colors, typescale, shape} = useTheme();
  const [imageBase64, setImageBase64] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [languageHints, setLanguageHints] = useState('sk, en');
  const [errorMessage, setErrorMessage] = useState('');
  const [isPicking, setIsPicking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState(0);
  const [submitElapsedMs, setSubmitElapsedMs] = useState(0);
  const [submitStage, setSubmitStage] = useState<
    'idle' | 'upload' | 'ocr' | 'profile' | 'done'
  >('idle');
  const submitStartRef = useRef<number | null>(null);

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

  const handleSubmit = async () => {
    if (isSubmitting) return;

    if (!imageBase64.trim()) {
      setErrorMessage('Najprv vyberte alebo odfoťte obrázok.');
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);
    setSubmitStage('upload');
    setSubmitProgress(current => Math.max(current, 5));
    const submitStartedAt = Date.now();

    console.log('[CoffeeScanner] Submitting OCR request', {
      imageBase64Length: imageBase64.trim().length,
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
          body: JSON.stringify({
            imageBase64: imageBase64.trim(),
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
        setErrorMessage(message);
        return;
      }

      if (
        !payload ||
        typeof payload.correctedText !== 'string' ||
        typeof payload.rawText !== 'string'
      ) {
        console.error('[CoffeeScanner] OCR response malformed', {payload});
        setErrorMessage('Server vrátil neočakávanú OCR odpoveď.');
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
        setErrorMessage(message);
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
        labelImageBase64: imageBase64.trim(),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'OCR request failed.';
      console.error('[CoffeeScanner] OCR request failed', error);
      setErrorMessage(message);
    } finally {
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

  const handlePickerResponse = (response: ImagePickerResponse) => {
    console.log('[CoffeeScanner] Image picker response', {
      didCancel: response.didCancel,
      errorCode: response.errorCode,
      assetsCount: response.assets?.length,
    });

    if (response.didCancel) {
      setErrorMessage('Výber bol zrušený.');
      return;
    }

    if (response.errorCode) {
      setErrorMessage(
        response.errorMessage || 'Nastala chyba pri výbere obrázka.',
      );
      return;
    }

    const asset: Asset | undefined = response.assets?.[0];
    if (!asset?.base64) {
      console.warn('[CoffeeScanner] Missing base64 data in asset', {
        uri: asset?.uri,
        fileName: asset?.fileName,
        fileSize: asset?.fileSize,
        type: asset?.type,
      });
      setErrorMessage('Nepodarilo sa načítať obrázok. Skúste znova.');
      return;
    }

    const base64Length = asset.base64.length;
    const base64Bytes = estimateBase64Bytes(asset.base64);

    console.log('[CoffeeScanner] Prepared resized image payload', {
      base64Length,
      estimatedBytes: base64Bytes,
      fileSize: asset.fileSize,
      width: asset.width,
      height: asset.height,
    });

    if (base64Bytes > MAX_BASE64_BYTES) {
      setErrorMessage(
        'Obrázok je stále príliš veľký. Skúste prosím menší záber alebo orežte etiketu.',
      );
      return;
    }

    setErrorMessage('');
    setImageBase64(asset.base64);
    setImageUri(asset.uri ?? null);
  };

  const withPickerTimeout = async <T,>(promise: Promise<T>): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    try {
      return await Promise.race<T>([
        promise,
        new Promise<T>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error('Image picker timed out.'));
          }, PICKER_TIMEOUT_MS);
        }),
      ]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  };

  const handleSelectFromGallery = async () => {
    setIsPicking(true);
    try {
      console.log('[CoffeeScanner] Opening image library');
      const response = await withPickerTimeout(
        launchImageLibrary({
          mediaType: 'photo',
          includeBase64: true,
          quality: IMAGE_QUALITY,
          maxWidth: MAX_IMAGE_DIMENSION,
          maxHeight: MAX_IMAGE_DIMENSION,
        }),
      );
      handlePickerResponse(response);
    } catch (error) {
      console.error('[CoffeeScanner] Image library failed', error);
      setErrorMessage('Načítanie obrázka trvalo príliš dlho. Skúste znova.');
    } finally {
      setIsPicking(false);
    }
  };

  const handleTakePhoto = async () => {
    setIsPicking(true);
    try {
      console.log('[CoffeeScanner] Opening camera');
      const response = await withPickerTimeout(
        launchCamera({
          mediaType: 'photo',
          includeBase64: true,
          quality: IMAGE_QUALITY,
          maxWidth: MAX_IMAGE_DIMENSION,
          maxHeight: MAX_IMAGE_DIMENSION,
          saveToPhotos: true,
        }),
      );
      handlePickerResponse(response);
    } catch (error) {
      console.error('[CoffeeScanner] Camera capture failed', error);
      setErrorMessage('Načítanie fotky trvalo príliš dlho. Skúste znova.');
    } finally {
      setIsPicking(false);
    }
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
                onPress={handleSelectFromGallery}
                disabled={isPicking}
                style={{flex: 1}}
              />
              <MD3Button
                label="Odfotiť"
                variant="tonal"
                onPress={handleTakePhoto}
                disabled={isPicking}
                style={{flex: 1}}
              />
            </View>
            <Text style={s.helperText}>
              {imageUri
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

          {isPicking ? (
            <Text style={s.statusText}>Načítavam obrázok…</Text>
          ) : null}

          {errorMessage ? (
            <Text style={s.errorText}>{errorMessage}</Text>
          ) : null}

          <Pressable
            style={[s.submitButton, isSubmitting && s.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting || isPicking}>
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
        </ScrollView>
      </KeyboardAvoidingView>
      <BottomNavBar />
    </SafeAreaView>
  );
}

export default CoffeeScannerScreen;
