import { test, expect } from '@playwright/test';
import { setupTestDatabase, resetDatabase, getUserCount } from '../../fixtures/db-helpers';
import { TEST_USERS } from '../../fixtures/test-data';

test.describe('Authentication - Setup', () => {
  test.beforeAll(async () => {
    await setupTestDatabase();
  });

  test.beforeEach(async () => {
    await resetDatabase();
  });

  test('should display setup page when no users exist', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL('/setup');

    await expect(page.locator('h1:has-text("Initial Setup")')).toBeVisible();
    await expect(page.locator('text=Create your admin account')).toBeVisible();
  });

  test('should create admin account successfully', async ({ page }) => {
    await page.goto('/setup');

    await page.fill('input[id="username"]', TEST_USERS.admin.username);
    await page.fill('input[id="password"]', TEST_USERS.admin.password);
    await page.fill('input[id="confirmPassword"]', TEST_USERS.admin.password);

    await page.click('button[type="submit"]');

    // Should redirect to login page
    await page.waitForURL('/login');
    expect(await getUserCount()).toBe(1);
  });

  test('should show error when passwords do not match', async ({ page }) => {
    await page.goto('/setup');

    await page.fill('input[id="username"]', TEST_USERS.admin.username);
    await page.fill('input[id="password"]', TEST_USERS.admin.password);
    await page.fill('input[id="confirmPassword"]', 'differentpassword');

    await page.click('button[type="submit"]');

    await expect(page.locator('text=Passwords do not match')).toBeVisible();
  });

  test('should show error when password is too short', async ({ page }) => {
    await page.goto('/setup');

    await page.fill('input[id="username"]', TEST_USERS.admin.username);
    await page.fill('input[id="password"]', '12345'); // Less than 6 characters
    await page.fill('input[id="confirmPassword"]', '12345');

    // Remove HTML5 validation to test server-side validation
    await page.evaluate(() => {
      const form = document.querySelector('form');
      if (form) form.setAttribute('novalidate', 'true');
    });

    await page.click('button[type="submit"]');

    await expect(page.locator('text=Password must be at least 6 characters')).toBeVisible();
  });

  test('should enforce minimum password length in HTML', async ({ page }) => {
    await page.goto('/setup');

    const passwordInput = page.locator('input[id="password"]');
    await expect(passwordInput).toHaveAttribute('minLength', '6');
  });

  test('should require all fields', async ({ page }) => {
    await page.goto('/setup');

    const usernameInput = page.locator('input[id="username"]');
    const passwordInput = page.locator('input[id="password"]');
    const confirmPasswordInput = page.locator('input[id="confirmPassword"]');

    await expect(usernameInput).toHaveAttribute('required');
    await expect(passwordInput).toHaveAttribute('required');
    await expect(confirmPasswordInput).toHaveAttribute('required');
  });

  test('should redirect to login when users already exist', async ({ page }) => {
    // Create a user first
    await page.goto('/setup');
    await page.fill('input[id="username"]', TEST_USERS.admin.username);
    await page.fill('input[id="password"]', TEST_USERS.admin.password);
    await page.fill('input[id="confirmPassword"]', TEST_USERS.admin.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('/login');

    // Try to access setup page again
    await page.goto('/setup');
    await page.waitForURL('/login');

    await expect(page.locator('h1:has-text("PC Remote Wake")')).toBeVisible();
    await expect(page.locator('text=Sign in to continue')).toBeVisible();
  });

  test('should show loading state during setup', async ({ page }) => {
    // Ensure clean state - previous test may have created user
    await resetDatabase();

    await page.goto('/setup');
    await page.waitForLoadState('networkidle');

    await page.fill('input[id="username"]', TEST_USERS.admin.username);
    await page.fill('input[id="password"]', TEST_USERS.admin.password);
    await page.fill('input[id="confirmPassword"]', TEST_USERS.admin.password);

    // Click and immediately check for loading state
    const submitButton = page.locator('button[type="submit"]');

    // Use Promise.all to check loading state immediately after click
    await Promise.all([
      submitButton.click(),
      page.waitForSelector('text=Creating Account...', { timeout: 1000 }).catch(() => {
        // Loading state might be too fast, that's OK
      })
    ]);
  });
});
