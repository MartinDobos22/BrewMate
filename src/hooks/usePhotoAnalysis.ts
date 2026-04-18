import { useCallback, useState } from 'react';

import { apiFetch, ApiError, parseApiError, DEFAULT_API_HOST } from '../utils/api';

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

type UsePhotoAnalysisReturn = {
  analysis: PhotoAnalysis | null;
  isAnalyzing: boolean;
  canRetry: boolean;
  cachedResult: boolean;
  analyze: (imageBase64: string) => Promise<void>;
  resetAnalysis: () => void;
};

export function usePhotoAnalysis(): UsePhotoAnalysisReturn {
  const [analysis, setAnalysis] = useState<PhotoAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [canRetry, setCanRetry] = useState(false);
  const [cachedResult, setCachedResult] = useState(false);

  const resetAnalysis = useCallback(() => {
    setAnalysis(null);
    setCanRetry(false);
    setCachedResult(false);
  }, []);

  const analyze = useCallback(async (imageBase64: string) => {
    if (isAnalyzing) {
      return;
    }
    if (!imageBase64.trim()) {
      throw new Error('Najprv vyberte alebo odfoťte obrázok.');
    }

    setIsAnalyzing(true);
    setCanRetry(false);
    setCachedResult(false);

    try {
      const response = await apiFetch(
        `${DEFAULT_API_HOST}/api/coffee-photo-analysis`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            imageBase64: imageBase64.trim(),
            languageHints: ['sk', 'en'],
          }),
        },
        { feature: 'PhotoRecipe', action: 'analyze' },
      );

      if (!response.ok) {
        throw await parseApiError(response);
      }

      const payload = await response.json();
      setAnalysis(payload.analysis);
      setCachedResult(Boolean(payload.cached));
    } catch (error) {
      if (error instanceof ApiError && error.retryable) {
        setCanRetry(true);
      }
      throw error instanceof ApiError
        ? error
        : new Error((error as Error).message || 'Analýza fotky zlyhala.');
    } finally {
      setIsAnalyzing(false);
    }
  }, [isAnalyzing]);

  return { analysis, isAnalyzing, canRetry, cachedResult, analyze, resetAnalysis };
}

export type { PhotoAnalysis };
