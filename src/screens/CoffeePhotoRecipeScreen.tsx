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
import { apiFetch, DEFAULT_API_HOST } from '../utils/api';

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

type InventoryCoffee = {
  id: string;
  rawText: string | null;
  correctedText: string | null;
  labelImageBase64: string | null;
  status: 'active' | 'empty' | 'archived';
};

const PICKER_TIMEOUT_MS = 2000000;
const MAX_IMAGE_DIMENSION = 1600;
const IMAGE_QUALITY = 0.6;
const MAX_BASE64_BYTES = 2_000_000;

const estimateBase64Bytes = (base64: string) =>
  Math.ceil((base64.length * 3) / 4);

const normalizeBase64 = (value: string) => value.replace(/^data:image\/\w+;base64,/, '').trim();

function CoffeePhotoRecipeScreen({ navigation }: Props) {
  const [imageBase64, setImageBase64] = useState('');
  const [analysis, setAnalysis] = useState<PhotoAnalysis | null>(null);
  const [selectedPreparation, setSelectedPreparation] = useState<string | null>(null);
  const [strengthPreference, setStrengthPreference] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [isPicking, setIsPicking] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<InventoryCoffee[]>([]);
  const [isInventoryVisible, setIsInventoryVisible] = useState(false);
  const [isInventoryLoading, setIsInventoryLoading] = useState(false);

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

    const normalizedImage = normalizeBase64(asset.base64);
    const base64Bytes = estimateBase64Bytes(normalizedImage);
    if (base64Bytes > MAX_BASE64_BYTES) {
      setErrorMessage(
        'Obrázok je stále príliš veľký. Skúste menší záber alebo iný súbor.',
      );
      return;
    }

    setErrorMessage('');
    setInfoMessage('');
    setImageBase64(normalizedImage);
    setIsInventoryVisible(false);
  };

  const loadInventory = async () => {
    if (isInventoryLoading) {
      return;
    }

    setIsInventoryLoading(true);
    setErrorMessage('');
    setInfoMessage('');

    try {
      const response = await apiFetch(
        `${DEFAULT_API_HOST}/api/user-coffee`,
        {
          method: 'GET',
          credentials: 'include',
        },
        {
          feature: 'PhotoRecipe',
          action: 'inventory-load',
        },
      );

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || 'Nepodarilo sa načítať inventár.');
      }

      const items = Array.isArray(payload?.items) ? payload.items : [];
      setInventoryItems(items.filter((item: InventoryCoffee) => item.status === 'active'));
      setIsInventoryVisible(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Nepodarilo sa načítať inventár.';
      setErrorMessage(message);
    } finally {
      setIsInventoryLoading(false);
    }
  };

  const handleSelectInventoryCoffee = (item: InventoryCoffee) => {
    if (!item.labelImageBase64) {
      setErrorMessage('Táto káva v inventári nemá uloženú fotku etikety.');
      return;
    }

    const normalizedImage = normalizeBase64(item.labelImageBase64);
    const base64Bytes = estimateBase64Bytes(normalizedImage);
    if (base64Bytes > MAX_BASE64_BYTES) {
      setErrorMessage('Fotka etikety tejto kávy je príliš veľká na analýzu.');
      return;
    }

    const coffeeName = item.correctedText || item.rawText || 'káva z inventára';
    setErrorMessage('');
    setInfoMessage(`Vybraná ${coffeeName}. Teraz môžeš spustiť analýzu.`);
    setImageBase64(normalizedImage);
    setIsInventoryVisible(false);
    setAnalysis(null);
    setSelectedPreparation(null);
    setStrengthPreference(null);
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
    setInfoMessage('');
    setIsAnalyzing(true);
    setAnalysis(null);
    setSelectedPreparation(null);
    setStrengthPreference(null);

    try {
      console.log('[PhotoRecipe] OpenAI photo analysis request via backend', {
        endpoint: '/api/coffee-photo-analysis',
      });
      const response = await apiFetch(
        `${DEFAULT_API_HOST}/api/coffee-photo-analysis`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            imageBase64: imageBase64.trim(),
            languageHints: ['sk', 'en'],
          }),
        },
        {
          feature: 'PhotoRecipe',
          action: 'analyze',
        },
      );

      const payload = await response.json();
      console.log('[PhotoRecipe] OpenAI photo analysis response content', {
        payload,
      });

      if (!response.ok) {
        const message = payload?.error || 'Analýza fotky zlyhala.';
        console.error('[PhotoRecipe] Analysis failed', { message, payload });
        setErrorMessage(message);
        return;
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
    setInfoMessage('');
    setIsGenerating(true);

    try {
      console.log('[PhotoRecipe] OpenAI photo recipe request via backend', {
        endpoint: '/api/coffee-photo-recipe',
      });
      const response = await apiFetch(
        `${DEFAULT_API_HOST}/api/coffee-photo-recipe`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            analysis,
            selectedPreparation,
            strengthPreference,
          }),
        },
        {
          feature: 'PhotoRecipe',
          action: 'generate',
        },
      );

      const payload = await response.json();
      console.log('[PhotoRecipe] OpenAI photo recipe response content', {
        payload,
      });

      if (!response.ok) {
        const message = payload?.error || 'Generovanie receptu zlyhalo.';
        console.error('[PhotoRecipe] Recipe generation failed', {
          message,
          payload,
        });
        setErrorMessage(message);
        return;
      }

      navigation.navigate('CoffeePhotoRecipeResult', {
        analysis,
        selectedPreparation,
        strengthPreference,
        recipe: payload.recipe,
        likePrediction: payload.likePrediction || {
          score: 50,
          verdict: 'Predikcia zatiaľ nie je dostupná.',
          reason: 'Skús recept upraviť podľa vlastnej chuti.',
        },
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
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Foto recept</Text>
          <Text style={styles.description}>
            Nahrajte fotku kávy, nechajte AI odhadnúť chuť a vyberte si najlepší
            spôsob prípravy.
          </Text>
        </View>

        {/* Photo Source Block */}
        <View style={styles.card}>
          <Text style={styles.label}>Fotografia kávy</Text>
          <View style={styles.buttonRow}>
            <Pressable
              style={[styles.outlineButton, styles.buttonRowItem, isPicking && styles.buttonDisabled]}
              onPress={handleSelectFromGallery}
              disabled={isPicking}
            >
              <Text style={styles.outlineButtonText}>Vybrať z galérie</Text>
            </Pressable>
            <Pressable
              style={[styles.outlineButton, styles.buttonRowItem, isPicking && styles.buttonDisabled]}
              onPress={handleTakePhoto}
              disabled={isPicking}
            >
              <Text style={styles.outlineButtonText}>Odfotiť</Text>
            </Pressable>
          </View>
          <Pressable
            style={[
              styles.outlineButton,
              styles.inventoryButton,
              (isInventoryLoading || isPicking) && styles.buttonDisabled,
            ]}
            onPress={loadInventory}
            disabled={isInventoryLoading || isPicking}
          >
            <Text style={styles.outlineButtonText}>
              {isInventoryLoading ? 'Načítavam inventár…' : 'Vybrať z inventára'}
            </Text>
          </Pressable>

          {isInventoryVisible ? (
            <View style={styles.inventoryList}>
              {inventoryItems.length > 0 ? (
                inventoryItems.map((item) => {
                  const coffeeName = item.correctedText || item.rawText || 'Neznáma káva';
                  const hasImage = Boolean(item.labelImageBase64);

                  return (
                    <Pressable
                      key={item.id}
                      style={[styles.inventoryItem, !hasImage && styles.buttonDisabled]}
                      onPress={() => handleSelectInventoryCoffee(item)}
                      disabled={!hasImage}
                    >
                      <Text style={styles.inventoryItemTitle}>{coffeeName}</Text>
                      <Text style={styles.inventoryItemMeta}>
                        {hasImage
                          ? 'Použiť fotku etikety z inventára'
                          : 'Bez fotky etikety'}
                      </Text>
                    </Pressable>
                  );
                })
              ) : (
                <Text style={styles.helperText}>V inventári nemáš žiadnu aktívnu kávu.</Text>
              )}
            </View>
          ) : null}

          <View style={styles.imageStatusRow}>
            <View style={[styles.imageStatusDot, imageBase64 ? styles.imageStatusDotActive : styles.imageStatusDotInactive]} />
            <Text style={styles.helperText}>
              {imageBase64
                ? 'Fotka je pripravená.'
                : 'Zatiaľ nie je vybraná žiadna fotka.'}
            </Text>
          </View>
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
            {/* AI Taste Profile */}
            <View style={styles.card}>
              <Text style={styles.label}>Chuť kávy podľa AI</Text>

              <View style={styles.profileRow}>
                <Text style={styles.profileTitle}>Chuťové tóny</Text>
                <Text style={styles.text}>
                  {analysis.flavorNotes.length > 0
                    ? analysis.flavorNotes.join(', ')
                    : 'Neurčené'}
                </Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.profileRow}>
                <Text style={styles.profileTitle}>Profil chuti</Text>
                <Text style={styles.text}>{analysis.tasteProfile}</Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.profileRow}>
                <Text style={styles.profileTitle}>Krátke zhrnutie</Text>
                <Text style={styles.text}>{analysis.summary}</Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.confidenceRow}>
                <Text style={styles.profileTitle}>Istota</Text>
                <View style={styles.confidenceBadge}>
                  <Text style={styles.confidenceBadgeText}>
                    {Math.round(analysis.confidence * 100)}%
                  </Text>
                </View>
              </View>
            </View>

            {/* Preparation Methods */}
            <View style={styles.card}>
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
                  <Text
                    style={[
                      styles.optionTitle,
                      selectedPreparation === prep.method && styles.optionTitleActive,
                    ]}
                  >
                    {prep.method}
                  </Text>
                  <Text
                    style={[
                      styles.optionText,
                      selectedPreparation === prep.method && styles.optionTextActive,
                    ]}
                  >
                    {prep.description}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Strength Preference */}
            <View style={styles.card}>
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

        {infoMessage ? (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>{infoMessage}</Text>
          </View>
        ) : null}
        {errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
    gap: 12,
  },

  // Header
  header: {
    marginBottom: 4,
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

  // Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },

  // Labels
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B6B6B',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  // Helper / status text
  helperText: {
    fontSize: 13,
    color: '#6B6B6B',
    lineHeight: 18,
  },
  imageStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
  },
  imageStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  imageStatusDotActive: {
    backgroundColor: '#4A9B6E',
  },
  imageStatusDotInactive: {
    backgroundColor: '#E8E8E8',
  },

  // Button row
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  buttonRowItem: {
    flex: 1,
  },

  // Outline button
  outlineButton: {
    borderWidth: 1.5,
    borderColor: '#E8E8E8',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  outlineButtonText: {
    color: '#2C2C2C',
    fontSize: 15,
    fontWeight: '600',
  },
  inventoryButton: {
    marginTop: 2,
  },

  // Inventory list
  inventoryList: {
    marginTop: 12,
    gap: 8,
  },
  inventoryItem: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 14,
  },
  inventoryItemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  inventoryItemMeta: {
    marginTop: 3,
    fontSize: 13,
    color: '#6B6B6B',
  },

  // Primary button
  primaryButton: {
    backgroundColor: '#2C2C2C',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.45,
  },

  // Profile rows inside card
  profileRow: {
    paddingVertical: 4,
  },
  profileTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  text: {
    fontSize: 15,
    color: '#1A1A1A',
    lineHeight: 22,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 10,
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  confidenceBadge: {
    backgroundColor: '#F5F5F5',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  confidenceBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8B7355',
  },

  // Option cards (preparation methods)
  optionCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  optionCardActive: {
    backgroundColor: '#2C2C2C',
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  optionTitleActive: {
    color: '#FFFFFF',
  },
  optionText: {
    fontSize: 13,
    color: '#6B6B6B',
    lineHeight: 18,
  },
  optionTextActive: {
    color: 'rgba(255,255,255,0.75)',
  },

  // Radio buttons
  radioGroup: {
    gap: 12,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#E8E8E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterActive: {
    borderColor: '#2C2C2C',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2C2C2C',
  },
  radioLabel: {
    fontSize: 15,
    color: '#1A1A1A',
    lineHeight: 22,
  },

  // Info / error banners
  infoBox: {
    backgroundColor: '#FFF8F0',
    borderRadius: 12,
    padding: 14,
  },
  infoText: {
    fontSize: 14,
    color: '#C08B3E',
    fontWeight: '500',
    lineHeight: 20,
  },
  errorBox: {
    backgroundColor: '#FDF2F2',
    borderRadius: 12,
    padding: 14,
  },
  errorText: {
    fontSize: 14,
    color: '#D64545',
    fontWeight: '500',
    lineHeight: 20,
  },
});

export default CoffeePhotoRecipeScreen;
