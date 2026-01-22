import { getApps, initializeApp } from 'firebase/app';
import { Auth, inMemoryPersistence, initializeAuth } from 'firebase/auth';

import Config from 'react-native-config';

const firebaseConfig = {
  apiKey: Config.FIREBASE_API_KEY,
  authDomain: Config.FIREBASE_AUTH_DOMAIN,
  projectId: Config.FIREBASE_PROJECT_ID,
  storageBucket: Config.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: Config.FIREBASE_MESSAGING_SENDER_ID,
  appId: Config.FIREBASE_APP_ID,
};

const missingConfig = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingConfig.length) {
  console.warn(
    `Missing Firebase config values: ${missingConfig.join(', ')}. Check your FIREBASE_* environment variables.`,
  );
}

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

let auth: Auth | null = null;

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

export { auth };

export const getAuthOrThrow = () => {
  if (!auth) {
    throw new Error('Firebase auth is not configured. Verify FIREBASE_* environment variables.');
  }

  return auth;
};

export default app;
