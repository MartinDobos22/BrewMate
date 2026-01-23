import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { DEFAULT_API_HOST } from '../utils/api';

type AuthUser = {
  id: string;
  email: string;
  name: string | null;
};

type AuthContextValue = {
  user: AuthUser | null;
  initializing: boolean;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  initializing: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [initializing, setInitializing] = useState(true);

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
    }),
    [user, initializing],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
