import { GoogleSignin } from '@react-native-google-signin/google-signin';
import appleAuth from '@invertase/react-native-apple-authentication';
import Config from 'react-native-config';

import { DEFAULT_API_HOST } from './api';

let googleConfigured = false;

const configureGoogle = () => {
  if (googleConfigured) {
    return;
  }

  GoogleSignin.configure({
    webClientId: Config.FIREBASE_WEB_CLIENT_ID,
  });
  googleConfigured = true;
};

export const signInWithGoogle = async () => {
  configureGoogle();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const { idToken } = await GoogleSignin.signIn();

  if (!idToken) {
    throw new Error('Google sign-in failed: missing id token.');
  }

  const response = await fetch(`${DEFAULT_API_HOST}/auth/google`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      idToken,
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || 'Google sign-in failed.');
  }

  if (!data?.session && !data?.token) {
    throw new Error('Google sign-in failed: missing session data.');
  }

  return data;
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
    body: JSON.stringify({
      idToken: identityToken,
      nonce,
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || 'Apple sign-in failed.');
  }

  if (!data?.session && !data?.token) {
    throw new Error('Apple sign-in failed: missing session data.');
  }

  return data;
};
