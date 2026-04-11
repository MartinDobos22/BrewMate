import { useCallback, useState } from 'react';

import { useAuth } from '../context/AuthContext';
import { apiFetch, DEFAULT_API_HOST } from '../utils/api';

type LogoutState = 'idle' | 'pending' | 'error';

/**
 * Encapsulates the logout flow so screens don't duplicate the same
 * fetch-then-clear-session logic. Also exposes a pending state that UI can
 * use to disable logout buttons while the request is in flight.
 */
export function useLogout() {
  const { clearSession } = useAuth();
  const [state, setState] = useState<LogoutState>('idle');

  const logout = useCallback(async () => {
    setState('pending');
    try {
      const response = await apiFetch(
        `${DEFAULT_API_HOST}/auth/logout`,
        {
          method: 'POST',
          credentials: 'include',
        },
        {
          feature: 'Auth',
          action: 'logout',
        },
      );

      if (!response.ok) {
        console.warn('[Auth] Logout failed.', response.status);
        setState('error');
        return false;
      }

      await clearSession();
      setState('idle');
      return true;
    } catch (error) {
      console.warn('[Auth] Logout failed.', error);
      // Always clear local session even if the network call failed — the user
      // explicitly asked to log out and we'd rather err on the side of
      // forgetting credentials locally.
      await clearSession();
      setState('error');
      return false;
    }
  }, [clearSession]);

  return { logout, isLoggingOut: state === 'pending' };
}
