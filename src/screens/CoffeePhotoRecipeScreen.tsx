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
import BottomNavBar from '../components/BottomNavBar';
import { useTheme } from '../theme/useTheme';
import { CoffeeBeanIcon, CoffeeCupIcon, FlameIcon, SparklesIcon } from '../components/icons';
import { MD3Button, Chip } from '../components/md3';

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

  const { colors, typescale, shape, elevation: elev, spacing } = useTheme();

  const s = useMemo(
    () =>
      StyleSheet.create({
        safeArea: {
          flex: 1,
          backgroundColor: colors.background,
        },
        container: {
          flexGrow: 1,
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
        description: {
          ...typescale.bodyMedium,
          color: colors.onSurfaceVariant,
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
        helperText: {
          ...typescale.bodySmall,
          color: colors.onSurfaceVariant,
          marginTop: spacing.sm,
        },
        buttonRow: {
          flexDirection: 'row',
          gap: spacing.md,
        },
        inventoryList: {
          marginTop: spacing.md,
          gap: spacing.sm,
        },
        inventoryItem: {
          borderWidth: 1,
          borderColor: colors.outlineVariant,
          backgroundColor: colors.surfaceContainerLowest,
          borderRadius: shape.large,
          padding: spacing.md,
        },
        inventoryItemDisabled: {
          opacity: 0.5,
        },
        inventoryItemTitle: {
          ...typescale.labelLarge,
          color: colors.onSurface,
        },
        inventoryItemMeta: {
          ...typescale.bodySmall,
          color: colors.onSurfaceVariant,
          marginTop: spacing.xs,
        },
        flavorRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.sm,
        },
        optionCard: {
          borderWidth: 1,
          borderColor: colors.outlineVariant,
          backgroundColor: colors.surfaceContainerLowest,
          borderRadius: shape.medium,
          padding: spacing.md,
          marginBottom: spacing.sm,
        },
        optionCardActive: {
          borderColor: colors.primary,
          backgroundColor: colors.primaryContainer,
        },
        optionTitle: {
          ...typescale.titleSmall,
          color: colors.onSurface,
          marginBottom: spacing.xs,
        },
        optionTitleActive: {
          color: colors.onPrimaryContainer,
        },
        optionText: {
          ...typescale.bodySmall,
          color: colors.onSurfaceVariant,
        },
        optionTextActive: {
          color: colors.onPrimaryContainer,
        },
        radioGroup: {
          gap: spacing.md,
        },
        radioRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
        },
        radioOuter: {
          width: 20,
          height: 20,
          borderRadius: 10,
          borderWidth: 2,
          borderColor: colors.outline,
          alignItems: 'center',
          justifyContent: 'center',
        },
        radioOuterActive: {
          borderColor: colors.primary,
        },
        radioInner: {
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: colors.primary,
        },
        radioLabel: {
          ...typescale.bodyMedium,
          color: colors.onSurface,
        },
        errorText: {
          ...typescale.bodySmall,
          color: colors.error,
          fontWeight: '600',
        },
        infoText: {
          ...typescale.bodySmall,
          color: colors.tertiary,
          fontWeight: '600',
        },
      }),
    [colors, typescale, shape, elev, spacing],
  );

  return (
    <SafeAreaView style={s.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.container}>
        <View style={s.headerRow}>
          <CoffeeCupIcon size={20} color={colors.onSurfaceVariant} />
          <Text style={s.overline}>BrewMate Recipe AI</Text>
        </View>
        <Text style={s.title}>Coffee recipe scanner</Text>
        <Text style={s.description}>
          Naskenuj etiketu kávy, nechaj AI odhadnúť chuť a vygeneruj recept podľa
          zvolenej metódy a intenzity.
        </Text>

        <View style={s.card}>
          <View style={s.cardHeader}>
            <CoffeeBeanIcon size={20} color={colors.primary} />
            <Text style={s.cardTitle}>Fotografia kávy</Text>
          </View>
          <View style={s.buttonRow}>
            <MD3Button
              label="Vybrať z galérie"
              variant="outlined"
              onPress={handleSelectFromGallery}
              disabled={isPicking}
              style={{ flex: 1 }}
            />
            <MD3Button
              label="Odfotiť"
              variant="tonal"
              onPress={handleTakePhoto}
              disabled={isPicking}
              style={{ flex: 1 }}
            />
          </View>
          <MD3Button
            label={isInventoryLoading ? 'Načítavam inventár…' : 'Vybrať fotku z inventára'}
            variant="outlined"
            onPress={loadInventory}
            disabled={isInventoryLoading || isPicking}
            loading={isInventoryLoading}
            style={{ marginTop: spacing.md }}
          />

          {isInventoryVisible ? (
            <View style={s.inventoryList}>
              {inventoryItems.length > 0 ? (
                inventoryItems.map((item) => {
                  const coffeeName = item.correctedText || item.rawText || 'Neznáma káva';
                  const hasImage = Boolean(item.labelImageBase64);

                  return (
                    <Pressable
                      key={item.id}
                      style={[s.inventoryItem, !hasImage && s.inventoryItemDisabled]}
                      onPress={() => handleSelectInventoryCoffee(item)}
                      disabled={!hasImage}
                    >
                      <Text style={s.inventoryItemTitle}>{coffeeName}</Text>
                      <Text style={s.inventoryItemMeta}>
                        {hasImage
                          ? 'Použiť fotku etikety z inventára'
                          : 'Bez fotky etikety'}
                      </Text>
                    </Pressable>
                  );
                })
              ) : (
                <Text style={s.helperText}>V inventári nemáš žiadnu aktívnu kávu.</Text>
              )}
            </View>
          ) : null}
          <Text style={s.helperText}>
            {imageBase64
              ? 'Fotka je pripravená.'
              : 'Zatiaľ nie je vybraná žiadna fotka.'}
          </Text>
        </View>

        <MD3Button
          label={isAnalyzing ? 'Analyzujem fotku…' : 'Analyzovať fotku'}
          onPress={handleAnalyze}
          disabled={isAnalyzing || isPicking}
          loading={isAnalyzing}
        />

        {analysis ? (
          <>
            <View style={s.card}>
              <View style={s.cardHeader}>
                <SparklesIcon size={20} color={colors.primary} />
                <Text style={s.cardTitle}>Chuť kávy podľa AI</Text>
              </View>
              <Text style={s.subsectionTitle}>Chuťové tóny</Text>
              {analysis.flavorNotes.length > 0 ? (
                <View style={s.flavorRow}>
                  {analysis.flavorNotes.map((note: string, i: number) => (
                    <Chip key={i} label={note} role="tertiary" />
                  ))}
                </View>
              ) : (
                <Text style={s.bodyText}>Neurčené</Text>
              )}
              <Text style={s.subsectionTitle}>Profil chuti</Text>
              <Text style={s.bodyText}>{analysis.tasteProfile}</Text>
              <Text style={s.subsectionTitle}>Krátke zhrnutie</Text>
              <Text style={s.bodyText}>{analysis.summary}</Text>
              <Text style={s.subsectionTitle}>Istota</Text>
              <Text style={s.bodyText}>
                {Math.round(analysis.confidence * 100)}%
              </Text>
            </View>

            <View style={s.card}>
              <View style={s.cardHeader}>
                <CoffeeCupIcon size={20} color={colors.primary} />
                <Text style={s.cardTitle}>Najvhodnejšia príprava</Text>
              </View>
              {analysis.recommendedPreparations.map((prep) => {
                const isActive = selectedPreparation === prep.method;
                return (
                  <Pressable
                    key={prep.method}
                    style={[s.optionCard, isActive && s.optionCardActive]}
                    onPress={() => setSelectedPreparation(prep.method)}
                  >
                    <Text style={[s.optionTitle, isActive && s.optionTitleActive]}>
                      {prep.method}
                    </Text>
                    <Text style={[s.optionText, isActive && s.optionTextActive]}>
                      {prep.description}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={s.card}>
              <View style={s.cardHeader}>
                <FlameIcon size={20} color={colors.primary} />
                <Text style={s.cardTitle}>
                  Aké chute chceš?
                </Text>
              </View>
              <View style={s.radioGroup}>
                {strengthOptions.map((option) => (
                  <Pressable
                    key={option}
                    style={s.radioRow}
                    onPress={() => setStrengthPreference(option)}
                  >
                    <View
                      style={[
                        s.radioOuter,
                        strengthPreference === option && s.radioOuterActive,
                      ]}
                    >
                      {strengthPreference === option ? (
                        <View style={s.radioInner} />
                      ) : null}
                    </View>
                    <Text style={s.radioLabel}>{option}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <MD3Button
              label={isGenerating ? 'Generujem recept…' : 'Generovať recept'}
              onPress={handleGenerateRecipe}
              disabled={isGenerating}
              loading={isGenerating}
            />
          </>
        ) : null}

        {infoMessage ? <Text style={s.infoText}>{infoMessage}</Text> : null}
        {errorMessage ? <Text style={s.errorText}>{errorMessage}</Text> : null}
      </ScrollView>
      <BottomNavBar />
    </SafeAreaView>
  );
}

export default CoffeePhotoRecipeScreen;
