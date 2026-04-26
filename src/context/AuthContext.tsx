import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { apiFetch, DEFAULT_API_HOST, setOnAuthError } from '../utils/api';

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
};

type AuthContextValue = {
  user: AuthUser | null;
  initializing: boolean;
  clearSession: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

// Using `undefined` as default so `useAuth()` can throw when the context is
// consumed outside of `<AuthProvider>`. This avoids the silent-failure trap of
// no-op async stubs that previously masked configuration errors.
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [initializing, setInitializing] = useState(true);

  const clearSession = useCallback(async () => {
    setUser(null);
  }, []);

  const loadSession = useCallback(async (showLoader = false) => {
    if (showLoader) {
      setInitializing(true);
    }

    try {
      const response = await apiFetch(
        `${DEFAULT_API_HOST}/auth/me`,
        {
          credentials: 'include',
        },
        {
          feature: 'Auth',
          action: 'me',
        },
      );

      if (!response.ok || response.status === 204) {
        setUser(null);
        return;
      }

      const data = await response.json();
      const payload = data?.user ?? data;

      if (payload?.id && payload?.email) {
        setUser({
          id: String(payload.id),
          email: String(payload.email),
          name: payload.name ?? null,
        });
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      if (showLoader) {
        setInitializing(false);
      }
    }
  }, []);

  const refreshSession = useCallback(async () => {
    await loadSession(false);
  }, [loadSession]);

  useEffect(() => {
    loadSession(true);
  }, [loadSession]);

  // Any backend `auth_error` (expired/invalid session cookie) collapses the
  // local user state, which flips AppNavigator to the AuthNavigator (Login).
  useEffect(() => {
    setOnAuthError(() => {
      clearSession().catch(() => {});
    });
    return () => setOnAuthError(null);
  }, [clearSession]);

  const value = useMemo(
    () => ({
      user,
      initializing,
      clearSession,
      refreshSession,
    }),
    [user, initializing, clearSession, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an <AuthProvider>.');
  }
  return context;
}
