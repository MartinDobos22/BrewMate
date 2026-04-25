import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'scansWithoutQuestionnaire';

// Tracks how many scans the user has completed without filling in the taste
// questionnaire. Used by `OcrResultScreen` to escalate the questionnaire CTA
// from a soft suggestion to a sticky banner after the threshold is hit.

export const SCAN_WITHOUT_QUESTIONNAIRE_THRESHOLD = 2;

export const getScansWithoutQuestionnaire = async (): Promise<number> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  } catch {
    return 0;
  }
};

export const incrementScansWithoutQuestionnaire = async (): Promise<number> => {
  const current = await getScansWithoutQuestionnaire();
  const next = current + 1;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, String(next));
  } catch {
    // Persistence failure is non-fatal — the counter resets next launch.
  }
  return next;
};

export const resetScansWithoutQuestionnaire = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // Swallow.
  }
};
