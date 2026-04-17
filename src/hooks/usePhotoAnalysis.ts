import { useCallback, useState } from 'react';

import { apiFetch, DEFAULT_API_HOST } from '../utils/api';

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
  analyze: (imageBase64: string) => Promise<void>;
  resetAnalysis: () => void;
};

export function usePhotoAnalysis(): UsePhotoAnalysisReturn {
  const [analysis, setAnalysis] = useState<PhotoAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [, setError] = useState('');

  const resetAnalysis = useCallback(() => {
    setAnalysis(null);
    setError('');
  }, []);

  const analyze = useCallback(async (imageBase64: string) => {
    if (isAnalyzing) {
      return;
    }
    if (!imageBase64.trim()) {
      throw new Error('Najprv vyberte alebo odfoťte obrázok.');
    }

    setIsAnalyzing(true);
    setError('');

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
        throw new Error(payload?.error || 'Analýza fotky zlyhala.');
      }

      setAnalysis(payload.analysis);
    } finally {
      setIsAnalyzing(false);
    }
  }, [isAnalyzing]);

  return { analysis, isAnalyzing, analyze, resetAnalysis };
}

export type { PhotoAnalysis };
