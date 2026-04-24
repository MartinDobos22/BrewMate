// Sentry for the React Native client. No-op in dev / without DSN.
// Requires native linking on iOS/Android (run `npx @sentry/wizard -i reactNative`
// once per platform); until then only JS errors are captured.

import Config from 'react-native-config';
import * as Sentry from '@sentry/react-native';

let initialized = false;

export const initSentry = (): void => {
  const dsn = Config.SENTRY_DSN_FRONTEND?.trim();
  if (!dsn || initialized) {
    return;
  }
  try {
    Sentry.init({
      dsn,
      environment: __DEV__ ? 'development' : (Config.SENTRY_ENVIRONMENT || 'production'),
      tracesSampleRate: __DEV__ ? 0 : Number(Config.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
      enableAutoSessionTracking: true,
      debug: false,
    });
    initialized = true;
  } catch (err) {
    // Swallow — missing native module in dev should not crash the app.
    console.warn('[Sentry] init failed', err);
  }
};

export const captureException = (error: unknown, context?: Record<string, unknown>): void => {
  if (!initialized) {
    return;
  }
  Sentry.captureException(error, context ? { extra: context } : undefined);
};

export const setCorrelationId = (correlationId: string): void => {
  if (!initialized) {
    return;
  }
  try {
    Sentry.setTag('correlation_id', correlationId);
  } catch {
    // Native bridge not linked — tag silently skipped.
  }
};

export const sentryEnabled = (): boolean => initialized;
