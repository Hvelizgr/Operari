import { test, expect } from '@playwright/test';

test('homepage has title', async ({ page }) => {
  await page.goto('/');

  // Expect a title "to contain" a substring.
  // Adjust this based on actual title, probably "NanoFlow"
  await expect(page).toHaveTitle(/NanoFlow/);
});
