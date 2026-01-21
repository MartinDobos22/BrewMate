export type RootStackParamList = {
  Home: undefined;
  CoffeeScanner: undefined;
  OcrResult: {
    rawText: string;
    correctedText: string;
    coffeeProfile: {
      flavorNotes: string[];
      tasteProfile: string;
      expertSummary: string;
      laymanSummary: string;
      preferenceHint: string;
      confidence: number;
      source: 'label' | 'inferred' | 'mixed' | 'low_info';
      reasoning: string;
      missingInfo?: string[];
    };
  };
};
