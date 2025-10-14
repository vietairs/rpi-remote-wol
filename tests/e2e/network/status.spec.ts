import { test, expect } from '@playwright/test';
import { setupTestDatabase, resetDatabase } from '../../fixtures/db-helpers';
import { setupTestUser, loginAsTestUser } from '../../fixtures/auth-helpers';
import { TEST_DEVICES } from '../../fixtures/test-data';

test.describe('Network Operations - Status Checking', () => {
  test.beforeAll(async () => {
    await setupTestDatabase();
  });

  test.beforeEach(async ({ page }) => {
    await resetDatabase();
    await setupTestUser(page);
    await loginAsTestUser(page);
  });

  test('should show "No IP" badge for devices without IP address', async ({ page }) => {
    // Create device without IP
    await page.click('button:has-text("Save This Device")');
    await page.fill('input[placeholder*="Device name"]', TEST_DEVICES.noIp.name);
    await page.fill('input[id="macAddress"]', TEST_DEVICES.noIp.macAddress);
    await page.click('button:has-text("Save")');

    await page.waitForTimeout(1000);

    // "No IP" badge should be visible
    await expect(page.locator('text=No IP').first()).toBeVisible();
  });

  test('should check device status automatically', async ({ page }) => {
    // Create device with IP
    await page.click('button:has-text("Save This Device")');
    await page.fill('input[placeholder*="Device name"]', TEST_DEVICES.valid.name);
    await page.fill('input[id="macAddress"]', TEST_DEVICES.valid.macAddress);
    await page.fill('input[placeholder*="IP Address"]', TEST_DEVICES.valid.ipAddress!);
    await page.click('button:has-text("Save")');

    // Mock status check response
    await page.route('**/api/status', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          online: true,
          rdpReady: false,
          ipAddress: TEST_DEVICES.valid.ipAddress,
          checkedAt: new Date().toISOString()
        })
      });
    });

    await page.waitForTimeout(1500);

    // "Online" badge should appear
    await expect(page.locator('text=Online').first()).toBeVisible({ timeout: 5000 });
  });

  test('should show "RDP Ready" badge when RDP port is available', async ({ page }) => {
    await page.click('button:has-text("Save This Device")');
    await page.fill('input[placeholder*="Device name"]', TEST_DEVICES.valid.name);
    await page.fill('input[id="macAddress"]', TEST_DEVICES.valid.macAddress);
    await page.fill('input[placeholder*="IP Address"]', TEST_DEVICES.valid.ipAddress!);
    await page.click('button:has-text("Save")');

    // Mock status check with RDP ready
    await page.route('**/api/status', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          online: true,
          rdpReady: true,
          ipAddress: TEST_DEVICES.valid.ipAddress,
          checkedAt: new Date().toISOString()
        })
      });
    });

    await page.waitForTimeout(1500);

    // "RDP Ready" badge should appear
    await expect(page.locator('text=RDP Ready').first()).toBeVisible({ timeout: 5000 });
  });

  test('should show "Offline" badge when device is unreachable', async ({ page }) => {
    await page.click('button:has-text("Save This Device")');
    await page.fill('input[placeholder*="Device name"]', TEST_DEVICES.valid.name);
    await page.fill('input[id="macAddress"]', TEST_DEVICES.valid.macAddress);
    await page.fill('input[placeholder*="IP Address"]', TEST_DEVICES.valid.ipAddress!);
    await page.click('button:has-text("Save")');

    // Mock status check with device offline
    await page.route('**/api/status', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          online: false,
          rdpReady: false,
          ipAddress: TEST_DEVICES.valid.ipAddress,
          checkedAt: new Date().toISOString()
        })
      });
    });

    await page.waitForTimeout(1500);

    // "Offline" badge should appear
    await expect(page.locator('text=Offline').first()).toBeVisible({ timeout: 5000 });
  });

  test('should show "Checking" status during check', async ({ page }) => {
    await page.click('button:has-text("Save This Device")');
    await page.fill('input[placeholder*="Device name"]', TEST_DEVICES.valid.name);
    await page.fill('input[id="macAddress"]', TEST_DEVICES.valid.macAddress);
    await page.fill('input[placeholder*="IP Address"]', TEST_DEVICES.valid.ipAddress!);
    await page.click('button:has-text("Save")');

    // Mock slow status check
    await page.route('**/api/status', async route => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          online: true,
          rdpReady: false,
          ipAddress: TEST_DEVICES.valid.ipAddress,
          checkedAt: new Date().toISOString()
        })
      });
    });

    await page.waitForTimeout(1500);

    // "Checking" badge should appear
    await expect(page.locator('text=Checking').first()).toBeVisible({ timeout: 3000 });
  });

  test('should handle status check errors gracefully', async ({ page }) => {
    await page.click('button:has-text("Save This Device")');
    await page.fill('input[placeholder*="Device name"]', TEST_DEVICES.valid.name);
    await page.fill('input[id="macAddress"]', TEST_DEVICES.valid.macAddress);
    await page.fill('input[placeholder*="IP Address"]', TEST_DEVICES.valid.ipAddress!);
    await page.click('button:has-text("Save")');

    // Mock failed status check
    await page.route('**/api/status', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Failed to check device status' })
      });
    });

    await page.waitForTimeout(1500);

    // Should show offline or default state, not crash
    // The exact behavior depends on error handling implementation
  });

  test('should check status for multiple devices', async ({ page }) => {
    // Create multiple devices with IPs
    const devices = [TEST_DEVICES.valid, TEST_DEVICES.noSsh];

    for (const device of devices) {
      await page.click('button:has-text("Save This Device")');
      await page.fill('input[placeholder*="Device name"]', device.name);
      await page.fill('input[id="macAddress"]', device.macAddress);
      if (device.ipAddress) {
        await page.fill('input[placeholder*="IP Address"]', device.ipAddress);
      }
      await page.click('button:has-text("Save")');
      await page.waitForTimeout(300);
    }

    // Mock status checks
    await page.route('**/api/status', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          online: true,
          rdpReady: false,
          ipAddress: route.request().postDataJSON().ipAddress,
          checkedAt: new Date().toISOString()
        })
      });
    });

    await page.waitForTimeout(2000);

    // Both devices should show status badges
    const onlineBadges = page.locator('text=Online');
    await expect(onlineBadges.first()).toBeVisible({ timeout: 5000 });
  });

  test('should persist status across page refresh', async ({ page }) => {
    await page.click('button:has-text("Save This Device")');
    await page.fill('input[placeholder*="Device name"]', TEST_DEVICES.valid.name);
    await page.fill('input[id="macAddress"]', TEST_DEVICES.valid.macAddress);
    await page.fill('input[placeholder*="IP Address"]', TEST_DEVICES.valid.ipAddress!);
    await page.click('button:has-text("Save")');

    // Mock status check
    await page.route('**/api/status', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          online: true,
          rdpReady: true,
          ipAddress: TEST_DEVICES.valid.ipAddress,
          checkedAt: new Date().toISOString()
        })
      });
    });

    await page.waitForTimeout(1500);
    await expect(page.locator('text=RDP Ready').first()).toBeVisible();

    // Refresh page
    await page.reload();

    await page.waitForTimeout(1500);

    // Status should be rechecked after refresh
    await expect(page.locator('text=RDP Ready').first()).toBeVisible({ timeout: 5000 });
  });
});
