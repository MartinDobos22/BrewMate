// Client-side jest config (React Native).
// Server tests live in jest.server.config.cjs and run with `npm run test:server`
// because the Node ESM backend uses a different transform/environment.

// Default RN preset only transforms `react-native|@react-native(-community)?`.
// Our deps ship ESM that needs transforming too — extend the allow-list.
const TRANSFORM_ALLOWED = [
  '(jest-)?react-native',
  '@react-native(-community)?',
  '@react-navigation',
  '@sentry/(react-native|core|hub|utils|browser|cli)',
  'react-native-.*',
  '@invertase/react-native-apple-authentication',
  'firebase',
  '@firebase',
];

module.exports = {
  preset: 'react-native',
  displayName: 'client',
  testMatch: ['<rootDir>/__tests__/client/**/*.test.{ts,tsx,js,jsx}'],
  setupFilesAfterEnv: ['<rootDir>/__tests__/client/setup.ts'],
  transformIgnorePatterns: [
    `node_modules/(?!(${TRANSFORM_ALLOWED.join('|')})/)`,
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__mocks__/**',
  ],
  coverageDirectory: '<rootDir>/coverage/client',
};
