import { Platform } from 'react-native';
import Config from 'react-native-config';

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

export const parseApiError = async (response: Response): Promise<ApiError> => {
  let body: ApiErrorBody;
  try {
    body = await response.json();
  } catch {
    body = { error: `Request failed with status ${response.status}.` };
  }
  return new ApiError(
    {
      error: body?.error || `Request failed with status ${response.status}.`,
      code: body?.code,
      retryable: body?.retryable,
      details: body?.details,
    },
    response.status,
  );
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
  const startedAt = Date.now();

  console.log('[API] request', {
    url,
    method,
    contentType,
    hasAuthHeader,
    context,
    body: summarizeBody(init.body ?? null),
  });

  const response = await fetch(input, init);

  console.log('[API] response', {
    url,
    method,
    status: response.status,
    ok: response.ok,
    durationMs: Date.now() - startedAt,
    contentType: response.headers.get('Content-Type'),
    contentLength: response.headers.get('Content-Length'),
    context,
  });

  return response;
};
