module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    // execution.service lives under editor/execution/ after the
    // runbook DAG runner was lifted out of src/services/. Keep the
    // Jest path aligned with the real one so coverage thresholds
    // keep gating it (a stale path silently passes).
    'src/editor/execution/execution.service.ts',
    'src/routes/auth.routes.ts',
    'src/middleware/auth.middleware.ts',
  ],
  coverageThreshold: {
    'src/editor/execution/execution.service.ts': {
      statements: 70,
      lines: 70,
    },
    'src/routes/auth.routes.ts': {
      statements: 70,
      lines: 70,
    },
    'src/middleware/auth.middleware.ts': {
      statements: 70,
      lines: 70,
    },
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  // ts-jest transforms in parallel workers can OOM under enough load —
  // the node-executor dispatcher suite in particular was flaking with
  // "Jest worker encountered 4 child process exceptions" because the
  // executor registry it imports pulls in a heavy transitive graph and
  // workers exhausted their heap. `workerIdleMemoryLimit` recycles a
  // worker after 512MB of resident memory, which prevents the leak
  // from accumulating across the whole suite.
  //
  // Local dev keeps the default worker count (cpus()-1) for speed.
  // CI runs with `jest --runInBand` to force deterministic sequential
  // execution on the 2-core GitHub runner (see package.json scripts
  // + .github/workflows/ci.yml).
  workerIdleMemoryLimit: '512MB',
};
