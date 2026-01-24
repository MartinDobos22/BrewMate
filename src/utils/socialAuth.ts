import { GoogleSignin } from '@react-native-google-signin/google-signin';
import appleAuth from '@invertase/react-native-apple-authentication';

import { DEFAULT_API_HOST } from './api';

let googleConfigured = false;

const configureGoogle = () => {
  if (googleConfigured) {
    return;
  }

  if (!process.env.FIREBASE_WEB_CLIENT_ID) {
    throw new Error(
      'Chýba FIREBASE_WEB_CLIENT_ID. Skontroluj konfiguráciu Google Sign-In (Web client ID).',
    );
  }

  GoogleSignin.configure({
    webClientId: process.env.FIREBASE_WEB_CLIENT_ID,
  });
  googleConfigured = true;
};

export const signInWithGoogle = async () => {
  try {
    configureGoogle();
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    await GoogleSignin.signIn();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Google sign-in failed.';

    if (message.includes('DEVELOPER_ERROR')) {
      throw new Error(
        'Google prihlásenie je nesprávne nakonfigurované. Skontroluj SHA-1 certifikát a OAuth klienta v Google/Firebase konzole.',
      );
    }

    throw error;
  }

  const { idToken } = await GoogleSignin.getTokens();

  if (!idToken) {
    throw new Error('Google sign-in failed: missing id token.');
  }

  const response = await fetch(`${DEFAULT_API_HOST}/auth/google`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({
      idToken,
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || 'Google sign-in failed.');
  }

  if (!data?.user) {
    throw new Error('Google sign-in failed: missing user data.');
  }

  return data.user;
};

export const signInWithApple = async () => {
  const appleAuthRequestResponse = await appleAuth.performRequest({
    requestedOperation: appleAuth.Operation.LOGIN,
    requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
  });

  const { identityToken, nonce } = appleAuthRequestResponse;

  if (!identityToken) {
    throw new Error('Apple sign-in failed: missing identity token.');
  }

  const response = await fetch(`${DEFAULT_API_HOST}/auth/apple`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({
      idToken: identityToken,
      nonce,
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || 'Apple sign-in failed.');
  }

  if (!data?.user) {
    throw new Error('Apple sign-in failed: missing user data.');
  }

  return data.user;
};
