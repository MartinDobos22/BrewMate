import { useEffect, useState } from 'react';

import {
  loadLatestQuestionnaireResult,
  QuestionnaireResultPayload,
  SaveEntry,
  saveQuestionnaireResult,
} from '../utils/localSave';
import { apiFetch, DEFAULT_API_HOST } from '../utils/api';
import { CoffeeProfile, MatchTier } from '../utils/tasteVector';

export type MatchResult = {
  matchScore: number;
  matchTier: MatchTier;
  confidence: number;
  baristaSummary: string;
  laymanSummary: string;
  keyMatches: string[];
  keyConflicts: string[];
  suggestedAdjustments: string;
  adventureNote: string;
  algorithmVersion?: string;
};

export type MatchState = 'idle' | 'loading' | 'ready' | 'missing' | 'error';

type UseCoffeeMatchOutput = {
  state: MatchState;
  result: MatchResult | null;
  error: string;
  questionnaire: SaveEntry<QuestionnaireResultPayload> | null;
};

// Loads the latest questionnaire (local → server fallback) and POSTs it with
// the coffee profile to `/api/coffee-match`. Hook encapsulates the whole
// async state machine so the screen only has to render based on `state`.
export function useCoffeeMatch(coffeeProfile: CoffeeProfile): UseCoffeeMatchOutput {
  const [state, setState] = useState<MatchState>('idle');
  const [result, setResult] = useState<MatchResult | null>(null);
  const [error, setError] = useState('');
  const [questionnaire, setQuestionnaire] = useState<
    SaveEntry<QuestionnaireResultPayload> | null
  >(null);

  useEffect(() => {
    let isActive = true;

    const run = async () => {
      if (!isActive) return;
      setState('loading');
      setError('');
      setResult(null);
      setQuestionnaire(null);

      let latest = await loadLatestQuestionnaireResult();
      if (!isActive) return;

      if (!latest?.payload) {
        try {
          const remoteResponse = await apiFetch(
            `${DEFAULT_API_HOST}/api/user-questionnaire`,
            { method: 'GET', credentials: 'include' },
            { feature: 'OcrResult', action: 'load-questionnaire' },
          );
          if (!isActive) return;
          if (remoteResponse.ok) {
            const remotePayload = await remoteResponse.json().catch(() => null);
            const remote = remotePayload?.questionnaire;
            if (remote?.answers && remote?.profile) {
              const payload: QuestionnaireResultPayload = {
                answers: remote.answers,
                profile: remote.profile,
              };
              try {
                latest = await saveQuestionnaireResult(payload);
              } catch (cacheError) {
                console.warn(
                  '[useCoffeeMatch] Failed to cache server questionnaire locally',
                  cacheError,
                );
                latest = {
                  id: String(remote.id ?? `remote-${Date.now()}`),
                  savedAt: remote.savedAt ?? new Date().toISOString(),
                  payload,
                };
              }
            }
          }
        } catch (remoteError) {
          console.warn('[useCoffeeMatch] Server questionnaire fallback failed', remoteError);
        }
      }

      if (!isActive) return;
      if (!latest?.payload) {
        setState('missing');
        return;
      }

      setQuestionnaire(latest);

      try {
        const response = await apiFetch(
          `${DEFAULT_API_HOST}/api/coffee-match`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              questionnaire: latest.payload,
              coffeeProfile,
            }),
          },
          { feature: 'OcrResult', action: 'coffee-match' },
        );
        const payload = await response.json().catch(() => null);
        if (!isActive) return;

        if (!response.ok) {
          setError(payload?.error || 'Nepodarilo sa porovnať kávu s dotazníkom.');
          setState('error');
          return;
        }
        if (!payload?.match) {
          setError('Odpoveď servera neobsahovala výsledok porovnania.');
          setState('error');
          return;
        }
        setResult(payload.match as MatchResult);
        setState('ready');
      } catch (matchErr) {
        if (!isActive) return;
        setError(
          matchErr instanceof Error
            ? matchErr.message
            : 'Nepodarilo sa porovnať kávu s dotazníkom.',
        );
        setState('error');
      }
    };

    run();

    return () => {
      isActive = false;
    };
  }, [coffeeProfile]);

  return { state, result, error, questionnaire };
}
