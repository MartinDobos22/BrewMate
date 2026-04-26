import { Platform } from 'react-native';
import Config from 'react-native-config';

import { setCorrelationId } from '../sentry';
import {
  API_VERSION,
  API_VERSION_REQUEST_HEADER,
  API_VERSION_RESPONSE_HEADER,
} from '../constants/apiVersion';

type ApiLogContext = Record<string, unknown>;

type SanitizedPayload =
  | Record<string, unknown>
  | unknown[]
  | string
  | number
  | boolean
  | null
  | undefined;

const LOCAL_API_HOST =
  Platform.select({
    android: 'http://10.0.2.2:3000',
    ios: 'http://localhost:3000',
    default: 'http://localhost:3000',
  }) ?? 'http://localhost:3000';

const RENDER_API_HOST = 'https://brewmate-fe.onrender.com';

export const DEFAULT_API_HOST =
  Config.EXPO_PUBLIC_API_HOST?.trim() || (__DEV__ ? LOCAL_API_HOST : RENDER_API_HOST);

const IMAGE_PAYLOAD_KEYS = /image|base64/i;
const SENSITIVE_KEYS = /password|token|secret/i;

const sanitizePayload = (payload: unknown): SanitizedPayload => {
  if (Array.isArray(payload)) {
    return payload.map((item) => sanitizePayload(item));
  }

  if (payload && typeof payload === 'object') {
    return Object.entries(payload).reduce<Record<string, unknown>>((acc, [key, value]) => {
      if (IMAGE_PAYLOAD_KEYS.test(key) && typeof value === 'string') {
        acc[key] = {
          omitted: true,
          length: value.length,
        };
        return acc;
      }
      if (SENSITIVE_KEYS.test(key) && typeof value === 'string') {
        acc[key] = {
          redacted: true,
        };
        return acc;
      }
      acc[key] = sanitizePayload(value);
      return acc;
    }, {});
  }

  return payload as SanitizedPayload;
};

type FetchHeaders = RequestInit['headers'];
type FetchBody = RequestInit['body'];

const getHeaderValue = (headers: FetchHeaders, name: string): string | null => {
  if (!headers) {
    return null;
  }
  if (headers instanceof Headers) {
    return headers.get(name);
  }
  if (Array.isArray(headers)) {
    const match = headers.find(([key]) => key.toLowerCase() === name.toLowerCase());
    return match ? match[1] : null;
  }
  return (headers as Record<string, string>)[name] || null;
};

const CORRELATION_HEADER = 'X-Correlation-Id';

const generateCorrelationId = (): string => {
  const cryptoObj = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (cryptoObj?.randomUUID) {
    return cryptoObj.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

const mergeHeaders = (existing: FetchHeaders, correlationId: string): FetchHeaders => {
  if (!existing) {
    return { [CORRELATION_HEADER]: correlationId };
  }
  if (existing instanceof Headers) {
    const cloned = new Headers(existing);
    if (!cloned.has(CORRELATION_HEADER)) {
      cloned.set(CORRELATION_HEADER, correlationId);
    }
    return cloned;
  }
  if (Array.isArray(existing)) {
    if (existing.some(([key]) => key.toLowerCase() === CORRELATION_HEADER.toLowerCase())) {
      return existing;
    }
    return [...existing, [CORRELATION_HEADER, correlationId]];
  }
  const asRecord = existing as Record<string, string>;
  const hasExisting = Object.keys(asRecord).some(
    key => key.toLowerCase() === CORRELATION_HEADER.toLowerCase(),
  );
  return hasExisting ? asRecord : { ...asRecord, [CORRELATION_HEADER]: correlationId };
};

const withApiVersionHeader = (headers: FetchHeaders): FetchHeaders => {
  const already = getHeaderValue(headers, API_VERSION_REQUEST_HEADER);
  if (already) {
    return headers ?? {};
  }
  if (!headers) {
    return { [API_VERSION_REQUEST_HEADER]: API_VERSION };
  }
  if (headers instanceof Headers) {
    const cloned = new Headers(headers);
    cloned.set(API_VERSION_REQUEST_HEADER, API_VERSION);
    return cloned;
  }
  if (Array.isArray(headers)) {
    return [...headers, [API_VERSION_REQUEST_HEADER, API_VERSION]];
  }
  return { ...(headers as Record<string, string>), [API_VERSION_REQUEST_HEADER]: API_VERSION };
};

let lastLoggedServerVersion: string | null = null;
const logServerVersionIfChanged = (serverVersion: string | null, url: string): void => {
  if (!serverVersion || serverVersion === lastLoggedServerVersion) {
    return;
  }
  lastLoggedServerVersion = serverVersion;
  if (serverVersion !== API_VERSION) {
    console.warn('[API] server version differs from client build', {
      clientVersion: API_VERSION,
      serverVersion,
      url,
    });
  }
};

const summarizeBody = (body: FetchBody): SanitizedPayload | null => {
  if (!body) {
    return null;
  }
  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body) as unknown;
      return sanitizePayload(parsed);
    } catch (error) {
      return {
        rawBodyLength: body.length,
        parseError: (error as Error).message,
      };
    }
  }

  if (body instanceof FormData) {
    return {
      bodyType: 'FormData',
    };
  }

  return {
    bodyType: typeof body,
  };
};

export type ApiErrorBody = {
  error: string;
  code?: string;
  retryable?: boolean;
  details?: unknown;
};

export class ApiError extends Error {
  code: string;
  retryable: boolean;
  status: number;
  details: unknown;

  constructor(body: ApiErrorBody, status: number) {
    super(body.error);
    this.name = 'ApiError';
    this.code = body.code || 'unknown';
    this.retryable = Boolean(body.retryable);
    this.status = status;
    this.details = body.details || null;
  }
}

type AuthErrorHandler = (error: ApiError) => void;
let onAuthError: AuthErrorHandler | null = null;

// Registers a global handler invoked whenever a backend response signals an
// expired/invalid session. The host app wires this to navigation.reset →
// Login. Pass null to detach (mostly for tests).
export const setOnAuthError = (handler: AuthErrorHandler | null) => {
  onAuthError = handler;
};

export const parseApiError = async (response: Response): Promise<ApiError> => {
  let body: ApiErrorBody;
  try {
    body = await response.json();
  } catch {
    body = { error: `Request failed with status ${response.status}.` };
  }
  const apiError = new ApiError(
    {
      error: body?.error || `Request failed with status ${response.status}.`,
      code: body?.code,
      retryable: body?.retryable,
      details: body?.details,
    },
    response.status,
  );

  if (apiError.code === 'auth_error' && onAuthError) {
    try {
      onAuthError(apiError);
    } catch (handlerErr) {
      console.warn('[API] auth handler threw', handlerErr);
    }
  }

  return apiError;
};

export const apiFetch = async (
  input: RequestInfo,
  init: RequestInit = {},
  context: ApiLogContext = {},
): Promise<Response> => {
  const url = typeof input === 'string' ? input : (input as Request).url;
  const method = init.method || 'GET';
  const contentType = getHeaderValue(init.headers, 'Content-Type');
  const hasAuthHeader = Boolean(getHeaderValue(init.headers, 'Authorization'));
  const correlationId =
    getHeaderValue(init.headers, CORRELATION_HEADER) || generateCorrelationId();
  const withCorrelation = mergeHeaders(init.headers, correlationId);
  const headers = withApiVersionHeader(withCorrelation);
  const startedAt = Date.now();

  setCorrelationId(correlationId);

  console.log('[API] request', {
    url,
    method,
    contentType,
    hasAuthHeader,
    correlationId,
    clientApiVersion: API_VERSION,
    context,
    body: summarizeBody(init.body ?? null),
  });

  const response = await fetch(input, { ...init, headers });

  const serverApiVersion = response.headers.get(API_VERSION_RESPONSE_HEADER);
  logServerVersionIfChanged(serverApiVersion, url);

  console.log('[API] response', {
    url,
    method,
    status: response.status,
    ok: response.ok,
    durationMs: Date.now() - startedAt,
    correlationId: response.headers.get('X-Correlation-Id') || correlationId,
    serverApiVersion,
    contentType: response.headers.get('Content-Type'),
    contentLength: response.headers.get('Content-Length'),
    context,
  });

  return response;
};
