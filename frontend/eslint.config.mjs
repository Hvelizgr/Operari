// Frontend ESLint config — flat-config format (ESLint 9+), matching the
// backend. `next lint` is deprecated and only covered app/, components/
// and lib/; plain `eslint .` now also lints hooks/, utils/, context/ and
// the tests.
//
// Next's shareable configs are still eslintrc-only, so they go through
// FlatCompat. Test-only plugin presets are downgraded to warnings: the
// tests were never linted before, and their findings should surface
// without failing CI in one go.

import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { FlatCompat } from '@eslint/eslintrc';
import prettierConfig from 'eslint-config-prettier';
import jestDom from 'eslint-plugin-jest-dom';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import testingLibrary from 'eslint-plugin-testing-library';

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const asWarnings = config => ({
  ...config,
  rules: Object.fromEntries(
    Object.entries(config.rules ?? {}).map(([rule, value]) => [
      rule,
      Array.isArray(value) ? ['warn', ...value.slice(1)] : value === 'off' ? 'off' : 'warn',
    ])
  ),
});

const TEST_FILES = ['**/*.test.ts', '**/*.test.tsx'];

export default [
  {
    ignores: [
      '.next/',
      'node_modules/',
      'coverage/',
      'storybook-static/',
      'playwright-report/',
      'test-results/',
      'public/',
      'next-env.d.ts',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    plugins: { 'simple-import-sort': simpleImportSort },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      'react/prop-types': 'off',
      'react-hooks/exhaustive-deps': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'simple-import-sort/imports': 'warn',
      'simple-import-sort/exports': 'warn',
    },
  },
  {
    files: ['tailwind.config.ts', '**/*.js'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  { files: TEST_FILES, ...asWarnings(testingLibrary.configs['flat/react']) },
  { files: TEST_FILES, ...asWarnings(jestDom.configs['flat/recommended']) },
  prettierConfig,
];
