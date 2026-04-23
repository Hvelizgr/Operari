import { test, expect } from '@playwright/test';

test.describe('Runbook canvas', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('canvas loads with initial nodes', async ({ page }) => {
    const canvas = page.locator('[role="application"]');
    await expect(canvas).toBeVisible();

    const nodes = page.locator('[role="button"][aria-label*="node"]');
    await expect(nodes).toHaveCount(3);
  });

  test('can select a node', async ({ page }) => {
    const node = page.locator('[role="button"][aria-label*="Trigger"]');
    await node.click();
    await expect(node).toHaveAttribute('aria-selected', 'true');
  });

  test('can delete a node with keyboard', async ({ page }) => {
    const node = page.locator('[role="button"][aria-label*="Trigger"]');
    await node.click();
    await page.keyboard.press('Delete');

    const confirmButton = page.getByRole('button', { name: /confirm|delete/i });
    await confirmButton.click();

    const nodes = page.locator('[role="button"][aria-label*="node"]');
    await expect(nodes).toHaveCount(2);
  });

  test('undo/redo buttons work', async ({ page }) => {
    const undoButton = page.getByTitle('Undo (Ctrl+Z)');
    const redoButton = page.getByTitle('Redo (Ctrl+Y)');

    await expect(undoButton).toBeDisabled();
    await expect(redoButton).toBeDisabled();

    const node = page.locator('[role="button"][aria-label*="Trigger"]');
    await node.click();
    await page.keyboard.press('Delete');
    await page.getByRole('button', { name: /confirm|delete/i }).click();

    await expect(undoButton).toBeEnabled();
    await undoButton.click();

    await expect(redoButton).toBeEnabled();
  });

  test('keyboard navigation works', async ({ page }) => {
    await page.keyboard.press('Tab');

    const firstNode = page.locator('[role="button"][aria-label*="node"]').first();
    await expect(firstNode).toHaveClass(/ring-4/);
  });

  test('zoom controls work', async ({ page }) => {
    const zoomIn = page.getByTitle(/zoom in|acercar/i);
    const zoomDisplay = page.locator('text=100%');

    await expect(zoomDisplay).toBeVisible();
    await zoomIn.click();

    const newZoom = page.locator('text=110%');
    await expect(newZoom).toBeVisible();
  });

  test('high contrast mode toggles', async ({ page }) => {
    const toggle = page.locator('[aria-label*="contrast"]');
    await toggle.click();

    const canvas = page.locator('[role="application"]');
    await expect(canvas).toHaveClass(/bg-black/);
  });

  test('can run runbook', async ({ page }) => {
    const runButton = page.getByRole('button', {
      name: /run runbook|ejecutar runbook|^run$|^ejecutar$/i,
    });
    await runButton.click();

    const logsPanel = page.locator('text=/logs|execution/i');
    await expect(logsPanel).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('canvas has proper ARIA attributes', async ({ page }) => {
    const canvas = page.locator('[role="application"]');
    await expect(canvas).toHaveAttribute('aria-label', 'Runbook canvas');
    await expect(canvas).toHaveAttribute('aria-describedby', 'canvas-instructions');
  });

  test('nodes have proper ARIA labels', async ({ page }) => {
    const nodes = page.locator('[role="button"][aria-label*="node"]');
    const count = await nodes.count();

    for (let i = 0; i < count; i++) {
      const node = nodes.nth(i);
      await expect(node).toHaveAttribute('aria-label');
      await expect(node).toHaveAttribute('aria-describedby');
    }
  });

  test('focus is visible on navigation', async ({ page }) => {
    await page.keyboard.press('Tab');

    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });
});
