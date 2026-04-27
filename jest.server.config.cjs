// Server-side jest config.
// The backend is ESM (`"type": "module"` in package.json), so we transform via
// babel-jest with @babel/preset-env targeting current node. This is more
// reliable than jest's experimental ESM mode and matches the pattern used by
// most express + jest projects.

module.exports = {
  displayName: 'server',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/__tests__/server/**/*.test.js'],
  setupFiles: ['<rootDir>/__tests__/server/env.js'],
  setupFilesAfterEnv: ['<rootDir>/__tests__/server/setup.js'],
  transform: {
    '^.+\\.js$': [
      'babel-jest',
      {
        presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
        // server/*.js uses `import.meta.url` (e.g. server/config.js); without
        // this plugin babel-jest transpiles to CJS but leaves the literal in
        // place and node throws at runtime.
        plugins: ['babel-plugin-transform-import-meta'],
      },
    ],
  },
  // node_modules are ESM (`firebase-admin`, `@supabase/supabase-js`, `ioredis`,
  // `pg`) but we mock them in setup.js, so they never actually execute.
  transformIgnorePatterns: ['/node_modules/'],
  collectCoverageFrom: [
    'server/**/*.js',
    '!server/sentry.js',
    '!**/__mocks__/**',
  ],
  coverageDirectory: '<rootDir>/coverage/server',
  clearMocks: true,
};
