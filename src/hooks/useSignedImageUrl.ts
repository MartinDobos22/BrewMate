import { useCallback, useEffect, useRef, useState } from 'react';

import { apiFetch, DEFAULT_API_HOST } from '../utils/api';

type ImageEndpointPayload = {
  imageBase64?: string;
  url?: string;
  expiresIn?: number;
  contentType?: string | null;
};

type CacheEntry = {
  uri: string;
  expiresAt: number; // epoch ms; Infinity for inline base64
};

const cache = new Map<string, CacheEntry>();
const REFRESH_LEEWAY_MS = 30_000;

export type UseSignedImageUrlResult = {
  uri: string | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  handleImageError: () => void;
};

export const clearSignedImageUrlCache = (userCoffeeId?: string) => {
  if (userCoffeeId) cache.delete(userCoffeeId);
  else cache.clear();
};

const buildBase64Uri = (base64: string, contentType: string | null | undefined) => {
  if (base64.startsWith('data:')) return base64;
  const ct = contentType || 'image/jpeg';
  return `data:${ct};base64,${base64}`;
};

export const useSignedImageUrl = (
  userCoffeeId: string | null | undefined,
): UseSignedImageUrlResult => {
  const [uri, setUri] = useState<string | null>(() => {
    if (!userCoffeeId) return null;
    const hit = cache.get(userCoffeeId);
    return hit && hit.expiresAt > Date.now() + REFRESH_LEEWAY_MS ? hit.uri : null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const fetchUrl = useCallback(async () => {
    if (!userCoffeeId) return;
    if (inFlight.current) return inFlight.current;

    setLoading(true);
    setError(null);

    const promise = (async () => {
      try {
        const response = await apiFetch(
          `${DEFAULT_API_HOST}/api/user-coffee/${userCoffeeId}/image`,
          { method: 'GET', credentials: 'include' },
          { feature: 'CoffeeInventory', action: 'image-load' },
        );
        const payload = (await response.json().catch(() => null)) as ImageEndpointPayload | null;
        if (!response.ok || !payload) {
          throw new Error('Nepodarilo sa načítať fotku.');
        }

        let nextUri: string | null = null;
        let expiresAt = Number.POSITIVE_INFINITY;

        if (typeof payload.imageBase64 === 'string' && payload.imageBase64.length > 0) {
          nextUri = buildBase64Uri(payload.imageBase64, payload.contentType ?? null);
        } else if (typeof payload.url === 'string' && payload.url.length > 0) {
          nextUri = payload.url;
          const ttlSec = typeof payload.expiresIn === 'number' ? payload.expiresIn : 0;
          if (ttlSec > 0) expiresAt = Date.now() + ttlSec * 1000;
        }

        if (!nextUri) {
          throw new Error('Fotka etikety nie je dostupná.');
        }

        cache.set(userCoffeeId, { uri: nextUri, expiresAt });
        if (mounted.current) setUri(nextUri);
      } catch (err) {
        cache.delete(userCoffeeId);
        if (mounted.current) {
          setUri(null);
          setError(err instanceof Error ? err.message : 'Nepodarilo sa načítať fotku.');
        }
      } finally {
        if (mounted.current) setLoading(false);
        inFlight.current = null;
      }
    })();

    inFlight.current = promise;
    return promise;
  }, [userCoffeeId]);

  useEffect(() => {
    if (!userCoffeeId) {
      setUri(null);
      return;
    }
    const hit = cache.get(userCoffeeId);
    if (hit && hit.expiresAt > Date.now() + REFRESH_LEEWAY_MS) {
      setUri(hit.uri);
      return;
    }
    fetchUrl().catch(() => {});
  }, [userCoffeeId, fetchUrl]);

  const handleImageError = useCallback(() => {
    if (!userCoffeeId) return;
    cache.delete(userCoffeeId);
    fetchUrl().catch(() => {});
  }, [userCoffeeId, fetchUrl]);

  return {
    uri,
    loading,
    error,
    refetch: fetchUrl,
    handleImageError,
  };
};
