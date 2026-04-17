import { CoffeeProfile, QuestionnaireProfile } from '../utils/tasteVector';

export type RootStackParamList = {
  Home: undefined;
  Profile: undefined;
  CoffeeScanner: undefined;
  CoffeePhotoRecipe: undefined;
  CoffeePhotoRecipeResult: {
    analysis: {
      tasteProfile: string;
      flavorNotes: string[];
      roastLevel: 'light' | 'medium' | 'medium-dark' | 'dark';
      recommendedBrewPath: 'espresso' | 'filter' | 'both';
      recommendedPreparations: Array<{
        method: string;
        description: string;
      }>;
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
    brewPath: 'espresso' | 'filter';
    // Filter-specific
    selectedPreparation?: string;
    strengthPreference?: string;
    // Espresso-specific
    drinkType?: string;
    machineType?: string;
    recipe: {
      title: string;
      // Shared
      dose: string;
      grind: string;
      waterTemp: string;
      steps: string[];
      baristaTips: string[];
      whyThisRecipe?: string;
      // Filter fields
      method?: string;
      strengthPreference?: string;
      water?: string;
      totalTime?: string;
      // Espresso fields
      drinkType?: string;
      machineType?: string;
      yield?: string;
      ratio?: string;
      extractionTime?: string;
      pressure?: string;
      milkInstructions?: string;
    };
    brewPreferences?: {
      targetDoseG: number | null;
      targetWaterMl?: number | null;
      targetYieldG?: number | null;
      targetRatio: number | null;
      providedByUser: {
        targetDoseG: boolean;
        targetWaterMl?: boolean;
        targetYieldG?: boolean;
        targetRatio: boolean;
      };
    };
    personalizedForUser?: boolean;
    likePrediction: {
      score: number;
      verdict: string;
      reason: string;
      matchTier?: 'perfect_match' | 'great_choice' | 'worth_trying' | 'interesting_experiment' | 'not_for_you';
      hasQuestionnaire?: boolean;
      algorithmVersion?: string;
      breakdown?: {
        mode: 'vector' | 'heuristic';
        baseScore: number;
        pathBonus: number;
        strengthBonus?: number;
        calibrationOffset: number;
        calibrationSampleSize: number;
        confidence?: number | null;
        axes: Array<{
          axis: string;
          label: string;
          coffeeValue: number;
          userValue: number;
          diff: number;
          tolerance: string;
          weight: number;
          status: 'match' | 'conflict' | 'neutral';
        }>;
      };
    };
  };
  CoffeeQuestionnaire: undefined;
  CoffeeQuestionnaireResult: {
    answers: Array<{
      question: string;
      answer: string;
    }>;
    profile: QuestionnaireProfile;
  };
  OcrResult: {
    rawText: string;
    correctedText: string;
    coffeeProfile: CoffeeProfile;
    labelImageBase64: string;
  };
  CoffeeInventory: undefined;
  CoffeeRecipesSaved: undefined;
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
