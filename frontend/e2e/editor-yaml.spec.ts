import { expect, test } from '@playwright/test';

/**
 * Coverage for the YAML view modal (fase R3.1) and the topbar wiring
 * that opens it. We do not attempt a full save round-trip here — the
 * serializer logic itself is exhaustively unit-tested in
 * backend/src/__tests__/runbook/yaml/. This spec validates the editor
 * surfaces the YAML toggle and the modal renders the canonical
 * RunbookSpec output.
 */
test.describe('Editor YAML view', () => {
  test('topbar exposes the YAML view button', async ({ page }) => {
    await page.goto('/en/editor');
    await expect(page.getByTitle('View as YAML')).toBeVisible();
  });

  test('clicking the YAML button opens the modal with serialized output', async ({ page }) => {
    await page.goto('/en/editor');
    await page.getByTitle('View as YAML').click();

    // The modal header carries the localized title.
    await expect(page.getByRole('heading', { name: /runbook yaml/i })).toBeVisible();

    // The textarea is populated with the serialized runbook —
    // every spec emits the canonical version: 1 marker.
    const textarea = page.locator('textarea').first();
    await expect(textarea).toBeVisible();
    const value = await textarea.inputValue();
    expect(value).toContain('version: 1');
    expect(value).toMatch(/name:/);
  });

  test('cancel closes the modal without applying changes', async ({ page }) => {
    await page.goto('/en/editor');
    await page.getByTitle('View as YAML').click();
    await expect(page.getByRole('heading', { name: /runbook yaml/i })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('heading', { name: /runbook yaml/i })).not.toBeVisible();
  });

  test('rejects invalid YAML on save and shows an error', async ({ page }) => {
    await page.goto('/en/editor');
    await page.getByTitle('View as YAML').click();
    const textarea = page.locator('textarea').first();
    await textarea.fill('this is: not [valid: yaml');
    await page.getByRole('button', { name: /save changes/i }).click();
    await expect(page.locator('text=/Invalid YAML/i')).toBeVisible();
  });
});
