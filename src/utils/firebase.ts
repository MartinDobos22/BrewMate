import { FirebaseOptions, getApps, initializeApp } from 'firebase/app';
import { Auth, inMemoryPersistence, initializeAuth } from 'firebase/auth';

import Config from 'react-native-config';

const configSource = Config as Record<string, string | undefined>;

const resolveEnv = (key: string) => {
  const value = configSource[key] ?? process.env[key];

  if (!value || value === 'undefined' || value === 'null') {
    return undefined;
  }

  return value;
};

const firebaseConfig: Partial<FirebaseOptions> = {
  apiKey: resolveEnv('FIREBASE_API_KEY'),
  authDomain: resolveEnv('FIREBASE_AUTH_DOMAIN'),
  projectId: resolveEnv('FIREBASE_PROJECT_ID'),
  storageBucket: resolveEnv('FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: resolveEnv('FIREBASE_MESSAGING_SENDER_ID'),
  appId: resolveEnv('FIREBASE_APP_ID'),
};

const missingConfig = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingConfig.length) {
  console.warn(
    `Missing Firebase config values: ${missingConfig.join(', ')}. Check your FIREBASE_* environment variables.`,
  );
}

const app = getApps().length
  ? getApps()[0]
  : missingConfig.length
    ? null
    : initializeApp(firebaseConfig as FirebaseOptions);

let auth: Auth | null = null;

if (app) {
  try {
    auth = initializeAuth(app, {
      persistence: inMemoryPersistence,
    });
  } catch (error) {
    console.error(
      'Failed to initialize Firebase auth. Verify your FIREBASE_* environment variables.',
      error,
    );
  }
}

export { auth };

export const getAuthOrThrow = () => {
  if (!auth) {
    throw new Error('Firebase auth is not configured. Verify FIREBASE_* environment variables.');
  }

  return auth;
};

export default app;
