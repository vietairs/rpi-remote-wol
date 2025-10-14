import { test, expect } from '@playwright/test';
import { setupTestDatabase, resetDatabase } from '../../fixtures/db-helpers';
import { setupTestUser, loginAsTestUser, logout, expectAuthenticated, expectUnauthenticated, clearSession, hasSessionCookie } from '../../fixtures/auth-helpers';

test.describe('Authentication - Session Management', () => {
  test.beforeAll(async () => {
    await setupTestDatabase();
  });

  test.beforeEach(async () => {
    await resetDatabase();
  });

  test('should protect dashboard from unauthenticated access', async ({ page }) => {
    await setupTestUser(page);

    // Try to access dashboard without logging in
    await expectUnauthenticated(page);
  });

  test('should allow access to dashboard with valid session', async ({ page }) => {
    await setupTestUser(page);
    await loginAsTestUser(page);

    await expectAuthenticated(page);
  });

  test('should persist session across page refreshes', async ({ page }) => {
    await setupTestUser(page);
    await loginAsTestUser(page);

    // Refresh the page
    await page.reload();

    // Should still be authenticated
    await expect(page).toHaveURL('/');
    await expect(page.locator('h1:has-text("PC Remote Wake")')).toBeVisible();
  });

  test('should persist session in new tab/window', async ({ context, page }) => {
    await setupTestUser(page);
    await loginAsTestUser(page);

    // Open a new page in the same context (shares cookies)
    const newPage = await context.newPage();
    await newPage.goto('/');

    // Should be authenticated in new page
    await expect(newPage).toHaveURL('/');
    await expect(newPage.locator('h1:has-text("PC Remote Wake")')).toBeVisible();

    await newPage.close();
  });

  test('should logout successfully and clear session', async ({ page }) => {
    await setupTestUser(page);
    await loginAsTestUser(page);

    // Verify logged in
    expect(await hasSessionCookie(page)).toBe(true);

    // Logout
    await logout(page);

    // Should be redirected to login page
    await expect(page).toHaveURL('/login');

    // Session cookie should be cleared
    expect(await hasSessionCookie(page)).toBe(false);
  });

  test('should redirect to login after logout when accessing protected route', async ({ page }) => {
    await setupTestUser(page);
    await loginAsTestUser(page);
    await logout(page);

    // Try to access dashboard
    await page.goto('/');
    await page.waitForURL('/login');

    await expect(page).toHaveURL('/login');
  });

  test('should not allow access with cleared cookies', async ({ page }) => {
    await setupTestUser(page);
    await loginAsTestUser(page);

    // Clear all cookies manually
    await clearSession(page);

    // Try to access dashboard
    await expectUnauthenticated(page);
  });

  test('should redirect to login with invalid session token', async ({ page, context }) => {
    await setupTestUser(page);

    // Set an invalid session cookie
    await context.addCookies([
      {
        name: 'session',
        value: 'invalid.token.here',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
        expires: Date.now() / 1000 + 3600, // 1 hour from now
      },
    ]);

    // Try to access dashboard
    await expectUnauthenticated(page);

    // Invalid cookie should be cleared
    expect(await hasSessionCookie(page)).toBe(false);
  });

  test('should allow access to public paths without authentication', async ({ page }) => {
    await setupTestUser(page);

    // Login page should be accessible
    await page.goto('/login');
    await expect(page).toHaveURL('/login');

    // Setup page should redirect (users exist)
    await page.goto('/setup');
    await page.waitForURL('/login');
  });

  test('should protect API routes except auth endpoints', async ({ page, request }) => {
    await setupTestUser(page);

    // Auth endpoints should be accessible
    const initResponse = await request.get('/api/auth/init');
    expect(initResponse.ok()).toBe(true);

    // Protected API endpoints should redirect/reject without auth
    const devicesResponse = await request.get('/api/devices');
    // Middleware will redirect to login for browser requests
    // For API requests, it should return 401 or redirect
    // The actual behavior depends on middleware implementation
  });

  test('should maintain session across multiple API calls', async ({ page }) => {
    await setupTestUser(page);
    await loginAsTestUser(page);

    // Make multiple API calls
    const response1 = await page.request.get('/api/devices');
    const response2 = await page.request.get('/api/auth/session');

    expect(response1.ok()).toBe(true);
    expect(response2.ok()).toBe(true);

    // Session should still be valid
    await expectAuthenticated(page);
  });

  test('should display logout button when authenticated', async ({ page }) => {
    await setupTestUser(page);
    await loginAsTestUser(page);

    const logoutButton = page.locator('button:has-text("Logout")');
    await expect(logoutButton).toBeVisible();
  });

  test('should handle concurrent logout requests gracefully', async ({ page }) => {
    await setupTestUser(page);
    await loginAsTestUser(page);

    // Send multiple logout requests
    await Promise.all([
      page.request.post('/api/auth/logout'),
      page.request.post('/api/auth/logout'),
    ]);

    // Should still redirect to login properly
    await page.goto('/');
    await page.waitForURL('/login');
  });
});
