import AsyncStorage from '@react-native-async-storage/async-storage';
import { CoffeeProfile, QuestionnaireProfile } from './tasteVector';

export type SaveEntry<T> = {
  id: string;
  savedAt: string;
  payload: T;
};

export type CoffeeProfilePayload = {
  rawText: string;
  correctedText: string;
  coffeeProfile: CoffeeProfile;
};

export type QuestionnaireResultPayload = {
  answers: Array<{ question: string; answer: string }>;
  profile: QuestionnaireProfile;
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

export const saveCoffeeProfile = async (payload: CoffeeProfilePayload) =>
  saveEntry(STORAGE_KEYS.coffeeProfile, payload);

export const saveQuestionnaireResult = async (
  payload: QuestionnaireResultPayload,
) => saveEntry(STORAGE_KEYS.questionnaireResult, payload);

const loadLatestEntry = async <T,>(key: string): Promise<SaveEntry<T> | null> => {
  const existing = await AsyncStorage.getItem(key);
  if (!existing) {
    return null;
  }

  try {
    const parsed: Array<SaveEntry<T>> = JSON.parse(existing);
    return parsed?.[0] ?? null;
  } catch (error) {
    console.error('[LocalSave] Failed to parse storage entry', { key, error });
    return null;
  }
};

export const loadLatestQuestionnaireResult = async () =>
  loadLatestEntry<QuestionnaireResultPayload>(STORAGE_KEYS.questionnaireResult);

export const loadLatestCoffeeProfile = async () =>
  loadLatestEntry<CoffeeProfilePayload>(STORAGE_KEYS.coffeeProfile);
