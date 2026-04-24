import { useEffect, useState } from 'react';

import { apiFetch, DEFAULT_API_HOST } from '../utils/api';
import { CoffeeProfile } from '../utils/tasteVector';
import { MatchResult } from './useCoffeeMatch';

type Options = {
  enabled: boolean;
  rawText: string;
  correctedText: string;
  coffeeProfile: CoffeeProfile;
  matchResult: MatchResult | null;
};

// Persists a finished scan + verdict to `/api/coffee-scans` once the match
// is ready. Silent best-effort: failures log but never block the UI. The
// returned `scanId` is what feeds the rating endpoint in `useMatchFeedback`.
export function useAutoSaveScan({
  enabled,
  rawText,
  correctedText,
  coffeeProfile,
  matchResult,
}: Options): string | null {
  const [scanId, setScanId] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !matchResult || scanId) {
      return;
    }
    let cancelled = false;

    const persist = async () => {
      try {
        const response = await apiFetch(
          `${DEFAULT_API_HOST}/api/coffee-scans`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              rawText,
              correctedText,
              coffeeProfile,
              aiMatchResult: matchResult,
            }),
          },
          { feature: 'OcrResult', action: 'persist-scan' },
        );
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.scan?.id) {
          console.warn('[useAutoSaveScan] Failed to persist scan', payload?.error);
          return;
        }
        if (!cancelled) {
          setScanId(payload.scan.id as string);
        }
      } catch (err) {
        console.warn('[useAutoSaveScan] Network error', err);
      }
    };

    persist();

    return () => {
      cancelled = true;
    };
  }, [enabled, scanId, matchResult, coffeeProfile, correctedText, rawText]);

  return scanId;
}
