import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { fetchMe } from '../utils/apiClient';

type AuthUser = {
  firebase_uid: string;
  email: string | null;
  display_name: string | null;
  photo_url: string | null;
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
      const data = await fetchMe();
      const payload = data?.profile ?? data;

      if (payload?.firebase_uid) {
        setUser({
          firebase_uid: String(payload.firebase_uid),
          email: payload.email ?? null,
          display_name: payload.display_name ?? null,
          photo_url: payload.photo_url ?? null,
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
