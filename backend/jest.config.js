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
};
