import { onCall } from 'firebase-functions/v2/https';
import { onRequest } from 'firebase-functions/v2/https';
import { onUserCreated, onUserDeleted } from 'firebase-functions/v2/auth';
import { logger } from 'firebase-functions';

const backendBaseUrl = process.env.BACKEND_BASE_URL ?? '';
const internalSecret = process.env.INTERNAL_SHARED_SECRET ?? '';

const requireEnv = (value: string, name: string) => {
  if (!value) {
    throw new Error(`Missing env: ${name}`);
  }
  return value;
};

const callBackend = async (path: string, payload: Record<string, unknown>) => {
  const url = `${requireEnv(backendBaseUrl, 'BACKEND_BASE_URL')}${path}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Secret': requireEnv(internalSecret, 'INTERNAL_SHARED_SECRET'),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Backend error ${response.status}: ${body}`);
  }
};

const withRetry = async (fn: () => Promise<void>, maxAttempts = 3) => {
  let attempt = 0;
  let delayMs = 500;

  while (attempt < maxAttempts) {
    try {
      await fn();
      return;
    } catch (error) {
      attempt += 1;
      logger.warn('Retrying backend call', { attempt, error });
      if (attempt >= maxAttempts) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs *= 2;
    }
  }
};

export const syncUserOnCreate = onUserCreated(async (event) => {
  const user = event.data;
  await withRetry(() =>
    callBackend('/internal/firebase/onCreate', {
      uid: user.uid,
      email: user.email,
      phone_number: user.phoneNumber,
      displayName: user.displayName,
      photoURL: user.photoURL,
      provider: user.providerData?.[0]?.providerId ?? null,
      claims: user.customClaims ?? null,
    }),
  );
});

export const syncUserOnDelete = onUserDeleted(async (event) => {
  const user = event.data;
  await withRetry(() => callBackend('/internal/firebase/onDelete', { uid: user.uid }));
});

// Optional health endpoint for debugging
export const health = onRequest((_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Optional callable test
export const ping = onCall(() => ({ ok: true }));
