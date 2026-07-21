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
        diagnostics: {
          // PRE-EXISTING src errors, unrelated to any test and present before
          // this package had a tests/ directory at all. ts-jest type-checks the
          // whole import graph, so without this no test in this package can run:
          //   TS2353 - `examples` passed to registerTool in automation.ts,
          //            guided-workflows.ts and workflows.ts; not part of the
          //            MCP SDK's tool-registration type.
          //   TS6133 - two unused schema imports in screens.ts.
          // The shipped build uses esbuild (build.mjs) and does not type-check,
          // so these are not load-bearing for the container image. They should
          // be fixed on their own, not silently inside an unrelated change.
          ignoreCodes: [2353, 6133],
        },
      },
    ],
  },
  modulePathIgnorePatterns: ['<rootDir>/dist/'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
};