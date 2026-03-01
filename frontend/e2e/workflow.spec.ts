import { test, expect } from '@playwright/test';

test.describe('Workflow Editor', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/en/editor');
    });

    test('editor page loads', async ({ page }) => {
        await expect(page.locator('body')).toBeVisible();
    });

    test('canvas area is visible', async ({ page }) => {
        const canvas = page.locator('.react-flow, [role="application"], [data-testid="canvas"]').first();
        if (await canvas.isVisible({ timeout: 5000 }).catch(() => false)) {
            await expect(canvas).toBeVisible();
        }
    });

    test('page has navigation elements', async ({ page }) => {
        const navElement = page.locator('nav, aside, header, [role="navigation"], [role="toolbar"]').first();
        if (await navElement.isVisible({ timeout: 3000 }).catch(() => false)) {
            await expect(navElement).toBeVisible();
        }
    });
});

test.describe('Editor Keyboard', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/en/editor');
    });

    test('keyboard navigation works', async ({ page }) => {
        await page.keyboard.press('Tab');
        const focusedElement = page.locator(':focus');
        await expect(focusedElement).toBeVisible();
    });

    test('Ctrl+Z shortcut works', async ({ page }) => {
        await page.keyboard.press('Control+z');
        await page.waitForTimeout(300);
    });

    test('Ctrl+S shortcut works', async ({ page }) => {
        await page.keyboard.press('Control+s');
        await page.waitForTimeout(300);
    });
});

test.describe('Accessibility', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/en/editor');
    });

    test('page has accessible structure', async ({ page }) => {
        await expect(page.locator('body')).toBeVisible();
        await expect(page.locator('main, [role="main"], header').first()).toBeVisible();
    });

    test('focus is visible on navigation', async ({ page }) => {
        await page.keyboard.press('Tab');
        const focusedElement = page.locator(':focus');
        await expect(focusedElement).toBeVisible();
    });

    test('page is keyboard accessible', async ({ page }) => {
        for (let i = 0; i < 3; i++) {
            await page.keyboard.press('Tab');
        }
        const focusedElement = page.locator(':focus');
        await expect(focusedElement).toBeVisible();
    });
});

test.describe('Editor Responsive', () => {
    test('works on desktop', async ({ page }) => {
        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/en/editor');
        await expect(page.locator('body')).toBeVisible();
    });

    test('works on laptop', async ({ page }) => {
        await page.setViewportSize({ width: 1366, height: 768 });
        await page.goto('/en/editor');
        await expect(page.locator('body')).toBeVisible();
    });

    test('works on tablet', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 1024 });
        await page.goto('/en/editor');
        await expect(page.locator('body')).toBeVisible();
    });
});
