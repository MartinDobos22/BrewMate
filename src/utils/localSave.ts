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

const readEntries = async <T,>(key: string): Promise<Array<SaveEntry<T>>> => {
  try {
    const existing = await AsyncStorage.getItem(key);
    if (!existing) {
      return [];
    }
    const parsed = JSON.parse(existing);
    return Array.isArray(parsed) ? (parsed as Array<SaveEntry<T>>) : [];
  } catch (error) {
    // Corrupt payload or storage error — fall back to an empty list so the
    // caller can still write fresh data without losing functionality.
    console.error('[LocalSave] Failed to read entries', { key, error });
    return [];
  }
};

const saveEntry = async <T,>(key: string, payload: T) => {
  const entry: SaveEntry<T> = {
    id: `${key}-${Date.now()}`,
    savedAt: new Date().toISOString(),
    payload,
  };

  const parsed = await readEntries<T>(key);
  parsed.unshift(entry);

  try {
    await AsyncStorage.setItem(key, JSON.stringify(parsed));
  } catch (error) {
    console.error('[LocalSave] Failed to persist entry', { key, error });
    throw error;
  }

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
  const entries = await readEntries<T>(key);
  return entries[0] ?? null;
};

export const loadLatestQuestionnaireResult = async () =>
  loadLatestEntry<QuestionnaireResultPayload>(STORAGE_KEYS.questionnaireResult);

export const loadLatestCoffeeProfile = async () =>
  loadLatestEntry<CoffeeProfilePayload>(STORAGE_KEYS.coffeeProfile);
