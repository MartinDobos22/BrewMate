import { useCallback, useState } from 'react';

import { apiFetch, DEFAULT_API_HOST } from '../utils/api';
import { MatchResult } from './useCoffeeMatch';

export type FeedbackState = 'idle' | 'submitting' | 'saved' | 'error';

type UseMatchFeedbackOutput = {
  ratingValue: number | null;
  state: FeedbackState;
  error: string;
  lastSavedAt: string | null;
  submit: (rating: number) => Promise<void>;
};

// Rating state + submit to `POST /api/coffee-scans/:id/match-feedback`. The
// scan id is nullable because the rating UI renders before `useAutoSaveScan`
// has a chance to write the scan — the submit call becomes a no-op until the
// id is available.
//
// After P5 the rating is editable: re-tapping a different star overwrites
// the previous row via ON CONFLICT DO UPDATE on the server. The only hard
// block is "currently submitting the same request" (prevents double-tap
// spam); once the in-flight request resolves, the user may tap again.
export function useMatchFeedback(
  scanId: string | null,
  matchResult: MatchResult | null,
): UseMatchFeedbackOutput {
  const [ratingValue, setRatingValue] = useState<number | null>(null);
  const [state, setState] = useState<FeedbackState>('idle');
  const [error, setError] = useState('');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const submit = useCallback(
    async (rating: number) => {
      if (!scanId || !matchResult || state === 'submitting') {
        return;
      }
      const previousRating = ratingValue;
      setState('submitting');
      setError('');
      setRatingValue(rating);
      try {
        const response = await apiFetch(
          `${DEFAULT_API_HOST}/api/coffee-scans/${scanId}/match-feedback`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              predictedScore: Math.round(matchResult.matchScore),
              predictedTier: matchResult.matchTier,
              actualRating: rating,
              algorithmVersion: matchResult.algorithmVersion ?? null,
            }),
          },
          { feature: 'OcrResult', action: 'match-feedback' },
        );
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.error || 'Nepodarilo sa uložiť hodnotenie.');
        }
        const savedAt = payload?.feedback?.createdAt;
        setLastSavedAt(typeof savedAt === 'string' ? savedAt : new Date().toISOString());
        setState('saved');
      } catch (err) {
        setRatingValue(previousRating);
        setState('error');
        setError(err instanceof Error ? err.message : 'Nepodarilo sa uložiť hodnotenie.');
      }
    },
    [matchResult, ratingValue, scanId, state],
  );

  return { ratingValue, state, error, lastSavedAt, submit };
}
