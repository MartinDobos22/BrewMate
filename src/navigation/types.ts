import { CoffeeProfile, QuestionnaireProfile } from '../utils/tasteVector';

export type RootStackParamList = {
  Home: undefined;
  CoffeeScanner: undefined;
  CoffeePhotoRecipe: undefined;
  CoffeePhotoRecipeResult: {
    analysis: {
      tasteProfile: string;
      flavorNotes: string[];
      recommendedPreparations: Array<{
        method: string;
        description: string;
      }>;
      confidence: number;
      summary: string;
    };
    selectedPreparation: string;
    strengthPreference: string;
    recipe: {
      title: string;
      method: string;
      strengthPreference: string;
      dose: string;
      water: string;
      grind: string;
      waterTemp: string;
      totalTime: string;
      steps: string[];
      baristaTips: string[];
    };
    likePrediction: {
      score: number;
      verdict: string;
      reason: string;
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
