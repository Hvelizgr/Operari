import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
    test.describe('Login Page UI', () => {
        test('should display login form', async ({ page }) => {
            await page.goto('/en/login');
            
            await expect(page.getByText('Welcome back')).toBeVisible();
            await expect(page.getByText('Email').first()).toBeVisible();
            await expect(page.getByText('Password').first()).toBeVisible();
            await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
        });

        test('should have demo account section', async ({ page }) => {
            await page.goto('/en/login');
            
            const demoSection = page.getByText('Demo Account');
            await expect(demoSection).toBeVisible();
        });

        test('should fill demo credentials on click', async ({ page }) => {
            await page.goto('/en/login');
            
            await page.getByText('Demo Account').click();
            
            const emailInput = page.getByPlaceholder('demo@nanoflow.dev');
            await expect(emailInput).toHaveValue('demo@nanoflow.dev');
        });

        test('should have link to register/pricing', async ({ page }) => {
            await page.goto('/en/login');
            
            const signupLink = page.getByRole('link', { name: /sign up/i });
            await expect(signupLink).toBeVisible();
            await expect(signupLink).toHaveAttribute('href', '/en/pricing');
        });

        test('should have forgot password link', async ({ page }) => {
            await page.goto('/en/login');
            
            const forgotLink = page.getByText(/forgot password/i);
            await expect(forgotLink).toBeVisible();
        });

        test('should have social login buttons', async ({ page }) => {
            await page.goto('/en/login');
            
            await expect(page.getByRole('button', { name: /github/i })).toBeVisible();
            await expect(page.getByRole('button', { name: /google/i })).toBeVisible();
        });

        test('should show error for invalid credentials', async ({ page }) => {
            await page.goto('/en/login');
            
            await page.getByPlaceholder('demo@nanoflow.dev').fill('wrong@email.com');
            await page.getByPlaceholder('demo123').fill('wrongpassword');
            await page.getByRole('button', { name: /sign in/i }).click();
            
            await expect(page.locator('.bg-red-500\\/10')).toBeVisible({ timeout: 10000 });
        });
    });

    test.describe('Pricing/Register Page', () => {
        test('should navigate to pricing from login', async ({ page }) => {
            await page.goto('/en/login');
            
            await page.getByRole('link', { name: /sign up/i }).click();
            await expect(page).toHaveURL(/pricing/);
        });

        test('should display pricing page', async ({ page }) => {
            await page.goto('/en/pricing');
            
            await expect(page.locator('body')).toBeVisible();
        });
    });

    test.describe('Spanish Language', () => {
        test('should display login form in Spanish', async ({ page }) => {
            await page.goto('/es/login');
            
            await expect(page.getByText('Bienvenido de vuelta')).toBeVisible();
            await expect(page.getByText('Correo electrónico')).toBeVisible();
            await expect(page.locator('label').filter({ hasText: /^Contraseña$/ })).toBeVisible();
        });
    });

    test.describe('Page Load', () => {
        test('should load dashboard page', async ({ page }) => {
            await page.goto('/en/dashboard');
            await expect(page.locator('body')).toBeVisible();
        });

        test('should load editor page', async ({ page }) => {
            await page.goto('/en/editor');
            await expect(page.locator('body')).toBeVisible();
        });

        test('should load settings page', async ({ page }) => {
            await page.goto('/en/settings');
            await expect(page.locator('body')).toBeVisible();
        });
    });
});
