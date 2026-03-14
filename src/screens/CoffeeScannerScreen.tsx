import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Asset,
  ImagePickerResponse,
  launchCamera,
  launchImageLibrary,
} from 'react-native-image-picker';
import {
  Text,
  Card,
  Button,
  TextInput,
  ProgressBar,
  useTheme,
} from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';
import { HomeStackParamList } from '../navigation/types';
import { ensureCoffeeProfile } from '../utils/tasteVector';
import { apiFetch, DEFAULT_API_HOST } from '../utils/api';
import spacing, { radii } from '../styles/spacing';

type Props = NativeStackScreenProps<HomeStackParamList, 'CoffeeScanner'>;

const PICKER_TIMEOUT_MS = 2000000;
const MAX_IMAGE_DIMENSION = 1600;
const IMAGE_QUALITY = 0.6;
const MAX_BASE64_BYTES = 2_000_000;

const estimateBase64Bytes = (base64: string) =>
  Math.ceil((base64.length * 3) / 4);

function CoffeeScannerScreen({ navigation }: Props) {
  const theme = useTheme<MD3Theme>();

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
        .map((hint) => hint.trim())
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

    const intervalId = setInterval(() => {
      const startedAt = submitStartRef.current ?? Date.now();
      const elapsed = Date.now() - startedAt;
      const target =
        submitStage === 'idle' ? 0 : submitStageTarget[submitStage];

      setSubmitElapsedMs(elapsed);
      setSubmitProgress((current) => {
        if (current >= target) {
          return current;
        }
        const increment = target === 100 ? 6 : 2;
        return Math.min(target, current + increment);
      });
    }, 200);

    return () => clearInterval(intervalId);
  }, [isSubmitting, submitStage, submitStageTarget]);

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    if (!imageBase64.trim()) {
      setErrorMessage('Najprv vyberte alebo odfoťte obrázok.');
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);
    setSubmitStage('upload');
    setSubmitProgress((current) => Math.max(current, 5));
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
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            imageBase64: imageBase64.trim(),
            languageHints: languageHintList,
          }),
        },
        {
          feature: 'CoffeeScanner',
          action: 'ocr-correct',
        },
      );

      console.log('[CoffeeScanner] OCR response received', {
        status: response.status,
        durationMs: Date.now() - ocrRequestStart,
      });

      const payload = await response.json();
      console.log('[CoffeeScanner] OCR response content', {
        payload,
      });

      if (!response.ok) {
        const message = payload?.error || 'OCR request failed.';
        console.error('[CoffeeScanner] OCR request failed', { message, payload });
        setErrorMessage(message);
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
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: payload.correctedText,
            rawText: payload.rawText,
          }),
        },
        {
          feature: 'CoffeeScanner',
          action: 'coffee-profile',
        },
      );

      console.log('[CoffeeScanner] Coffee profile response received', {
        status: profileResponse.status,
        durationMs: Date.now() - profileRequestStart,
      });

      const profilePayload = await profileResponse.json();
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

  const withPickerTimeout = async <T,>(promise: Promise<T>): Promise<T> =>
    Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        const timeoutId = setTimeout(() => {
          clearTimeout(timeoutId);
          reject(new Error('Image picker timed out.'));
        }, PICKER_TIMEOUT_MS);
      }),
    ]);

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

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      edges={['bottom']}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={[styles.scroll, { backgroundColor: theme.colors.background }]}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Text
              variant="headlineMedium"
              style={{ color: theme.colors.onSurface }}
            >
              Coffee Scanner
            </Text>
            <Text
              variant="bodyMedium"
              style={[styles.description, { color: theme.colors.onSurfaceVariant }]}
            >
              Vyberte alebo odfoťte obrázok etikety a odošlite ho na backend.
              Server použije Google Vision OCR a následne opraví text cez OpenAI
              API. Následne vráti odhad chuťového profilu bez hardcoded slovníkov.
            </Text>
          </View>

          {/* Image picker card */}
          <Card
            mode="contained"
            style={[styles.card, { backgroundColor: theme.colors.surfaceVariant }]}
          >
            <Card.Content style={styles.cardContent}>
              <Text
                variant="labelLarge"
                style={{ color: theme.colors.onSurfaceVariant, marginBottom: spacing.md }}
              >
                Obrázok etikety
              </Text>
              <View style={styles.buttonRow}>
                <Button
                  mode="outlined"
                  onPress={handleSelectFromGallery}
                  disabled={isPicking}
                  style={styles.halfButton}
                  contentStyle={styles.buttonContent}
                >
                  Vybrať z galérie
                </Button>
                <Button
                  mode="outlined"
                  onPress={handleTakePhoto}
                  disabled={isPicking}
                  style={styles.halfButton}
                  contentStyle={styles.buttonContent}
                >
                  Odfotiť
                </Button>
              </View>
              <View style={styles.imageStatusRow}>
                <View
                  style={[
                    styles.imageStatusDot,
                    {
                      backgroundColor: imageUri
                        ? theme.colors.secondary
                        : theme.colors.outlineVariant,
                    },
                  ]}
                />
                <Text
                  variant="bodyMedium"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {imageUri
                    ? 'Obrázok pripravený na odoslanie.'
                    : 'Zatiaľ nie je vybraný žiadny obrázok.'}
                </Text>
              </View>
            </Card.Content>
          </Card>

          {/* Language hints card */}
          <Card
            mode="contained"
            style={[styles.card, { backgroundColor: theme.colors.surfaceVariant }]}
          >
            <Card.Content style={styles.cardContent}>
              <Text
                variant="labelLarge"
                style={{ color: theme.colors.onSurfaceVariant, marginBottom: spacing.md }}
              >
                Language hints (oddelené čiarkou)
              </Text>
              <TextInput
                mode="outlined"
                placeholder="sk, en"
                value={languageHints}
                onChangeText={setLanguageHints}
                autoCapitalize="none"
                style={styles.textInput}
              />
            </Card.Content>
          </Card>

          {/* Status / error messages */}
          {isPicking ? (
            <Text
              variant="labelLarge"
              style={[styles.statusText, { color: theme.colors.primary }]}
            >
              Načítavam obrázok…
            </Text>
          ) : null}

          {errorMessage ? (
            <Text
              variant="bodyMedium"
              style={[styles.errorText, { color: theme.colors.error }]}
            >
              {errorMessage}
            </Text>
          ) : null}

          {/* Submit button */}
          {isSubmitting ? (
            <Card
              mode="contained"
              style={[styles.card, { backgroundColor: theme.colors.primary }]}
            >
              <Card.Content style={styles.cardContent}>
                <ProgressBar
                  progress={submitProgress / 100}
                  color={theme.colors.onPrimary}
                  style={[styles.progressBar, { backgroundColor: 'rgba(255,255,255,0.25)' }]}
                />
                <View style={styles.loadingMetaRow}>
                  <Text
                    variant="labelMedium"
                    style={{ color: theme.colors.onPrimary }}
                  >
                    {submitProgress}%
                  </Text>
                  <Text
                    variant="labelMedium"
                    style={{ color: theme.colors.onPrimary }}
                  >
                    Trvanie: {formatElapsed(submitElapsedMs)}
                  </Text>
                </View>
                <Text
                  variant="bodyMedium"
                  style={{ color: 'rgba(255,255,255,0.8)', textAlign: 'center' }}
                >
                  {stageLabel}
                </Text>
              </Card.Content>
            </Card>
          ) : (
            <Button
              mode="contained"
              onPress={handleSubmit}
              disabled={isPicking}
              style={styles.submitButton}
              contentStyle={styles.submitButtonContent}
            >
              Odoslať na OCR
            </Button>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  header: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  description: {
    lineHeight: 22,
  },
  card: {
    borderRadius: radii.lg,
  },
  cardContent: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  halfButton: {
    flex: 1,
    borderRadius: radii.md,
  },
  buttonContent: {
    paddingVertical: spacing.xs,
  },
  imageStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  imageStatusDot: {
    width: 8,
    height: 8,
    borderRadius: radii.full,
  },
  textInput: {
    borderRadius: radii.md,
  },
  statusText: {
    paddingHorizontal: spacing.xs,
  },
  errorText: {
    paddingHorizontal: spacing.xs,
  },
  progressBar: {
    height: 6,
    borderRadius: radii.full,
    marginBottom: spacing.sm,
  },
  loadingMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  submitButton: {
    marginTop: spacing.sm,
    borderRadius: radii.md,
  },
  submitButtonContent: {
    paddingVertical: spacing.sm,
  },
});

export default CoffeeScannerScreen;
