import React, { createContext, useContext, useMemo, useState } from 'react';

type AuthContextValue = {
  user: null;
  initializing: boolean;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  initializing: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user] = useState<null>(null);
  const [initializing] = useState(false);

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
