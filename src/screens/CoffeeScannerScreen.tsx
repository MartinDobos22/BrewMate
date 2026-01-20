import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
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

type Props = NativeStackScreenProps<RootStackParamList, 'CoffeeScanner'>;

const DEFAULT_API_HOST = Platform.select({
  android: 'http://10.0.2.2:3000',
  ios: 'http://localhost:3000',
  default: 'http://localhost:3000',
});

function CoffeeScannerScreen({ navigation }: Props) {
  const [imageBase64, setImageBase64] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [languageHints, setLanguageHints] = useState('sk, en');
  const [errorMessage, setErrorMessage] = useState('');
  const [isPicking, setIsPicking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const languageHintList = useMemo(
    () =>
      languageHints
        .split(',')
        .map((hint) => hint.trim())
        .filter(Boolean),
    [languageHints],
  );

  const handleSubmit = async () => {
    if (!imageBase64.trim()) {
      setErrorMessage('Najprv vyberte alebo odfoťte obrázok.');
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);

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

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || 'OCR request failed.');
      }

      navigation.navigate('OcrResult', {
        rawText: payload.rawText,
        correctedText: payload.correctedText,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'OCR request failed.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePickerResponse = (response: ImagePickerResponse) => {
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
      setErrorMessage('Nepodarilo sa načítať obrázok. Skúste znova.');
      return;
    }

    setErrorMessage('');
    setImageBase64(asset.base64);
    setImageUri(asset.uri ?? null);
  };

  const handleSelectFromGallery = async () => {
    setIsPicking(true);
    try {
      const response = await launchImageLibrary({
        mediaType: 'photo',
        includeBase64: true,
        quality: 0.9,
      });
      handlePickerResponse(response);
    } finally {
      setIsPicking(false);
    }
  };

  const handleTakePhoto = async () => {
    setIsPicking(true);
    try {
      const response = await launchCamera({
        mediaType: 'photo',
        includeBase64: true,
        quality: 0.9,
        saveToPhotos: true,
      });
      handlePickerResponse(response);
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
            API.
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
              <ActivityIndicator color="#ffffff" />
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
});

export default CoffeeScannerScreen;
