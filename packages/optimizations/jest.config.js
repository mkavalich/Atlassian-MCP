export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          module: 'ESNext',
          moduleResolution: 'bundler',
          types: ['jest', 'node'],
        },
      },
    ],
  },
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  modulePathIgnorePatterns: ['<rootDir>/dist/'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts'],
};
