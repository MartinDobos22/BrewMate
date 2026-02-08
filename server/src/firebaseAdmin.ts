import admin from 'firebase-admin';

import { config, requireEnv } from './config';

const projectId = requireEnv(config.firebaseProjectId, 'FIREBASE_PROJECT_ID');

const initializeFirebase = () => {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  if (config.firebaseCredentialsJson) {
    const parsed = JSON.parse(config.firebaseCredentialsJson) as admin.ServiceAccount;
    return admin.initializeApp({
      credential: admin.credential.cert(parsed),
      projectId,
    });
  }

  return admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId,
  });
};

initializeFirebase();

export const firebaseAdmin = admin;
export const firebaseProjectId = projectId;
