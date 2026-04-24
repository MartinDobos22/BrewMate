import { useCallback, useState } from 'react';

import { apiFetch, DEFAULT_API_HOST } from '../utils/api';
import { MatchResult } from './useCoffeeMatch';

export type FeedbackState = 'idle' | 'submitting' | 'saved' | 'error';

type UseMatchFeedbackOutput = {
  ratingValue: number | null;
  state: FeedbackState;
  error: string;
  submit: (rating: number) => Promise<void>;
};

// Rating state + submit to `POST /api/coffee-scans/:id/match-feedback`. The
// scan id is nullable because the rating UI renders before `useAutoSaveScan`
// has a chance to write the scan — the submit call becomes a no-op until the
// id is available.
export function useMatchFeedback(
  scanId: string | null,
  matchResult: MatchResult | null,
): UseMatchFeedbackOutput {
  const [ratingValue, setRatingValue] = useState<number | null>(null);
  const [state, setState] = useState<FeedbackState>('idle');
  const [error, setError] = useState('');

  const submit = useCallback(
    async (rating: number) => {
      if (!scanId || !matchResult || state === 'submitting' || state === 'saved') {
        return;
      }
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
        setState('saved');
      } catch (err) {
        setState('error');
        setError(err instanceof Error ? err.message : 'Nepodarilo sa uložiť hodnotenie.');
      }
    },
    [matchResult, scanId, state],
  );

  return { ratingValue, state, error, submit };
}
