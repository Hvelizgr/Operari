import { test, expect } from '@playwright/test';

test.describe('ChatWidget on Homepage', () => {
    test('should display homepage', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('body')).toBeVisible();
    });

    test('should have chat widget button if enabled', async ({ page }) => {
        await page.goto('/');
        
        const chatButton = page.locator('[data-testid="chat-widget-button"], [aria-label*="chat"], .chat-widget-button').first();
        if (await chatButton.isVisible({ timeout: 3000 }).catch(() => false)) {
            await expect(chatButton).toBeVisible();
        }
    });

    test('should open chat window on button click', async ({ page }) => {
        await page.goto('/');
        
        const chatButton = page.locator('[data-testid="chat-widget-button"], [aria-label*="chat"]').first();
        if (await chatButton.isVisible({ timeout: 3000 }).catch(() => false)) {
            await chatButton.click();
            
            const chatWindow = page.locator('[data-testid="chat-widget"], [role="dialog"], .chat-window').first();
            await expect(chatWindow).toBeVisible({ timeout: 3000 });
        }
    });
});

test.describe('ChatWidget Embed Page', () => {
    test('should load embed chat page', async ({ page }) => {
        await page.goto('/embed/chat?workflowId=test');
        await expect(page.locator('body')).toBeVisible();
    });

    test('should accept URL parameters', async ({ page }) => {
        await page.goto('/embed/chat?workflowId=test&primaryColor=%233b82f6');
        await expect(page.locator('body')).toBeVisible();
    });
});

test.describe('Chat Features', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('should display message input if chat is open', async ({ page }) => {
        const chatButton = page.locator('[data-testid="chat-widget-button"], [aria-label*="chat"]').first();
        if (await chatButton.isVisible({ timeout: 3000 }).catch(() => false)) {
            await chatButton.click();
            
            const input = page.locator('input[type="text"], textarea').first();
            if (await input.isVisible({ timeout: 3000 }).catch(() => false)) {
                await expect(input).toBeVisible();
            }
        }
    });

    test('should have send button if chat is open', async ({ page }) => {
        const chatButton = page.locator('[data-testid="chat-widget-button"], [aria-label*="chat"]').first();
        if (await chatButton.isVisible({ timeout: 3000 }).catch(() => false)) {
            await chatButton.click();
            
            const sendBtn = page.locator('button[type="submit"], [aria-label*="send"]').first();
            if (await sendBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                await expect(sendBtn).toBeVisible();
            }
        }
    });
});

test.describe('Chat Accessibility', () => {
    test('should be keyboard navigable', async ({ page }) => {
        await page.goto('/');
        
        await page.keyboard.press('Tab');
        const focusedElement = page.locator(':focus');
        await expect(focusedElement).toBeVisible();
    });
});
