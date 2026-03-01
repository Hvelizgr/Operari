import { test, expect } from '@playwright/test';

test.describe('Dashboard Page', () => {
    test('should load dashboard page', async ({ page }) => {
        await page.goto('/en/dashboard');
        await expect(page.locator('body')).toBeVisible();
    });

    test('should display page content', async ({ page }) => {
        await page.goto('/en/dashboard');
        await expect(page.locator('main, #main, [role="main"], .container').first()).toBeVisible({ timeout: 10000 });
    });
});

test.describe('Dashboard Responsive', () => {
    test('should work on mobile viewport', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto('/en/dashboard');
        await expect(page.locator('body')).toBeVisible();
    });

    test('should work on tablet viewport', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 1024 });
        await page.goto('/en/dashboard');
        await expect(page.locator('body')).toBeVisible();
    });

    test('should work on desktop viewport', async ({ page }) => {
        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/en/dashboard');
        await expect(page.locator('body')).toBeVisible();
    });
});
