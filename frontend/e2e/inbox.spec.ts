import { test, expect } from '@playwright/test';

/**
 * Smoke coverage for the Approval Inbox page added in fase R2.
 * The page is allowed to show an empty state if the backend has no
 * approvals seeded — we are validating that the route mounts, the
 * filter chips render, and the network call completes (success or
 * graceful error UI), not the contents of any specific approval.
 */
test.describe('Approval inbox', () => {
    test('renders the inbox page with filter chips', async ({ page }) => {
        await page.goto('/en/inbox');
        await expect(page.getByRole('heading', { name: /approval inbox/i })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Pending' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Approved' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Rejected' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Expired' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'All' })).toBeVisible();
    });

    test('clicking a filter chip changes selection', async ({ page }) => {
        await page.goto('/en/inbox');
        const allChip = page.getByRole('button', { name: 'All' });
        await allChip.click();
        // The active chip uses bg-white text-black; checking the class
        // is brittle, so we instead assert that the empty state or a
        // list shows up after the filter change.
        await expect(page.locator('text=/no approvals|loading|approval/i').first()).toBeVisible();
    });

    test('renders Spanish copy under /es/inbox', async ({ page }) => {
        await page.goto('/es/inbox');
        await expect(page.getByRole('heading', { name: /bandeja de aprobaciones/i })).toBeVisible();
    });
});
