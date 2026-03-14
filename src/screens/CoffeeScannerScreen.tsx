import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Asset,
  ImagePickerResponse,
  launchCamera,
  launchImageLibrary,
} from 'react-native-image-picker';
import { RootStackParamList } from '../navigation/types';
import { ensureCoffeeProfile } from '../utils/tasteVector';
import { apiFetch, DEFAULT_API_HOST } from '../utils/api';

type Props = NativeStackScreenProps<RootStackParamList, 'CoffeeScanner'>;

const PICKER_TIMEOUT_MS = 2000000;
const MAX_IMAGE_DIMENSION = 1600;
const IMAGE_QUALITY = 0.6;
const MAX_BASE64_BYTES = 2_000_000;

const estimateBase64Bytes = (base64: string) =>
  Math.ceil((base64.length * 3) / 4);

function CoffeeScannerScreen({ navigation }: Props) {
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
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Coffee Scanner</Text>
            <Text style={styles.description}>
              Vyberte alebo odfoťte obrázok etikety a odošlite ho na backend.
              Server použije Google Vision OCR a následne opraví text cez OpenAI
              API. Následne vráti odhad chuťového profilu bez hardcoded slovníkov.
            </Text>
          </View>

          {/* Image picker card */}
          <View style={styles.card}>
            <Text style={styles.label}>Obrázok etikety</Text>
            <View style={styles.buttonRow}>
              <Pressable
                style={[styles.secondaryButton, isPicking && styles.buttonDisabled]}
                onPress={handleSelectFromGallery}
                disabled={isPicking}
              >
                <Text style={styles.secondaryButtonText}>Vybrať z galérie</Text>
              </Pressable>
              <Pressable
                style={[styles.secondaryButton, isPicking && styles.buttonDisabled]}
                onPress={handleTakePhoto}
                disabled={isPicking}
              >
                <Text style={styles.secondaryButtonText}>Odfotiť</Text>
              </Pressable>
            </View>
            <View style={styles.imageStatusRow}>
              <View
                style={[
                  styles.imageStatusDot,
                  imageUri ? styles.imageStatusDotReady : styles.imageStatusDotEmpty,
                ]}
              />
              <Text style={styles.helperText}>
                {imageUri
                  ? 'Obrázok pripravený na odoslanie.'
                  : 'Zatiaľ nie je vybraný žiadny obrázok.'}
              </Text>
            </View>
          </View>

          {/* Language hints card */}
          <View style={styles.card}>
            <Text style={styles.label}>Language hints (oddelené čiarkou)</Text>
            <TextInput
              style={styles.hintInput}
              placeholder="sk, en"
              placeholderTextColor="#999999"
              value={languageHints}
              onChangeText={setLanguageHints}
              autoCapitalize="none"
            />
          </View>

          {/* Status / error messages */}
          {isPicking ? (
            <Text style={styles.statusText}>Načítavam obrázok…</Text>
          ) : null}

          {errorMessage ? (
            <Text style={styles.errorText}>{errorMessage}</Text>
          ) : null}

          {/* Submit button */}
          <Pressable
            style={[styles.button, (isSubmitting || isPicking) && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting || isPicking}
          >
            {isSubmitting ? (
              <View style={styles.loadingContainer}>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${submitProgress}%` },
                    ]}
                  />
                </View>
                <View style={styles.loadingMetaRow}>
                  <Text style={styles.loadingText}>{submitProgress}%</Text>
                  <Text style={styles.loadingText}>
                    Trvanie: {formatElapsed(submitElapsedMs)}
                  </Text>
                </View>
                <Text style={styles.loadingStageText}>{stageLabel}</Text>
              </View>
            ) : (
              <Text style={styles.buttonText}>Odoslať na OCR</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  flex: {
    flex: 1,
  },
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: '#6B6B6B',
    fontWeight: '400',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B6B6B',
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#2C2C2C',
    fontSize: 15,
    fontWeight: '600',
  },
  imageStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  imageStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  imageStatusDotReady: {
    backgroundColor: '#4A9B6E',
  },
  imageStatusDotEmpty: {
    backgroundColor: '#E8E8E8',
  },
  helperText: {
    fontSize: 13,
    color: '#6B6B6B',
    fontWeight: '400',
  },
  hintInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#1A1A1A',
  },
  errorText: {
    color: '#D64545',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  statusText: {
    color: '#8B7355',
    marginBottom: 12,
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 4,
  },
  button: {
    backgroundColor: '#2C2C2C',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'stretch',
    alignSelf: 'stretch',
    gap: 6,
  },
  progressTrack: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
  },
  loadingMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  loadingStageText: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 12,
    fontWeight: '500',
  },
});

export default CoffeeScannerScreen;
