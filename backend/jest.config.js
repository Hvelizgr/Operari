module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src'],
    testMatch: ['**/__tests__/**/*.test.ts'],
    collectCoverageFrom: [
        'src/services/execution.service.ts',
        'src/routes/auth.routes.ts',
        'src/middleware/auth.middleware.ts',
    ],
    coverageThreshold: {
        'src/services/execution.service.ts': {
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
