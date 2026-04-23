import { test, expect } from '@playwright/test';

/**
 * Smoke coverage for the Run History page added in fase R2.
 * Mirrors inbox.spec.ts: validates the route mounts and the status
 * filter chips render, without depending on any backend seed data.
 */
test.describe('Run history', () => {
  test('renders the run history page with filter chips', async ({ page }) => {
    await page.goto('/en/runs');
    await expect(page.getByRole('heading', { name: /run history/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'All' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Running' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Success' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Failed' })).toBeVisible();
  });

  test('renders Spanish copy under /es/runs', async ({ page }) => {
    await page.goto('/es/runs');
    await expect(page.getByRole('heading', { name: /historial de ejecuciones/i })).toBeVisible();
  });
});
