import { GoogleSignin } from '@react-native-google-signin/google-signin';
import appleAuth from '@invertase/react-native-apple-authentication';
import { GoogleAuthProvider, OAuthProvider, signInWithCredential } from 'firebase/auth';

import { apiFetch, DEFAULT_API_HOST } from './api';
import Config from 'react-native-config';
import { getFirebaseAuth } from './firebase';

let googleConfigured = false;

const configureGoogle = () => {
  if (googleConfigured) {
    return;
  }

  if (!Config.FIREBASE_WEB_CLIENT_ID) {
    throw new Error(
      'Chýba FIREBASE_WEB_CLIENT_ID. Skontroluj konfiguráciu Google Sign-In (Web client ID).',
    );
  }

  GoogleSignin.configure({
    webClientId: Config.FIREBASE_WEB_CLIENT_ID,
  });
  googleConfigured = true;
};

export const signInWithGoogle = async () => {
  const auth = getFirebaseAuth();

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

  const { idToken, accessToken } = await GoogleSignin.getTokens();

  if (!idToken) {
    throw new Error('Google sign-in failed: missing id token.');
  }

  const googleCredential = GoogleAuthProvider.credential(idToken, accessToken);
  const googleUser = await signInWithCredential(auth, googleCredential);
  const firebaseIdToken = await googleUser.user.getIdToken();

  const response = await apiFetch(
    `${DEFAULT_API_HOST}/auth/google`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        idToken: firebaseIdToken,
      }),
    },
    {
      feature: 'SocialAuth',
      provider: 'google',
    },
  );

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
  const auth = getFirebaseAuth();

  const appleAuthRequestResponse = await appleAuth.performRequest({
    requestedOperation: appleAuth.Operation.LOGIN,
    requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
  });

  const { identityToken, nonce } = appleAuthRequestResponse;

  if (!identityToken) {
    throw new Error('Apple sign-in failed: missing identity token.');
  }

  const appleProvider = new OAuthProvider('apple.com');
  const appleCredential = appleProvider.credential({
    idToken: identityToken,
    rawNonce: nonce ?? undefined,
  });
  const appleUser = await signInWithCredential(auth, appleCredential);
  const firebaseIdToken = await appleUser.user.getIdToken();

  const response = await apiFetch(
    `${DEFAULT_API_HOST}/auth/apple`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        idToken: firebaseIdToken,
        nonce,
      }),
    },
    {
      feature: 'SocialAuth',
      provider: 'apple',
    },
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || 'Apple sign-in failed.');
  }

  if (!data?.user) {
    throw new Error('Apple sign-in failed: missing user data.');
  }

  return data.user;
};
