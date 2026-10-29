/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.test.ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],
  testPathIgnorePatterns: ['/node_modules/', '/functions/', '/android/', '/ios/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // RN 0.88 serves these subpaths through package "exports" (from src/);
    // the preset's `^react-native(/.*)` mapper bypasses exports and misses them.
    '^react-native/(asset-registry|react-private-interface|setup-env|unstable-internals-do-not-use)$':
      '<rootDir>/node_modules/react-native/src/$1.js',
  },
  clearMocks: true,
};
