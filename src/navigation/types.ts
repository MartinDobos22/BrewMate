import { NavigatorScreenParams } from '@react-navigation/native';

import { CoffeeProfile, QuestionnaireProfile } from '../utils/tasteVector';

export type HomeStackParamList = {
  Home: undefined;
  CoffeeScanner: undefined;
  OcrResult: {
    rawText: string;
    correctedText: string;
    coffeeProfile: CoffeeProfile;
    labelImageBase64: string;
  };
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
};

export type QuizStackParamList = {
  CoffeeQuestionnaire: undefined;
  CoffeeQuestionnaireResult: {
    answers: Array<{
      question: string;
      answer: string;
    }>;
    profile: QuestionnaireProfile;
  };
};

export type InventoryStackParamList = {
  CoffeeInventory: undefined;
};

export type RecipesStackParamList = {
  CoffeeRecipesSaved: undefined;
};

export type ProfileStackParamList = {
  Profile: undefined;
};

export type MainTabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList>;
  QuizTab: NavigatorScreenParams<QuizStackParamList>;
  InventoryTab: NavigatorScreenParams<InventoryStackParamList>;
  RecipesTab: NavigatorScreenParams<RecipesStackParamList>;
  ProfileTab: NavigatorScreenParams<ProfileStackParamList>;
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
