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
import { CoffeeBeanIcon, CoffeeCupIcon } from '../components/icons';
import { MD3Button } from '../components/md3';

import AnalysisResultCard from '../components/recipe/AnalysisResultCard';
import BrewPathSelector from '../components/recipe/BrewPathSelector';
import EspressoConfig from '../components/recipe/EspressoConfig';
import FilterConfig, { CUSTOM_PREPARATION_VALUE } from '../components/recipe/FilterConfig';
import GrinderConfig from '../components/recipe/GrinderConfig';
import StepIndicator from '../components/recipe/StepIndicator';

type Props = NativeStackScreenProps<RootStackParamList, 'CoffeePhotoRecipe'>;

type PhotoAnalysis = {
  tasteProfile: string;
  flavorNotes: string[];
  roastLevel: 'light' | 'medium' | 'medium-dark' | 'dark';
  recommendedBrewPath: 'espresso' | 'filter' | 'both';
  recommendedPreparations: Array<{ method: string; description: string }>;
  confidence: number;
  summary: string;
  tasteVector?: {
    acidity: number;
    sweetness: number;
    bitterness: number;
    body: number;
    fruity: number;
    roast: number;
  };
};

type InventoryCoffee = {
  id: string;
  rawText: string | null;
  correctedText: string | null;
  labelImageBase64: string | null;
  status: 'active' | 'empty' | 'archived';
};

type BrewPath = 'espresso' | 'filter';

const PICKER_TIMEOUT_MS = 2000000;
const MAX_IMAGE_DIMENSION = 1600;
const IMAGE_QUALITY = 0.6;
const MAX_BASE64_BYTES = 2_000_000;
const DEFAULT_BREW_RATIO = 15.5;
const DEFAULT_ESPRESSO_RATIO = 2;

const estimateBase64Bytes = (base64: string) =>
  Math.ceil((base64.length * 3) / 4);

const normalizeBase64 = (value: string) => value.replace(/^data:image\/\w+;base64,/, '').trim();
const parseOptionalNumber = (value: string) => {
  if (!value.trim()) {
    return null;
  }
  const normalized = value.replace(',', '.');
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
};

const roundOneDecimal = (value: number) => Math.round(value * 10) / 10;

function CoffeePhotoRecipeScreen({ navigation }: Props) {
  // --- Photo input state ---
  const [imageBase64, setImageBase64] = useState('');
  const [isPicking, setIsPicking] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<InventoryCoffee[]>([]);
  const [isInventoryVisible, setIsInventoryVisible] = useState(false);
  const [isInventoryLoading, setIsInventoryLoading] = useState(false);

  // --- Analysis state ---
  const [analysis, setAnalysis] = useState<PhotoAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // --- Brew path state ---
  const [brewPath, setBrewPath] = useState<BrewPath | null>(null);

  // --- Espresso-specific state ---
  const [drinkType, setDrinkType] = useState<string | null>(null);
  const [machineType, setMachineType] = useState<string | null>(null);
  const [targetYieldG, setTargetYieldG] = useState('');

  // --- Filter-specific state ---
  const [selectedPreparation, setSelectedPreparation] = useState<string | null>(null);
  const [customPreparationText, setCustomPreparationText] = useState('');
  const [strengthPreference, setStrengthPreference] = useState<string | null>('vyvážene');

  // --- Shared state ---
  const [targetDoseG, setTargetDoseG] = useState('');
  const [targetWaterMl, setTargetWaterMl] = useState('');
  const [targetRatio, setTargetRatio] = useState('');
  const [grinderType, setGrinderType] = useState<string | null>(null);
  const [grinderModel, setGrinderModel] = useState('');
  const [grinderSettingScale, setGrinderSettingScale] = useState('');

  // --- UI state ---
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // --- Step computation ---
  const steps = useMemo(() => {
    const hasPhoto = Boolean(imageBase64);
    const hasAnalysis = Boolean(analysis);
    const hasPath = Boolean(brewPath);
    return [
      { label: 'Fotka', status: hasPhoto ? 'completed' as const : 'active' as const },
      { label: 'Analýza', status: hasAnalysis ? 'completed' as const : hasPhoto ? 'active' as const : 'upcoming' as const },
      { label: 'Nastavenia', status: hasPath ? 'active' as const : hasAnalysis ? 'active' as const : 'upcoming' as const },
    ];
  }, [imageBase64, analysis, brewPath]);

  // --- Photo handlers ---
  const handlePickerResponse = (response: ImagePickerResponse) => {
    if (response.didCancel) {
      setErrorMessage('Výber bol zrušený.');
      return;
    }
    if (response.errorCode) {
      setErrorMessage(response.errorMessage || 'Nastala chyba pri výbere obrázka.');
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
      setErrorMessage('Obrázok je stále príliš veľký. Skúste menší záber alebo iný súbor.');
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
        { method: 'GET', credentials: 'include' },
        { feature: 'PhotoRecipe', action: 'inventory-load' },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || 'Nepodarilo sa načítať inventár.');
      }
      const items = Array.isArray(payload?.items) ? payload.items : [];
      setInventoryItems(items.filter((item: InventoryCoffee) => item.status === 'active'));
      setIsInventoryVisible(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nepodarilo sa načítať inventár.';
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
    resetAfterAnalysis();
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

  // --- Reset helpers ---
  const resetAfterAnalysis = () => {
    setAnalysis(null);
    setBrewPath(null);
    resetPathState();
  };

  const resetPathState = () => {
    setDrinkType(null);
    setMachineType(null);
    setTargetYieldG('');
    setSelectedPreparation(null);
    setCustomPreparationText('');
    setStrengthPreference('vyvážene');
    setTargetDoseG('');
    setTargetWaterMl('');
    setTargetRatio('');
    setGrinderType(null);
    setGrinderModel('');
    setGrinderSettingScale('');
  };

  // --- Inline change handlers ---
  const handleChangePhoto = () => {
    setImageBase64('');
    resetAfterAnalysis();
    setErrorMessage('');
    setInfoMessage('');
  };

  const handleChangeBrewPath = () => {
    setBrewPath(null);
    resetPathState();
    setErrorMessage('');
  };

  // --- Brew path handler ---
  const handleBrewPathSelect = (path: BrewPath) => {
    setBrewPath(path);
    resetPathState();
    setErrorMessage('');

    // Auto-select first recommended preparation for filter path
    if (path === 'filter' && analysis?.recommendedPreparations?.length) {
      setSelectedPreparation(analysis.recommendedPreparations[0].method);
    }
  };

  // --- Analysis ---
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
    resetAfterAnalysis();

    try {
      const response = await apiFetch(
        `${DEFAULT_API_HOST}/api/coffee-photo-analysis`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: imageBase64.trim(),
            languageHints: ['sk', 'en'],
          }),
        },
        { feature: 'PhotoRecipe', action: 'analyze' },
      );
      const payload = await response.json();

      if (!response.ok) {
        const message = payload?.error || 'Analýza fotky zlyhala.';
        setErrorMessage(message);
        return;
      }

      setAnalysis(payload.analysis);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Analýza fotky zlyhala.';
      setErrorMessage(message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // --- Recipe generation ---
  const handleGenerateRecipe = async () => {
    if (isGenerating || !analysis || !brewPath) {
      return;
    }

    setErrorMessage('');
    setInfoMessage('');

    let requestBody: Record<string, unknown>;

    if (brewPath === 'espresso') {
      if (!drinkType) {
        setErrorMessage('Vyber typ nápoja.');
        return;
      }
      if (!machineType) {
        setErrorMessage('Vyber typ kávovaru.');
        return;
      }

      const parsedDose = parseOptionalNumber(targetDoseG);
      const parsedYield = parseOptionalNumber(targetYieldG);
      const parsedRatio = parseOptionalNumber(targetRatio);

      if (!parsedDose && !parsedYield) {
        setErrorMessage('Zadaj aspoň dávku alebo výťažok.');
        return;
      }

      const ratioForCalc = parsedRatio ?? DEFAULT_ESPRESSO_RATIO;
      const computedDose = parsedDose ?? (parsedYield ? roundOneDecimal(parsedYield / ratioForCalc) : null);
      const computedYield = parsedYield ?? (parsedDose ? roundOneDecimal(parsedDose * ratioForCalc) : null);
      const computedRatio = parsedRatio ?? (computedDose && computedYield
        ? roundOneDecimal(computedYield / computedDose)
        : ratioForCalc);

      requestBody = {
        brewPath: 'espresso',
        analysis,
        drinkType,
        machineType,
        grinderProfile: grinderType
          ? {
              grinderType,
              grinderModel: grinderModel.trim() || null,
              grinderSettingScale: grinderSettingScale.trim() || null,
            }
          : null,
        brewPreferences: {
          targetDoseG: computedDose,
          targetYieldG: computedYield,
          targetRatio: computedRatio,
        },
      };
    } else {
      // Filter path
      const finalPreparation = selectedPreparation === CUSTOM_PREPARATION_VALUE
        ? customPreparationText.trim()
        : selectedPreparation;

      if (!finalPreparation) {
        setErrorMessage('Vyberte spôsob prípravy alebo napíšte vlastný.');
        return;
      }
      if (!strengthPreference) {
        setErrorMessage('Vyberte preferovanú silu kávy.');
        return;
      }

      const parsedDose = parseOptionalNumber(targetDoseG);
      const parsedWater = parseOptionalNumber(targetWaterMl);
      const parsedRatio = parseOptionalNumber(targetRatio);

      if (!parsedDose && !parsedWater) {
        setErrorMessage('Zadaj aspoň množstvo kávy alebo vody.');
        return;
      }

      const ratioForCalc = parsedRatio ?? DEFAULT_BREW_RATIO;
      const computedDose = parsedDose ?? (parsedWater ? roundOneDecimal(parsedWater / ratioForCalc) : null);
      const computedWater = parsedWater ?? (parsedDose ? roundOneDecimal(parsedDose * ratioForCalc) : null);
      const computedRatio = parsedRatio ?? (computedDose && computedWater
        ? roundOneDecimal(computedWater / computedDose)
        : ratioForCalc);

      requestBody = {
        brewPath: 'filter',
        analysis,
        selectedPreparation: finalPreparation,
        customPreparationText: selectedPreparation === CUSTOM_PREPARATION_VALUE
          ? customPreparationText.trim()
          : null,
        strengthPreference,
        grinderProfile: grinderType
          ? {
              grinderType,
              grinderModel: grinderModel.trim() || null,
              grinderSettingScale: grinderSettingScale.trim() || null,
            }
          : null,
        brewPreferences: {
          targetDoseG: computedDose,
          targetWaterMl: computedWater,
          targetRatio: computedRatio,
          providedByUser: {
            targetDoseG: Boolean(parsedDose),
            targetWaterMl: Boolean(parsedWater),
            targetRatio: Boolean(parsedRatio),
          },
        },
      };
    }

    setIsGenerating(true);

    try {
      const response = await apiFetch(
        `${DEFAULT_API_HOST}/api/coffee-photo-recipe`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        },
        { feature: 'PhotoRecipe', action: 'generate' },
      );

      const payload = await response.json();

      if (!response.ok) {
        const message = payload?.error || 'Generovanie receptu zlyhalo.';
        setErrorMessage(message);
        return;
      }

      navigation.navigate('CoffeePhotoRecipeResult', {
        analysis,
        brewPath,
        ...(brewPath === 'espresso'
          ? { drinkType: drinkType!, machineType: machineType! }
          : {
              selectedPreparation: (selectedPreparation === CUSTOM_PREPARATION_VALUE
                ? customPreparationText.trim()
                : selectedPreparation) || undefined,
              strengthPreference: strengthPreference || undefined,
            }),
        recipe: payload.recipe,
        likePrediction: payload.likePrediction || {
          score: 50,
          verdict: 'Predikcia zatiaľ nie je dostupná.',
          reason: 'Skús recept upraviť podľa vlastnej chuti.',
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Generovanie receptu zlyhalo.';
      setErrorMessage(message);
    } finally {
      setIsGenerating(false);
    }
  };

  // --- Styles ---
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
        helperText: {
          ...typescale.bodySmall,
          color: colors.onSurfaceVariant,
          marginTop: spacing.sm,
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
        changeRow: {
          flexDirection: 'row',
          justifyContent: 'flex-end',
        },
        changeLink: {
          ...typescale.labelMedium,
          color: colors.primary,
          fontWeight: '600',
          paddingVertical: spacing.xs,
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
        <StepIndicator steps={steps} />
        <Text style={s.description}>
          Vyber kávu z inventára alebo ju naskenuj a AI ti navrhne najlepšie
          metódy prípravy podľa jej profilu.
        </Text>

        {/* Photo input card */}
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
                        {hasImage ? 'Použiť fotku etikety z inventára' : 'Bez fotky etikety'}
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
            {imageBase64 ? 'Fotka je pripravená.' : 'Zatiaľ nie je vybraná žiadna fotka.'}
          </Text>
        </View>

        <MD3Button
          label={isAnalyzing ? 'Analyzujem fotku…' : 'Analyzovať fotku'}
          onPress={handleAnalyze}
          disabled={isAnalyzing || isPicking}
          loading={isAnalyzing}
        />

        {/* Post-analysis flow */}
        {analysis ? (
          <>
            <AnalysisResultCard analysis={analysis} />
            <View style={s.changeRow}>
              <Text style={s.changeLink} onPress={handleChangePhoto}>
                Zmeniť fotku
              </Text>
            </View>

            <BrewPathSelector
              recommendedBrewPath={analysis.recommendedBrewPath}
              roastLevel={analysis.roastLevel}
              selectedPath={brewPath}
              onSelect={handleBrewPathSelect}
            />

            {brewPath ? (
              <View style={s.changeRow}>
                <Text style={s.changeLink} onPress={handleChangeBrewPath}>
                  Zmeniť cestu prípravy
                </Text>
              </View>
            ) : null}

            {brewPath === 'espresso' ? (
              <EspressoConfig
                drinkType={drinkType}
                onDrinkTypeChange={setDrinkType}
                machineType={machineType}
                onMachineTypeChange={setMachineType}
                targetDoseG={targetDoseG}
                onDoseChange={setTargetDoseG}
                targetYieldG={targetYieldG}
                onYieldChange={setTargetYieldG}
                targetRatio={targetRatio}
                onRatioChange={setTargetRatio}
              />
            ) : brewPath === 'filter' ? (
              <FilterConfig
                preparations={analysis.recommendedPreparations}
                selectedPreparation={selectedPreparation}
                onPreparationChange={setSelectedPreparation}
                customPreparationText={customPreparationText}
                onCustomPreparationTextChange={setCustomPreparationText}
                strengthPreference={strengthPreference}
                onStrengthChange={setStrengthPreference}
                targetDoseG={targetDoseG}
                onDoseChange={setTargetDoseG}
                targetWaterMl={targetWaterMl}
                onWaterChange={setTargetWaterMl}
                targetRatio={targetRatio}
                onRatioChange={setTargetRatio}
              />
            ) : null}

            {brewPath ? (
              <>
                <GrinderConfig
                  grinderType={grinderType}
                  onGrinderTypeChange={setGrinderType}
                  grinderModel={grinderModel}
                  onGrinderModelChange={setGrinderModel}
                  grinderSettingScale={grinderSettingScale}
                  onGrinderSettingScaleChange={setGrinderSettingScale}
                />
                <MD3Button
                  label={isGenerating ? 'Generujem recept…' : 'Generovať recept'}
                  onPress={handleGenerateRecipe}
                  disabled={isGenerating}
                  loading={isGenerating}
                />
              </>
            ) : null}
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
