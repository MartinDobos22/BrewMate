import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import {
  Auth,
  getAuth,
  getReactNativePersistence,
  initializeAuth,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Config from 'react-native-config';

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;


console.log("Firebase config:", Config.FIREBASE_API_KEY, Config.FIREBASE_PROJECT_ID, Config.FIREBASE_APP_ID, Config.FIREBASE_AUTH_DOMAIN);


const getFirebaseConfig = () => {
  const apiKey = Config.FIREBASE_API_KEY?.trim()
    || Config.EXPO_PUBLIC_FIREBASE_API_KEY?.trim();
  const projectId = Config.FIREBASE_PROJECT_ID?.trim();
  const appId = Config.FIREBASE_APP_ID?.trim();
  const authDomain = Config.FIREBASE_AUTH_DOMAIN?.trim()
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

export const getFirebaseAuth = () => {
  if (cachedAuth) {
    return cachedAuth;
  }

  const app = getFirebaseApp();

  try {
    cachedAuth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (error) {
    cachedAuth = getAuth(app);
  }

  return cachedAuth;
};
