import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import BottomNavBar from '../components/BottomNavBar';
import { useTheme } from '../theme/useTheme';
import { CoffeeCupIcon } from '../components/icons';
import { MD3Button } from '../components/md3';

import AnalysisResultCard from '../components/recipe/AnalysisResultCard';
import BrewPathSelector from '../components/recipe/BrewPathSelector';
import EspressoConfig from '../components/recipe/EspressoConfig';
import FilterConfig, { CUSTOM_PREPARATION_VALUE } from '../components/recipe/FilterConfig';
import GrinderConfig from '../components/recipe/GrinderConfig';
import PhotoInputCard from '../components/recipe/PhotoInputCard';
import StepIndicator from '../components/recipe/StepIndicator';
import { usePhotoAnalysis } from '../hooks/usePhotoAnalysis';
import { useRecipeGenerator } from '../hooks/useRecipeGenerator';

type Props = NativeStackScreenProps<RootStackParamList, 'CoffeePhotoRecipe'>;
type BrewPath = 'espresso' | 'filter';

function CoffeePhotoRecipeScreen({ navigation }: Props) {
  // --- Photo state ---
  const [imageBase64, setImageBase64] = useState('');

  // --- Hooks ---
  const { analysis, isAnalyzing, analyze, resetAnalysis } = usePhotoAnalysis();
  const { isGenerating, generate } = useRecipeGenerator();

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

  // --- Shared brew state ---
  const [targetDoseG, setTargetDoseG] = useState('');
  const [targetWaterMl, setTargetWaterMl] = useState('');
  const [targetRatio, setTargetRatio] = useState('');
  const [grinderType, setGrinderType] = useState<string | null>(null);
  const [grinderModel, setGrinderModel] = useState('');
  const [grinderSettingScale, setGrinderSettingScale] = useState('');

  // --- UI state ---
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  // --- Step indicator ---
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

  // --- Reset helpers ---
  const resetPathState = useCallback(() => {
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
  }, []);

  const handleImageSelected = useCallback((base64: string, info?: string) => {
    setErrorMessage('');
    setInfoMessage(info || '');
    setImageBase64(base64);
    resetAnalysis();
    setBrewPath(null);
    resetPathState();
  }, [resetAnalysis, resetPathState]);

  const handleChangePhoto = useCallback(() => {
    setImageBase64('');
    resetAnalysis();
    setBrewPath(null);
    resetPathState();
    setErrorMessage('');
    setInfoMessage('');
  }, [resetAnalysis, resetPathState]);

  const handleChangeBrewPath = useCallback(() => {
    setBrewPath(null);
    resetPathState();
    setErrorMessage('');
  }, [resetPathState]);

  const handleBrewPathSelect = useCallback((path: BrewPath) => {
    setBrewPath(path);
    resetPathState();
    setErrorMessage('');
    if (path === 'filter' && analysis?.recommendedPreparations?.length) {
      setSelectedPreparation(analysis.recommendedPreparations[0].method);
    }
  }, [resetPathState, analysis]);

  const handleAnalyze = useCallback(async () => {
    setErrorMessage('');
    setInfoMessage('');
    setBrewPath(null);
    resetPathState();
    try {
      await analyze(imageBase64);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Analýza fotky zlyhala.');
    }
  }, [analyze, imageBase64, resetPathState]);

  const handleGenerateRecipe = useCallback(async () => {
    if (!analysis || !brewPath) {
      return;
    }
    setErrorMessage('');
    setInfoMessage('');
    try {
      const params = brewPath === 'espresso'
        ? {
            drinkType: drinkType!,
            machineType: machineType!,
            targetDoseG,
            targetYieldG,
            targetRatio,
            grinderType,
            grinderModel,
            grinderSettingScale,
          }
        : {
            selectedPreparation,
            customPreparationText,
            customPreparationValue: CUSTOM_PREPARATION_VALUE,
            strengthPreference,
            targetDoseG,
            targetWaterMl,
            targetRatio,
            grinderType,
            grinderModel,
            grinderSettingScale,
          };

      const result = await generate(analysis, brewPath, params);
      navigation.navigate('CoffeePhotoRecipeResult', result);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Generovanie receptu zlyhalo.');
    }
  }, [
    analysis, brewPath, drinkType, machineType, targetDoseG, targetYieldG,
    targetRatio, grinderType, grinderModel, grinderSettingScale,
    selectedPreparation, customPreparationText, strengthPreference,
    targetWaterMl, generate, navigation,
  ]);

  // --- Styles ---
  const { colors, typescale, shape, spacing } = useTheme();

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
    [colors, typescale, shape, spacing],
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

        <PhotoInputCard
          hasImage={Boolean(imageBase64)}
          onImageSelected={handleImageSelected}
          onError={setErrorMessage}
        />

        <MD3Button
          label={isAnalyzing ? 'Analyzujem fotku…' : 'Analyzovať fotku'}
          onPress={handleAnalyze}
          disabled={isAnalyzing || !imageBase64}
          loading={isAnalyzing}
        />

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
