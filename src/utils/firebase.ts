import { FirebaseApp, getApps, initializeApp } from 'firebase/app';

let cachedApp: FirebaseApp | null = null;

const getFirebaseConfig = () => {
  const apiKey = process.env.FIREBASE_API_KEY?.trim()
    || process.env.EXPO_PUBLIC_FIREBASE_API_KEY?.trim();
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const appId = process.env.FIREBASE_APP_ID?.trim();
  const authDomain = process.env.FIREBASE_AUTH_DOMAIN?.trim()
    || (projectId ? `${projectId}.firebaseapp.com` : undefined);

  if (!apiKey || !projectId || !appId) {
    throw new Error('Chýba FIREBASE_API_KEY, FIREBASE_PROJECT_ID alebo FIREBASE_APP_ID.');
  }

  return {
    apiKey,
    projectId,
    appId,
    authDomain,
  };
};

export const getFirebaseApp = () => {
  if (cachedApp) {
    return cachedApp;
  }

  const existingApps = getApps();
  if (existingApps.length > 0) {
    cachedApp = existingApps[0];
    return cachedApp;
  }

  cachedApp = initializeApp(getFirebaseConfig());
  return cachedApp;
};
