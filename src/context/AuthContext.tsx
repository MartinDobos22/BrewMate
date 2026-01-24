import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { DEFAULT_API_HOST } from '../utils/api';

type AuthUser = {
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

const AuthContext = createContext<AuthContextValue>({
  user: null,
  initializing: true,
  clearSession: async () => {},
  refreshSession: async () => {},
});

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
      const response = await fetch(`${DEFAULT_API_HOST}/auth/me`, {
        credentials: 'include',
      });

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

export function useAuth() {
  return useContext(AuthContext);
}
