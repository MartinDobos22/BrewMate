import { CoffeeProfile, QuestionnaireProfile } from '../utils/tasteVector';

// Bottom tab param lists — 5 tabs
export type BottomTabParamList = {
  HomeTab: undefined;
  TestTab: undefined;
  InventoryTab: undefined;
  RecipesTab: undefined;
  ProfileTab: undefined;
};

// Home stack (scanner, photo recipe flows)
export type HomeStackParamList = {
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
  OcrResult: {
    rawText: string;
    correctedText: string;
    coffeeProfile: CoffeeProfile;
    labelImageBase64: string;
  };
};

// Test (Questionnaire) stack
export type TestStackParamList = {
  CoffeeQuestionnaire: undefined;
  CoffeeQuestionnaireResult: {
    answers: Array<{
      question: string;
      answer: string;
    }>;
    profile: QuestionnaireProfile;
  };
};

// Inventory stack
export type InventoryStackParamList = {
  CoffeeInventory: undefined;
};

// Recipes stack
export type RecipesStackParamList = {
  CoffeeRecipesSaved: undefined;
};

// Profile stack (journal, settings)
export type ProfileStackParamList = {
  ProfileHome: undefined;
  CoffeeQuestionnaire: undefined;
  CoffeeQuestionnaireResult: {
    answers: Array<{
      question: string;
      answer: string;
    }>;
    profile: QuestionnaireProfile;
  };
  CoffeeJournal: undefined;
};

// Auth stack
export type AuthStackParamList = {
  Login:
    | {
        prefillEmail?: string;
        prefillPassword?: string;
      }
    | undefined;
  Register: undefined;
};

// Combined root param list for legacy compatibility
export type RootStackParamList = HomeStackParamList &
  InventoryStackParamList &
  RecipesStackParamList &
  ProfileStackParamList;
