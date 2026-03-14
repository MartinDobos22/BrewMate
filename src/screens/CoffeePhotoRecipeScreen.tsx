import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
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
  Chip,
  useTheme,
  Divider,
  ProgressBar,
} from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';
import { HomeStackParamList } from '../navigation/types';
import { apiFetch, DEFAULT_API_HOST } from '../utils/api';
import spacing from '../styles/spacing';

type Props = NativeStackScreenProps<HomeStackParamList, 'CoffeePhotoRecipe'>;

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
  const theme = useTheme<MD3Theme>();

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
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      edges={['bottom']}
    >
      <ScrollView
        style={[styles.scroll, { backgroundColor: theme.colors.background }]}
        contentContainerStyle={styles.content}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text variant="headlineMedium" style={[styles.title, { color: theme.colors.onSurface }]}>
            Foto recept
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            Nahrajte fotku kávy, nechajte AI odhadnúť chuť a vyberte si najlepší
            spôsob prípravy.
          </Text>
        </View>

        {/* Step 1: Photo Source */}
        <Card
          mode="contained"
          style={[styles.card, { backgroundColor: theme.colors.surfaceVariant }]}
        >
          <Card.Content style={styles.cardContent}>
            <Text
              variant="labelLarge"
              style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}
            >
              Fotografia kávy
            </Text>

            <View style={styles.buttonRow}>
              <Button
                mode="outlined"
                onPress={handleSelectFromGallery}
                disabled={isPicking}
                style={styles.buttonRowItem}
                contentStyle={styles.buttonContent}
              >
                Vybrať z galérie
              </Button>
              <Button
                mode="outlined"
                onPress={handleTakePhoto}
                disabled={isPicking}
                style={styles.buttonRowItem}
                contentStyle={styles.buttonContent}
              >
                Odfotiť
              </Button>
            </View>

            <Button
              mode="outlined"
              onPress={loadInventory}
              disabled={isInventoryLoading || isPicking}
              loading={isInventoryLoading}
              style={styles.inventoryButton}
              contentStyle={styles.buttonContent}
            >
              {isInventoryLoading ? 'Načítavam inventár…' : 'Vybrať z inventára'}
            </Button>

            {isInventoryVisible ? (
              <View style={styles.inventoryList}>
                {inventoryItems.length > 0 ? (
                  inventoryItems.map((item) => {
                    const coffeeName = item.correctedText || item.rawText || 'Neznáma káva';
                    const hasImage = Boolean(item.labelImageBase64);

                    return (
                      <Card
                        key={item.id}
                        mode="contained"
                        style={[
                          styles.inventoryItemCard,
                          { backgroundColor: hasImage ? theme.colors.surface : theme.colors.surfaceVariant },
                          !hasImage && styles.inventoryItemDisabled,
                        ]}
                        onPress={hasImage ? () => handleSelectInventoryCoffee(item) : undefined}
                      >
                        <Card.Content style={styles.inventoryItemContent}>
                          <Text
                            variant="titleMedium"
                            style={{ color: theme.colors.onSurface }}
                          >
                            {coffeeName}
                          </Text>
                          <Text
                            variant="bodyMedium"
                            style={{ color: theme.colors.onSurfaceVariant }}
                          >
                            {hasImage
                              ? 'Použiť fotku etikety z inventára'
                              : 'Bez fotky etikety'}
                          </Text>
                        </Card.Content>
                      </Card>
                    );
                  })
                ) : (
                  <Text
                    variant="bodyMedium"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    V inventári nemáš žiadnu aktívnu kávu.
                  </Text>
                )}
              </View>
            ) : null}

            <View style={styles.imageStatusRow}>
              <View
                style={[
                  styles.imageStatusDot,
                  {
                    backgroundColor: imageBase64
                      ? theme.colors.secondary
                      : theme.colors.outlineVariant,
                  },
                ]}
              />
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {imageBase64
                  ? 'Fotka je pripravená.'
                  : 'Zatiaľ nie je vybraná žiadna fotka.'}
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* Analyze CTA */}
        <Button
          mode="contained"
          onPress={handleAnalyze}
          disabled={isAnalyzing || isPicking}
          loading={isAnalyzing}
          contentStyle={styles.primaryButtonContent}
          style={styles.primaryButton}
        >
          {isAnalyzing ? 'Analyzujem fotku…' : 'Analyzovať fotku'}
        </Button>

        {analysis ? (
          <>
            {/* Step 2: AI Taste Profile */}
            <Card
              mode="elevated"
              elevation={1}
              style={[styles.card, { backgroundColor: theme.colors.surface }]}
            >
              <Card.Content style={styles.cardContent}>
                <Text
                  variant="labelLarge"
                  style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}
                >
                  Chuť kávy podľa AI
                </Text>

                <View style={styles.profileRow}>
                  <Text
                    variant="labelLarge"
                    style={{ color: theme.colors.onSurface, marginBottom: spacing.xs }}
                  >
                    Chuťové tóny
                  </Text>
                  <View style={styles.chipRow}>
                    {analysis.flavorNotes.length > 0
                      ? analysis.flavorNotes.map((note) => (
                          <Chip
                            key={note}
                            mode="flat"
                            style={[styles.flavorChip, { backgroundColor: theme.colors.secondaryContainer }]}
                            textStyle={{ color: theme.colors.onSecondaryContainer }}
                          >
                            {note}
                          </Chip>
                        ))
                      : (
                          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                            Neurčené
                          </Text>
                        )}
                  </View>
                </View>

                <Divider style={[styles.divider, { backgroundColor: theme.colors.outlineVariant }]} />

                <View style={styles.profileRow}>
                  <Text
                    variant="labelLarge"
                    style={{ color: theme.colors.onSurface, marginBottom: spacing.xs }}
                  >
                    Profil chuti
                  </Text>
                  <Text variant="bodyLarge" style={{ color: theme.colors.onSurface }}>
                    {analysis.tasteProfile}
                  </Text>
                </View>

                <Divider style={[styles.divider, { backgroundColor: theme.colors.outlineVariant }]} />

                <View style={styles.profileRow}>
                  <Text
                    variant="labelLarge"
                    style={{ color: theme.colors.onSurface, marginBottom: spacing.xs }}
                  >
                    Krátke zhrnutie
                  </Text>
                  <Text variant="bodyLarge" style={{ color: theme.colors.onSurface }}>
                    {analysis.summary}
                  </Text>
                </View>

                <Divider style={[styles.divider, { backgroundColor: theme.colors.outlineVariant }]} />

                <View style={styles.confidenceRow}>
                  <Text
                    variant="labelLarge"
                    style={{ color: theme.colors.onSurface }}
                  >
                    Istota
                  </Text>
                  <Chip
                    mode="flat"
                    style={[styles.confidenceChip, { backgroundColor: theme.colors.primaryContainer }]}
                    textStyle={{ color: theme.colors.onPrimaryContainer }}
                  >
                    {Math.round(analysis.confidence * 100)}%
                  </Chip>
                </View>
              </Card.Content>
            </Card>

            {/* Step 3: Preparation Methods */}
            <Card
              mode="elevated"
              elevation={1}
              style={[styles.card, { backgroundColor: theme.colors.surface }]}
            >
              <Card.Content style={styles.cardContent}>
                <Text
                  variant="labelLarge"
                  style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}
                >
                  Najvhodnejšia príprava
                </Text>
                {analysis.recommendedPreparations.map((prep) => {
                  const isSelected = selectedPreparation === prep.method;
                  return (
                    <Card
                      key={prep.method}
                      mode="contained"
                      style={[
                        styles.optionCard,
                        {
                          backgroundColor: isSelected
                            ? theme.colors.primaryContainer
                            : theme.colors.surfaceVariant,
                        },
                      ]}
                      onPress={() => setSelectedPreparation(prep.method)}
                    >
                      <Card.Content style={styles.optionCardContent}>
                        <Text
                          variant="titleMedium"
                          style={{
                            color: isSelected
                              ? theme.colors.onPrimaryContainer
                              : theme.colors.onSurface,
                            marginBottom: spacing.xs,
                          }}
                        >
                          {prep.method}
                        </Text>
                        <Text
                          variant="bodyMedium"
                          style={{
                            color: isSelected
                              ? theme.colors.onPrimaryContainer
                              : theme.colors.onSurfaceVariant,
                          }}
                        >
                          {prep.description}
                        </Text>
                      </Card.Content>
                    </Card>
                  );
                })}
              </Card.Content>
            </Card>

            {/* Step 4: Strength Preference */}
            <Card
              mode="elevated"
              elevation={1}
              style={[styles.card, { backgroundColor: theme.colors.surface }]}
            >
              <Card.Content style={styles.cardContent}>
                <Text
                  variant="labelLarge"
                  style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}
                >
                  Aké chute chceš: jemné chute, slabšie alebo výraznejšie?
                </Text>
                <View style={styles.chipRow}>
                  {strengthOptions.map((option) => {
                    const isSelected = strengthPreference === option;
                    return (
                      <Chip
                        key={option}
                        mode={isSelected ? 'flat' : 'outlined'}
                        selected={isSelected}
                        onPress={() => setStrengthPreference(option)}
                        style={[
                          styles.strengthChip,
                          isSelected && { backgroundColor: theme.colors.primaryContainer },
                        ]}
                        textStyle={{
                          color: isSelected
                            ? theme.colors.onPrimaryContainer
                            : theme.colors.onSurface,
                        }}
                        showSelectedCheck={false}
                      >
                        {option}
                      </Chip>
                    );
                  })}
                </View>
              </Card.Content>
            </Card>

            {/* Generate Recipe CTA */}
            <Button
              mode="contained"
              onPress={handleGenerateRecipe}
              disabled={isGenerating}
              loading={isGenerating}
              contentStyle={styles.primaryButtonContent}
              style={styles.primaryButton}
            >
              {isGenerating ? 'Generujem recept…' : 'Generovať recept'}
            </Button>
          </>
        ) : null}

        {/* Info / Error banners */}
        {infoMessage ? (
          <Card
            mode="contained"
            style={[styles.bannerCard, { backgroundColor: theme.colors.secondaryContainer }]}
          >
            <Card.Content>
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.onSecondaryContainer }}
              >
                {infoMessage}
              </Text>
            </Card.Content>
          </Card>
        ) : null}

        {errorMessage ? (
          <Card
            mode="contained"
            style={[styles.bannerCard, { backgroundColor: theme.colors.errorContainer }]}
          >
            <Card.Content>
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.error }}
              >
                {errorMessage}
              </Text>
            </Card.Content>
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },

  // Header
  header: {
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  title: {
    // color via theme
  },

  // Cards
  card: {
    borderRadius: spacing.lg,
  },
  cardContent: {
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  sectionLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },

  // Button row (gallery + camera)
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  buttonRowItem: {
    flex: 1,
  },
  buttonContent: {
    height: 44,
  },

  // Inventory
  inventoryButton: {
    marginTop: spacing.xs,
  },
  inventoryList: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  inventoryItemCard: {
    borderRadius: spacing.md,
  },
  inventoryItemContent: {
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  inventoryItemDisabled: {
    opacity: 0.5,
  },

  // Image status
  imageStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  imageStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Primary button
  primaryButton: {
    borderRadius: 12,
  },
  primaryButtonContent: {
    height: 52,
  },

  // Profile rows inside analysis card
  profileRow: {
    paddingVertical: spacing.xs,
  },
  divider: {
    marginVertical: spacing.sm,
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },

  // Flavor chips
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  flavorChip: {
    // background via theme inline
  },
  confidenceChip: {
    // background via theme inline
  },

  // Preparation option cards
  optionCard: {
    borderRadius: spacing.md,
    marginBottom: spacing.sm,
  },
  optionCardContent: {
    paddingVertical: spacing.sm,
  },

  // Strength chips
  strengthChip: {
    // state via inline
  },

  // Banners
  bannerCard: {
    borderRadius: spacing.md,
  },
});

export default CoffeePhotoRecipeScreen;
