// Per-test setup for client (React Native) tests. Runs after jest framework
// loads. We mock the native modules that crash when imported under jest.
//
// `@testing-library/react-native` v12.4+ ships its own jest matchers — no
// need for the deprecated `@testing-library/jest-native`.

// react-native-config — `Config.EXPO_PUBLIC_API_HOST` etc. are read at
// import-time by `src/utils/api.ts` and `src/sentry.ts`.
jest.mock('react-native-config', () => ({
  __esModule: true,
  default: {
    EXPO_PUBLIC_API_HOST: 'http://localhost:3000',
    SENTRY_DSN_FRONTEND: '',
    SENTRY_ENVIRONMENT: 'test',
    SENTRY_TRACES_SAMPLE_RATE: '0',
  },
}));

// Sentry RN — its native bridge is unavailable under jest, so we stub it.
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  setTag: jest.fn(),
}));

// AsyncStorage has its own jest mock; pull it in lazily so RN preset's
// transformer doesn't trip over it.
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line global-require
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Image picker uses native modules; stub the surface tests touch.
jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(),
}));

// Google / Apple sign-in.
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn().mockResolvedValue(true),
    signIn: jest.fn(),
    signOut: jest.fn(),
  },
  statusCodes: {},
}));
jest.mock('@invertase/react-native-apple-authentication', () => ({
  __esModule: true,
  default: {
    isSupported: false,
    performRequest: jest.fn(),
  },
  appleAuth: {
    isSupported: false,
    performRequest: jest.fn(),
  },
}));

// Firebase web SDK ships ESM and pulls in `.mjs` files (`@firebase/util`
// postinstall.mjs) that the RN preset transform doesn't touch. Mock the auth
// surface used by `src/utils/socialAuth.ts` so the import chain stops there.
jest.mock('firebase/auth', () => ({
  GoogleAuthProvider: { credential: jest.fn(() => ({})) },
  OAuthProvider: jest.fn(() => ({ credential: jest.fn(() => ({})) })),
  signInWithCredential: jest.fn(),
  getAuth: jest.fn(() => ({})),
}));
jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(),
  getApps: jest.fn(() => []),
  getApp: jest.fn(() => ({})),
}));

// Silence the global fetch warning — individual tests override this.
beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: new Map(),
    json: async () => ({}),
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});
