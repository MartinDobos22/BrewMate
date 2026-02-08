export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID ?? '',
  firebaseCredentialsJson: process.env.FIREBASE_ADMIN_CREDENTIALS_JSON ?? '',
  internalSharedSecret: process.env.INTERNAL_SHARED_SECRET ?? '',
  databaseUrl: process.env.DATABASE_URL ?? '',
};

export const requireEnv = (value: string, name: string) => {
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
};
