import { GoogleSignin } from '@react-native-google-signin/google-signin';
import appleAuth from '@invertase/react-native-apple-authentication';
import { GoogleAuthProvider, OAuthProvider, signInWithCredential } from 'firebase/auth';
import Config from 'react-native-config';

import { getAuthOrThrow } from './firebase';

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

  const credential = GoogleAuthProvider.credential(idToken);
  const authInstance = getAuthOrThrow();
  return signInWithCredential(authInstance, credential);
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

  const provider = new OAuthProvider('apple.com');
  const credential = provider.credential({
    idToken: identityToken,
    rawNonce: nonce,
  });

  const authInstance = getAuthOrThrow();
  return signInWithCredential(authInstance, credential);
};
