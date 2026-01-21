import React, { useEffect, useMemo, useState } from 'react';
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
import { DEFAULT_API_HOST } from '../utils/api';

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
      setSubmitProgress(0);
      setSubmitElapsedMs(0);
      return;
    }

    const startTime = Date.now();
    setSubmitProgress(0);
    setSubmitElapsedMs(0);

    const intervalId = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const estimatedDurationMs = 18000;
      const nextProgress = Math.min(
        95,
        Math.round((elapsed / estimatedDurationMs) * 100),
      );

      setSubmitElapsedMs(elapsed);
      setSubmitProgress((current) => Math.max(current, nextProgress));
    }, 250);

    return () => clearInterval(intervalId);
  }, [isSubmitting]);

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

    console.log('[CoffeeScanner] Submitting OCR request', {
      imageBase64Length: imageBase64.trim().length,
      languageHintList,
      apiHost: DEFAULT_API_HOST,
    });

    try {
      const response = await fetch(`${DEFAULT_API_HOST}/api/ocr-correct`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64: imageBase64.trim(),
          languageHints: languageHintList,
        }),
      });

      console.log('[CoffeeScanner] OCR response received', {
        status: response.status,
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || 'OCR request failed.');
      }

      const profileResponse = await fetch(`${DEFAULT_API_HOST}/api/coffee-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: payload.correctedText,
          rawText: payload.rawText,
        }),
      });

      const profilePayload = await profileResponse.json();

      if (!profileResponse.ok) {
        throw new Error(profilePayload?.error || 'Coffee profile request failed.');
      }

      navigation.navigate('OcrResult', {
        rawText: payload.rawText,
        correctedText: payload.correctedText,
        coffeeProfile: profilePayload.profile,
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
          <Text style={styles.title}>Coffee Scanner</Text>
          <Text style={styles.description}>
            Vyberte alebo odfoťte obrázok etikety a odošlite ho na backend.
            Server použije Google Vision OCR a následne opraví text cez OpenAI
            API. Následne vráti odhad chuťového profilu bez hardcoded slovníkov.
          </Text>

          <View style={styles.field}>
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
            <Text style={styles.helperText}>
              {imageUri
                ? 'Obrázok pripravený na odoslanie.'
                : 'Zatiaľ nie je vybraný žiadny obrázok.'}
            </Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Language hints (oddelené čiarkou)</Text>
            <TextInput
              style={styles.hintInput}
              placeholder="sk, en"
              placeholderTextColor="#8b8b8b"
              value={languageHints}
              onChangeText={setLanguageHints}
              autoCapitalize="none"
            />
          </View>

          {isPicking ? (
            <Text style={styles.statusText}>Načítavam obrázok…</Text>
          ) : null}

          {errorMessage ? (
            <Text style={styles.errorText}>{errorMessage}</Text>
          ) : null}

          <Pressable
            style={[styles.button, isSubmitting && styles.buttonDisabled]}
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
    backgroundColor: '#ffffff',
  },
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4a4a4a',
    marginBottom: 16,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#1f6f5b',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#1f6f5b',
    fontSize: 14,
    fontWeight: '600',
  },
  helperText: {
    marginTop: 8,
    fontSize: 12,
    color: '#6b6b6b',
  },
  hintInput: {
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#222222',
  },
  errorText: {
    color: '#b00020',
    marginBottom: 12,
  },
  statusText: {
    color: '#1f6f5b',
    marginBottom: 12,
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#1f6f5b',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'stretch',
    alignSelf: 'stretch',
    gap: 6,
  },
  progressTrack: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 999,
  },
  loadingMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default CoffeeScannerScreen;
