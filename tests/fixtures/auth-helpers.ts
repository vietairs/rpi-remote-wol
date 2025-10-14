import { Page, expect } from '@playwright/test';
import { TEST_USERS } from './test-data';

/**
 * Authentication helper functions for e2e tests
 */

/**
 * Set up the first admin user via the setup page
 */
export async function setupTestUser(
  page: Page,
  user = TEST_USERS.admin
): Promise<void> {
  await page.goto('/setup');
  await page.waitForURL('/setup');

  await page.fill('input[id="username"]', user.username);
  await page.fill('input[id="password"]', user.password);
  await page.fill('input[id="confirmPassword"]', user.password);

  await page.click('button[type="submit"]');

  // Wait for redirect to login page
  await page.waitForURL('/login', { timeout: 5000 });
}

/**
 * Log in as a test user
 */
export async function loginAsTestUser(
  page: Page,
  user = TEST_USERS.admin
): Promise<void> {
  await page.goto('/login');
  await page.waitForURL('/login');

  await page.fill('input[id="username"]', user.username);
  await page.fill('input[id="password"]', user.password);

  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard
  await page.waitForURL('/', { timeout: 5000 });
}

/**
 * Log out the current user
 */
export async function logout(page: Page): Promise<void> {
  await page.click('button:has-text("Logout")');

  // Wait for redirect to login page
  await page.waitForURL('/login', { timeout: 5000 });
}

/**
 * Verify that the user is authenticated (can access dashboard)
 */
export async function expectAuthenticated(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page).toHaveURL('/');
  await expect(page.locator('h1:has-text("PC Remote Wake")')).toBeVisible();
}

/**
 * Verify that the user is not authenticated (redirected to login)
 */
export async function expectUnauthenticated(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForURL('/login', { timeout: 5000 });
  await expect(page).toHaveURL('/login');
}

/**
 * Clear all cookies and session data
 */
export async function clearSession(page: Page): Promise<void> {
  await page.context().clearCookies();
}

/**
 * Check if session cookie exists
 */
export async function hasSessionCookie(page: Page): Promise<boolean> {
  const cookies = await page.context().cookies();
  return cookies.some(cookie => cookie.name === 'session');
}
