import AsyncStorage from '@react-native-async-storage/async-storage';

type SaveEntry<T> = {
  id: string;
  savedAt: string;
  payload: T;
};

const saveEntry = async <T,>(key: string, payload: T) => {
  const entry: SaveEntry<T> = {
    id: `${key}-${Date.now()}`,
    savedAt: new Date().toISOString(),
    payload,
  };
  const existing = await AsyncStorage.getItem(key);
  const parsed: Array<SaveEntry<T>> = existing ? JSON.parse(existing) : [];
  parsed.unshift(entry);
  await AsyncStorage.setItem(key, JSON.stringify(parsed));
  return entry;
};

export const STORAGE_KEYS = {
  coffeeProfile: 'savedCoffeeProfile',
  questionnaireResult: 'savedQuestionnaireResult',
};

export const saveCoffeeProfile = async (payload: {
  rawText: string;
  correctedText: string;
  coffeeProfile: {
    flavorNotes: string[];
    tasteProfile: string;
    expertSummary: string;
    laymanSummary: string;
    preferenceHint: string;
    reasoning: string;
    confidence: number;
    missingInfo?: string[];
  };
}) => saveEntry(STORAGE_KEYS.coffeeProfile, payload);

export const saveQuestionnaireResult = async (payload: {
  answers: Array<{ question: string; answer: string }>;
  profile: {
    profileSummary: string;
    recommendedStyle: string;
    recommendedOrigins: string;
    brewingTips: string;
  };
}) => saveEntry(STORAGE_KEYS.questionnaireResult, payload);
