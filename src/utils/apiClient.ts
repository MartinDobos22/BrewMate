import { apiFetch, DEFAULT_API_HOST } from './api';
import { getFirebaseAuth } from './firebase';

const getIdToken = async (forceRefresh = false) => {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Firebase user is not signed in.');
  }
  return user.getIdToken(forceRefresh);
};

const authorizedFetch = async (path: string, init: RequestInit = {}, retry = true) => {
  const token = await getIdToken(false);
  const response = await apiFetch(`${DEFAULT_API_HOST}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401 && retry) {
    const refreshedToken = await getIdToken(true);
    return apiFetch(`${DEFAULT_API_HOST}${path}`, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        Authorization: `Bearer ${refreshedToken}`,
      },
    });
  }

  return response;
};

export const syncUser = async () => {
  const response = await authorizedFetch('/api/users/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    throw new Error('Failed to sync user profile.');
  }

  return response.json();
};

export const fetchMe = async () => {
  const response = await authorizedFetch('/api/me');
  if (!response.ok) {
    throw new Error('Failed to fetch profile.');
  }
  return response.json();
};

export const updateMe = async (payload: { display_name?: string; photo_url?: string }) => {
  const response = await authorizedFetch('/api/me', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('Failed to update profile.');
  }

  return response.json();
};
