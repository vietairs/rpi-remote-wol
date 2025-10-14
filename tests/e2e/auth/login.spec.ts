import { test, expect } from '@playwright/test';
import { setupTestDatabase, resetDatabase } from '../../fixtures/db-helpers';
import { setupTestUser, loginAsTestUser, hasSessionCookie, clearSession } from '../../fixtures/auth-helpers';
import { TEST_USERS } from '../../fixtures/test-data';

test.describe('Authentication - Login', () => {
  test.beforeAll(async () => {
    await setupTestDatabase();
  });

  test.beforeEach(async () => {
    await resetDatabase();
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    // Setup user first
    await setupTestUser(page);

    // Now try to login
    await page.fill('input[id="username"]', TEST_USERS.admin.username);
    await page.fill('input[id="password"]', TEST_USERS.admin.password);
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await page.waitForURL('/');
    await expect(page.locator('h1:has-text("PC Remote Wake")')).toBeVisible();
    await expect(page.locator('text=Wake your Windows 11 PC remotely')).toBeVisible();
  });

  test('should set session cookie after successful login', async ({ page }) => {
    await setupTestUser(page);

    await page.fill('input[id="username"]', TEST_USERS.admin.username);
    await page.fill('input[id="password"]', TEST_USERS.admin.password);
    await page.click('button[type="submit"]');

    await page.waitForURL('/');

    // Check if session cookie exists
    expect(await hasSessionCookie(page)).toBe(true);
  });

  test('should show error with invalid username', async ({ page }) => {
    await setupTestUser(page);

    await page.fill('input[id="username"]', 'nonexistentuser');
    await page.fill('input[id="password"]', TEST_USERS.admin.password);
    await page.click('button[type="submit"]');

    await expect(page.locator('text=Invalid username or password')).toBeVisible();
    expect(await hasSessionCookie(page)).toBe(false);
  });

  test('should show error with invalid password', async ({ page }) => {
    await setupTestUser(page);

    await page.fill('input[id="username"]', TEST_USERS.admin.username);
    await page.fill('input[id="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=Invalid username or password')).toBeVisible();
    expect(await hasSessionCookie(page)).toBe(false);
  });

  test('should require username and password', async ({ page }) => {
    await setupTestUser(page);

    const usernameInput = page.locator('input[id="username"]');
    const passwordInput = page.locator('input[id="password"]');

    await expect(usernameInput).toHaveAttribute('required');
    await expect(passwordInput).toHaveAttribute('required');
  });

  test('should redirect to dashboard if already authenticated', async ({ page }) => {
    await setupTestUser(page);
    await loginAsTestUser(page);

    // Try to access login page again
    await page.goto('/login');
    await page.waitForURL('/');

    await expect(page.locator('h1:has-text("PC Remote Wake")')).toBeVisible();
  });

  test('should redirect to setup if no users exist', async ({ page }) => {
    // Database is empty (no users)
    await page.goto('/login');
    await page.waitForURL('/setup');

    await expect(page.locator('h1:has-text("Initial Setup")')).toBeVisible();
  });

  test('should show loading state during login', async ({ page }) => {
    await setupTestUser(page);

    await page.fill('input[id="username"]', TEST_USERS.admin.username);
    await page.fill('input[id="password"]', TEST_USERS.admin.password);

    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // Loading text should appear briefly
    await expect(page.locator('text=Signing in...')).toBeVisible({ timeout: 500 });
  });

  test('should display current username after login', async ({ page }) => {
    await setupTestUser(page);
    await loginAsTestUser(page);

    // Check if username is displayed in the dashboard
    await expect(page.locator(`text=${TEST_USERS.admin.username}`)).toBeVisible();
  });

  test('should handle case-sensitive username correctly', async ({ page }) => {
    await setupTestUser(page);

    // Try to login with different case (should fail if case-sensitive)
    await page.fill('input[id="username"]', TEST_USERS.admin.username.toUpperCase());
    await page.fill('input[id="password"]', TEST_USERS.admin.password);
    await page.click('button[type="submit"]');

    // Depending on implementation, this might succeed or fail
    // Currently, the implementation is case-sensitive
    await expect(page.locator('text=Invalid username or password')).toBeVisible();
  });
});
