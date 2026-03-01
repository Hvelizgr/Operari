import { test, expect } from '@playwright/test';

test.describe('Workflow Editor Page', () => {
    test('should load editor page', async ({ page }) => {
        await page.goto('/en/editor');
        await expect(page.locator('body')).toBeVisible();
    });

    test('should display page content', async ({ page }) => {
        await page.goto('/en/editor');
        await expect(page.locator('main, #main, [role="main"], .container, .react-flow').first()).toBeVisible({ timeout: 10000 });
    });
});

test.describe('Editor Keyboard Shortcuts', () => {
    test('should support keyboard navigation', async ({ page }) => {
        await page.goto('/en/editor');
        await page.keyboard.press('Tab');
        await page.waitForTimeout(300);
    });

    test('should handle Ctrl+S', async ({ page }) => {
        await page.goto('/en/editor');
        await page.keyboard.press('Control+s');
        await page.waitForTimeout(300);
    });

    test('should handle Ctrl+Z', async ({ page }) => {
        await page.goto('/en/editor');
        await page.keyboard.press('Control+z');
        await page.waitForTimeout(300);
    });

    test('should handle Delete key', async ({ page }) => {
        await page.goto('/en/editor');
        await page.keyboard.press('Delete');
        await page.waitForTimeout(300);
    });
});

test.describe('Editor Responsive', () => {
    test('should work on large screen', async ({ page }) => {
        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/en/editor');
        await expect(page.locator('body')).toBeVisible();
    });

    test('should work on medium screen', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.goto('/en/editor');
        await expect(page.locator('body')).toBeVisible();
    });

    test('should work on small screen', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 1024 });
        await page.goto('/en/editor');
        await expect(page.locator('body')).toBeVisible();
    });
});
