import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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

type Props = NativeStackScreenProps<RootStackParamList, 'CoffeePhotoRecipe'>;

type PhotoPreparation = {
  method: string;
  description: string;
};

type PhotoAnalysis = {
  tasteProfile: string;
  flavorNotes: string[];
  recommendedPreparations: PhotoPreparation[];
  confidence: number;
  summary: string;
};

const PICKER_TIMEOUT_MS = 2000000;
const MAX_IMAGE_DIMENSION = 1600;
const IMAGE_QUALITY = 0.6;
const MAX_BASE64_BYTES = 2_000_000;

const estimateBase64Bytes = (base64: string) =>
  Math.ceil((base64.length * 3) / 4);

function CoffeePhotoRecipeScreen({ navigation }: Props) {
  const [imageBase64, setImageBase64] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<PhotoAnalysis | null>(null);
  const [selectedPreparation, setSelectedPreparation] = useState<string | null>(null);
  const [strengthPreference, setStrengthPreference] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isPicking, setIsPicking] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const strengthOptions = useMemo(
    () => ['jemné chute', 'slabšie', 'výraznejšie'],
    [],
  );

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

    const base64Bytes = estimateBase64Bytes(asset.base64);
    if (base64Bytes > MAX_BASE64_BYTES) {
      setErrorMessage(
        'Obrázok je stále príliš veľký. Skúste menší záber alebo iný súbor.',
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
      console.error('[PhotoRecipe] Image library failed', error);
      setErrorMessage('Načítanie obrázka trvalo príliš dlho. Skúste znova.');
    } finally {
      setIsPicking(false);
    }
  };

  const handleTakePhoto = async () => {
    setIsPicking(true);
    try {
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
      console.error('[PhotoRecipe] Camera capture failed', error);
      setErrorMessage('Načítanie fotky trvalo príliš dlho. Skúste znova.');
    } finally {
      setIsPicking(false);
    }
  };

  const handleAnalyze = async () => {
    if (isAnalyzing) {
      return;
    }

    if (!imageBase64.trim()) {
      setErrorMessage('Najprv vyberte alebo odfoťte obrázok.');
      return;
    }

    setErrorMessage('');
    setIsAnalyzing(true);
    setAnalysis(null);
    setSelectedPreparation(null);
    setStrengthPreference(null);

    try {
      console.log('[PhotoRecipe] OpenAI photo analysis request via backend', {
        endpoint: '/api/coffee-photo-analysis',
      });
      const response = await fetch(`${DEFAULT_API_HOST}/api/coffee-photo-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64: imageBase64.trim(),
          languageHints: ['sk', 'en'],
        }),
      });

      const payload = await response.json();
      console.log('[PhotoRecipe] OpenAI photo analysis response content', {
        payload,
      });

      if (!response.ok) {
        throw new Error(payload?.error || 'Analýza fotky zlyhala.');
      }

      setAnalysis(payload.analysis);
      const firstMethod = payload.analysis?.recommendedPreparations?.[0]?.method;
      setSelectedPreparation(firstMethod ?? null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Analýza fotky zlyhala.';
      console.error('[PhotoRecipe] Analysis failed', error);
      setErrorMessage(message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerateRecipe = async () => {
    if (isGenerating) {
      return;
    }

    if (!analysis) {
      setErrorMessage('Najprv analyzujte fotku.');
      return;
    }

    if (!selectedPreparation) {
      setErrorMessage('Vyberte spôsob prípravy.');
      return;
    }

    if (!strengthPreference) {
      setErrorMessage('Vyberte preferovanú silu kávy.');
      return;
    }

    setErrorMessage('');
    setIsGenerating(true);

    try {
      console.log('[PhotoRecipe] OpenAI photo recipe request via backend', {
        endpoint: '/api/coffee-photo-recipe',
      });
      const response = await fetch(`${DEFAULT_API_HOST}/api/coffee-photo-recipe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          analysis,
          selectedPreparation,
          strengthPreference,
        }),
      });

      const payload = await response.json();
      console.log('[PhotoRecipe] OpenAI photo recipe response content', {
        payload,
      });

      if (!response.ok) {
        throw new Error(payload?.error || 'Generovanie receptu zlyhalo.');
      }

      navigation.navigate('CoffeePhotoRecipeResult', {
        analysis,
        selectedPreparation,
        strengthPreference,
        recipe: payload.recipe,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Generovanie receptu zlyhalo.';
      console.error('[PhotoRecipe] Recipe generation failed', error);
      setErrorMessage(message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Foto recept</Text>
        <Text style={styles.description}>
          Nahrajte fotku kávy, nechajte AI odhadnúť chuť a vyberte si najlepší
          spôsob prípravy.
        </Text>

        <View style={styles.block}>
          <Text style={styles.label}>Fotografia kávy</Text>
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
            {imageUri ? 'Fotka je pripravená.' : 'Zatiaľ nie je vybraná žiadna fotka.'}
          </Text>
        </View>

        <Pressable
          style={[styles.primaryButton, (isAnalyzing || isPicking) && styles.buttonDisabled]}
          onPress={handleAnalyze}
          disabled={isAnalyzing || isPicking}
        >
          <Text style={styles.primaryButtonText}>
            {isAnalyzing ? 'Analyzujem fotku…' : 'Analyzovať fotku'}
          </Text>
        </Pressable>

        {analysis ? (
          <>
            <View style={styles.block}>
              <Text style={styles.label}>Chuť kávy podľa AI</Text>
              <Text style={styles.profileTitle}>Chuťové tóny</Text>
              <Text style={styles.text}>
                {analysis.flavorNotes.length > 0
                  ? analysis.flavorNotes.join(', ')
                  : 'Neurčené'}
              </Text>
              <Text style={styles.profileTitle}>Profil chuti</Text>
              <Text style={styles.text}>{analysis.tasteProfile}</Text>
              <Text style={styles.profileTitle}>Krátke zhrnutie</Text>
              <Text style={styles.text}>{analysis.summary}</Text>
              <Text style={styles.profileTitle}>Istota</Text>
              <Text style={styles.text}>
                {Math.round(analysis.confidence * 100)}%
              </Text>
            </View>

            <View style={styles.block}>
              <Text style={styles.label}>Najvhodnejšia príprava</Text>
              {analysis.recommendedPreparations.map((prep) => (
                <Pressable
                  key={prep.method}
                  style={[
                    styles.optionCard,
                    selectedPreparation === prep.method && styles.optionCardActive,
                  ]}
                  onPress={() => setSelectedPreparation(prep.method)}
                >
                  <Text style={styles.optionTitle}>{prep.method}</Text>
                  <Text style={styles.optionText}>{prep.description}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.block}>
              <Text style={styles.label}>
                Aké chute chceš: jemné chute, slabšie alebo výraznejšie?
              </Text>
              <View style={styles.radioGroup}>
                {strengthOptions.map((option) => (
                  <Pressable
                    key={option}
                    style={styles.radioRow}
                    onPress={() => setStrengthPreference(option)}
                  >
                    <View
                      style={[
                        styles.radioOuter,
                        strengthPreference === option && styles.radioOuterActive,
                      ]}
                    >
                      {strengthPreference === option ? (
                        <View style={styles.radioInner} />
                      ) : null}
                    </View>
                    <Text style={styles.radioLabel}>{option}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <Pressable
              style={[styles.primaryButton, isGenerating && styles.buttonDisabled]}
              onPress={handleGenerateRecipe}
              disabled={isGenerating}
            >
              <Text style={styles.primaryButtonText}>
                {isGenerating ? 'Generujem recept…' : 'Generovať recept'}
              </Text>
            </Pressable>
          </>
        ) : null}

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flexGrow: 1,
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
  block: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  helperText: {
    marginTop: 8,
    fontSize: 12,
    color: '#6b6b6b',
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
  primaryButton: {
    backgroundColor: '#1f6f5b',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  errorText: {
    color: '#b00020',
    marginTop: 8,
  },
  profileTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
  },
  text: {
    fontSize: 14,
    color: '#1f2933',
    marginTop: 4,
  },
  optionCard: {
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  optionCardActive: {
    borderColor: '#1f6f5b',
    backgroundColor: '#ecf5f2',
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  optionText: {
    fontSize: 13,
    color: '#4a4a4a',
  },
  radioGroup: {
    gap: 10,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#1f6f5b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterActive: {
    borderColor: '#1f6f5b',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1f6f5b',
  },
  radioLabel: {
    fontSize: 14,
    color: '#1f2933',
  },
});

export default CoffeePhotoRecipeScreen;
