import { useCallback, useEffect, useMemo, useState } from 'react';

import { HOME_RECIPE_HISTORY_DAYS, LOW_STOCK_THRESHOLD_G } from '../constants/business';
import { apiFetch, DEFAULT_API_HOST } from '../utils/api';

export type InventoryStatus = 'active' | 'empty' | 'archived';

export type HomeInventoryItem = {
  id: string;
  rawText: string | null;
  correctedText: string | null;
  coffeeProfile: {
    origin?: string;
    roastLevel?: string;
    flavorNotes?: string[];
  };
  remainingG: number | null;
  status: InventoryStatus;
  openedAt: string | null;
  createdAt: string;
};

export type HomeRecipeItem = {
  id: string;
  title: string;
  method: string;
  likeScore: number;
  createdAt: string;
};

export type DashboardState = 'idle' | 'loading' | 'ready' | 'error';

type InventoryTotals = {
  active: HomeInventoryItem[];
  empty: HomeInventoryItem[];
  archived: HomeInventoryItem[];
  lowStock: HomeInventoryItem[];
  gramsAvailable: number;
};

type UseHomeDashboardResult = {
  state: DashboardState;
  error: string;
  inventoryItems: HomeInventoryItem[];
  recipes: HomeRecipeItem[];
  inventoryTotals: InventoryTotals;
  reload: () => Promise<void>;
};

/**
 * Loads the data the Home screen needs (active inventory + recent recipes) and
 * exposes aggregated totals so the UI layer doesn't have to recalculate them.
 *
 * Using a dedicated hook keeps HomeScreen focused purely on rendering.
 */
export function useHomeDashboard(): UseHomeDashboardResult {
  const [inventoryItems, setInventoryItems] = useState<HomeInventoryItem[]>([]);
  const [recipes, setRecipes] = useState<HomeRecipeItem[]>([]);
  const [state, setState] = useState<DashboardState>('idle');
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setState('loading');
    setError('');

    try {
      const [inventoryResponse, recipesResponse] = await Promise.all([
        apiFetch(
          `${DEFAULT_API_HOST}/api/user-coffee?includeInactive=true`,
          { method: 'GET', credentials: 'include' },
          { feature: 'HomeDashboard', action: 'load-inventory' },
        ),
        apiFetch(
          `${DEFAULT_API_HOST}/api/coffee-recipes?days=${HOME_RECIPE_HISTORY_DAYS}`,
          { method: 'GET', credentials: 'include' },
          { feature: 'HomeDashboard', action: 'load-recipes' },
        ),
      ]);

      const inventoryPayload = await inventoryResponse.json().catch(() => null);
      const recipesPayload = await recipesResponse.json().catch(() => null);

      if (!inventoryResponse.ok) {
        throw new Error(
          inventoryPayload?.error || 'Nepodarilo sa načítať inventár pre home page.',
        );
      }

      if (!recipesResponse.ok) {
        throw new Error(
          recipesPayload?.error || 'Nepodarilo sa načítať recepty pre home page.',
        );
      }

      setInventoryItems(Array.isArray(inventoryPayload?.items) ? inventoryPayload.items : []);
      setRecipes(Array.isArray(recipesPayload?.items) ? recipesPayload.items : []);
      setState('ready');
    } catch (loadError) {
      setState('error');
      setError(
        loadError instanceof Error ? loadError.message : 'Nepodarilo sa načítať dashboard dáta.',
      );
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const inventoryTotals = useMemo<InventoryTotals>(() => {
    const active = inventoryItems.filter(item => item.status === 'active');
    const empty = inventoryItems.filter(item => item.status === 'empty');
    const archived = inventoryItems.filter(item => item.status === 'archived');
    const lowStock = active.filter(
      item =>
        typeof item.remainingG === 'number' &&
        item.remainingG > 0 &&
        item.remainingG <= LOW_STOCK_THRESHOLD_G,
    );

    const gramsAvailable = active.reduce(
      (sum, item) => sum + (typeof item.remainingG === 'number' ? item.remainingG : 0),
      0,
    );

    return { active, empty, archived, lowStock, gramsAvailable };
  }, [inventoryItems]);

  return { state, error, inventoryItems, recipes, inventoryTotals, reload };
}
