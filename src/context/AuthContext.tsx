import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  initializing: true,
  clearSession: async () => {},
});

const AUTH_STORAGE_KEYS = ['authToken', 'authSession'];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [initializing, setInitializing] = useState(true);

  const clearSession = async () => {
    try {
      await AsyncStorage.multiRemove(AUTH_STORAGE_KEYS);
    } catch (error) {
      console.warn('[Auth] Failed to clear local auth storage.', error);
    } finally {
      setUser(null);
    }
  };

  useEffect(() => {
    let isActive = true;

    const loadSession = async () => {
      setInitializing(true);

      try {
        const response = await fetch(`${DEFAULT_API_HOST}/auth/me`, {
          credentials: 'include',
        });

        if (!response.ok || response.status === 204) {
          if (isActive) {
            setUser(null);
          }
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
      } catch (error) {
        if (isActive) {
          setUser(null);
        }
      } finally {
        if (isActive) {
          setInitializing(false);
        }
      }
    };

    loadSession();

    return () => {
      isActive = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      initializing,
      clearSession,
    }),
    [user, initializing],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
