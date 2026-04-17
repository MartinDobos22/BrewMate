import { useCallback, useState } from 'react';

import { apiFetch, DEFAULT_API_HOST } from '../utils/api';
import {
  hasAnyEspressoInput,
  hasAnyFilterInput,
  normalizeEspressoBrew,
  normalizeFilterBrew,
} from '../utils/brewCalc';
import type { RootStackParamList } from '../navigation/types';
import type { PhotoAnalysis } from './usePhotoAnalysis';

type BrewPath = 'espresso' | 'filter';

type EspressoParams = {
  drinkType: string;
  machineType: string;
  targetDoseG: string;
  targetYieldG: string;
  targetRatio: string;
  grinderType: string | null;
  grinderModel: string;
  grinderSettingScale: string;
};

type FilterParams = {
  selectedPreparation: string | null;
  customPreparationText: string;
  customPreparationValue: string;
  strengthPreference: string | null;
  targetDoseG: string;
  targetWaterMl: string;
  targetRatio: string;
  grinderType: string | null;
  grinderModel: string;
  grinderSettingScale: string;
};

type RecipeResult = RootStackParamList['CoffeePhotoRecipeResult'];

type UseRecipeGeneratorReturn = {
  isGenerating: boolean;
  generate: (
    analysis: PhotoAnalysis,
    brewPath: BrewPath,
    params: EspressoParams | FilterParams,
  ) => Promise<RecipeResult>;
};

const buildGrinderProfile = (
  grinderType: string | null,
  grinderModel: string,
  grinderSettingScale: string,
) =>
  grinderType
    ? {
        grinderType,
        grinderModel: grinderModel.trim() || null,
        grinderSettingScale: grinderSettingScale.trim() || null,
      }
    : null;

export function useRecipeGenerator(): UseRecipeGeneratorReturn {
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(
    async (
      analysis: PhotoAnalysis,
      brewPath: BrewPath,
      params: EspressoParams | FilterParams,
    ): Promise<RecipeResult> => {
      if (isGenerating) {
        throw new Error('Už sa generuje recept.');
      }

      let requestBody: Record<string, unknown>;
      let resolvedBrewPreferences: RecipeResult['brewPreferences'];

      if (brewPath === 'espresso') {
        const ep = params as EspressoParams;
        if (!ep.drinkType) {
          throw new Error('Vyber typ nápoja.');
        }
        if (!ep.machineType) {
          throw new Error('Vyber typ kávovaru.');
        }
        if (!hasAnyEspressoInput({ dose: ep.targetDoseG, yieldG: ep.targetYieldG })) {
          throw new Error('Zadaj aspoň dávku alebo výťažok.');
        }

        resolvedBrewPreferences = normalizeEspressoBrew({
          dose: ep.targetDoseG,
          yieldG: ep.targetYieldG,
          ratio: ep.targetRatio,
        });

        requestBody = {
          brewPath: 'espresso',
          analysis,
          drinkType: ep.drinkType,
          machineType: ep.machineType,
          grinderProfile: buildGrinderProfile(ep.grinderType, ep.grinderModel, ep.grinderSettingScale),
          brewPreferences: resolvedBrewPreferences,
        };
      } else {
        const fp = params as FilterParams;
        const finalPreparation =
          fp.selectedPreparation === fp.customPreparationValue
            ? fp.customPreparationText.trim()
            : fp.selectedPreparation;

        if (!finalPreparation) {
          throw new Error('Vyberte spôsob prípravy alebo napíšte vlastný.');
        }
        if (!fp.strengthPreference) {
          throw new Error('Vyberte preferovanú silu kávy.');
        }
        if (!hasAnyFilterInput({ dose: fp.targetDoseG, water: fp.targetWaterMl })) {
          throw new Error('Zadaj aspoň množstvo kávy alebo vody.');
        }

        resolvedBrewPreferences = normalizeFilterBrew({
          dose: fp.targetDoseG,
          water: fp.targetWaterMl,
          ratio: fp.targetRatio,
        });

        requestBody = {
          brewPath: 'filter',
          analysis,
          selectedPreparation: finalPreparation,
          customPreparationText:
            fp.selectedPreparation === fp.customPreparationValue
              ? fp.customPreparationText.trim()
              : null,
          strengthPreference: fp.strengthPreference,
          grinderProfile: buildGrinderProfile(fp.grinderType, fp.grinderModel, fp.grinderSettingScale),
          brewPreferences: resolvedBrewPreferences,
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
          throw new Error(payload?.error || 'Generovanie receptu zlyhalo.');
        }

        const result: RecipeResult = {
          analysis,
          brewPath,
          ...(brewPath === 'espresso'
            ? {
                drinkType: (params as EspressoParams).drinkType,
                machineType: (params as EspressoParams).machineType,
              }
            : {
                selectedPreparation:
                  ((params as FilterParams).selectedPreparation === (params as FilterParams).customPreparationValue
                    ? (params as FilterParams).customPreparationText.trim()
                    : (params as FilterParams).selectedPreparation) || undefined,
                strengthPreference: (params as FilterParams).strengthPreference || undefined,
              }),
          recipe: payload.recipe,
          brewPreferences: resolvedBrewPreferences,
          likePrediction: payload.likePrediction || {
            score: 50,
            verdict: 'Predikcia zatiaľ nie je dostupná.',
            reason: 'Skús recept upraviť podľa vlastnej chuti.',
          },
        };

        return result;
      } finally {
        setIsGenerating(false);
      }
    },
    [isGenerating],
  );

  return { isGenerating, generate };
}
