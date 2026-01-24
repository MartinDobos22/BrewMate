export type RootStackParamList = {
  Home: undefined;
  CoffeeScanner: undefined;
  CoffeeQuestionnaire: undefined;
  CoffeeQuestionnaireResult: {
    answers: Array<{
      question: string;
      answer: string;
    }>;
    profile: {
      profileSummary: string;
      recommendedStyle: string;
      recommendedOrigins: string;
      brewingTips: string;
    };
  };
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

export type AuthStackParamList = {
  Login:
    | {
        prefillEmail?: string;
        prefillPassword?: string;
      }
    | undefined;
  Register: undefined;
};
