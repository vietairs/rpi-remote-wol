import { test, expect } from '@playwright/test';
import { setupTestDatabase, resetDatabase } from '../../fixtures/db-helpers';
import { setupTestUser, loginAsTestUser } from '../../fixtures/auth-helpers';
import { TEST_DEVICES } from '../../fixtures/test-data';

test.describe('Network Operations - SSH Commands', () => {
  test.beforeAll(async () => {
    await setupTestDatabase();
  });

  test.beforeEach(async ({ page }) => {
    await resetDatabase();
    await setupTestUser(page);
    await loginAsTestUser(page);
  });

  async function createDeviceWithSSH(page: any, online = true) {
    await page.click('button:has-text("Save This Device")');
    await page.fill('input[placeholder*="Device name"]', TEST_DEVICES.withAllFields.name);
    await page.fill('input[id="macAddress"]', TEST_DEVICES.withAllFields.macAddress);
    await page.fill('input[placeholder*="IP Address"]', TEST_DEVICES.withAllFields.ipAddress!);
    await page.fill('input[placeholder*="SSH Username"]', TEST_DEVICES.withAllFields.sshUsername!);
    await page.fill('input[placeholder*="SSH Password"]', TEST_DEVICES.withAllFields.sshPassword!);
    await page.click('button:has-text("Save")');

    // Mock status to show device as online or offline
    await page.route('**/api/status', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          online,
          rdpReady: online,
          ipAddress: TEST_DEVICES.withAllFields.ipAddress,
          checkedAt: new Date().toISOString()
        })
      });
    });

    await page.waitForTimeout(1500);
  }

  test('should not show SSH buttons for device without credentials', async ({ page }) => {
    // Create device without SSH credentials
    await page.click('button:has-text("Save This Device")');
    await page.fill('input[placeholder*="Device name"]', TEST_DEVICES.noSsh.name);
    await page.fill('input[id="macAddress"]', TEST_DEVICES.noSsh.macAddress);
    await page.fill('input[placeholder*="IP Address"]', TEST_DEVICES.noSsh.ipAddress!);
    await page.click('button:has-text("Save")');

    await page.waitForTimeout(500);

    // SSH buttons should not be visible
    await expect(page.locator('button:has-text("Sleep")')).not.toBeVisible();
    await expect(page.locator('button:has-text("Shutdown")')).not.toBeVisible();
  });

  test('should not show SSH buttons for offline device', async ({ page }) => {
    await createDeviceWithSSH(page, false); // Create offline device

    await page.waitForTimeout(1000);

    // SSH buttons should not be visible for offline device
    await expect(page.locator('button:has-text("Sleep")')).not.toBeVisible();
    await expect(page.locator('button:has-text("Shutdown")')).not.toBeVisible();
  });

  test('should show SSH buttons for online device with credentials', async ({ page }) => {
    await createDeviceWithSSH(page, true); // Create online device

    await page.waitForTimeout(2000);

    // SSH buttons should be visible
    await expect(page.locator('button:has-text("Sleep")').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('button:has-text("Shutdown")').first()).toBeVisible({ timeout: 5000 });
  });

  test('should show confirmation dialog before shutdown', async ({ page }) => {
    await createDeviceWithSSH(page, true);
    await page.waitForTimeout(2000);

    let dialogShown = false;
    page.on('dialog', dialog => {
      dialogShown = true;
      expect(dialog.message()).toContain('Are you sure you want to shutdown');
      dialog.dismiss();
    });

    await page.locator('button:has-text("Shutdown")').first().click();
    await page.waitForTimeout(500);

    expect(dialogShown).toBe(true);
  });

  test('should show confirmation dialog before sleep', async ({ page }) => {
    await createDeviceWithSSH(page, true);
    await page.waitForTimeout(2000);

    let dialogShown = false;
    page.on('dialog', dialog => {
      dialogShown = true;
      expect(dialog.message()).toContain('Are you sure you want to sleep');
      dialog.dismiss();
    });

    await page.locator('button:has-text("Sleep")').first().click();
    await page.waitForTimeout(500);

    expect(dialogShown).toBe(true);
  });

  test('should send shutdown command successfully', async ({ page }) => {
    await createDeviceWithSSH(page, true);
    await page.waitForTimeout(2000);

    // Mock shutdown API
    await page.route('**/api/shutdown', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: `Shutdown command sent to ${TEST_DEVICES.withAllFields.name}`,
          deviceName: TEST_DEVICES.withAllFields.name
        })
      });
    });

    page.on('dialog', dialog => dialog.accept());
    await page.locator('button:has-text("Shutdown")').first().click();
    await page.waitForTimeout(500);

    await expect(page.locator(`text=Success! Shutdown command sent to ${TEST_DEVICES.withAllFields.name}`)).toBeVisible();
  });

  test('should send sleep command successfully', async ({ page }) => {
    await createDeviceWithSSH(page, true);
    await page.waitForTimeout(2000);

    // Mock sleep API
    await page.route('**/api/sleep', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: `Sleep command sent to ${TEST_DEVICES.withAllFields.name}`,
          deviceName: TEST_DEVICES.withAllFields.name
        })
      });
    });

    page.on('dialog', dialog => dialog.accept());
    await page.locator('button:has-text("Sleep")').first().click();
    await page.waitForTimeout(500);

    await expect(page.locator(`text=Success! Sleep command sent to ${TEST_DEVICES.withAllFields.name}`)).toBeVisible();
  });

  test('should handle SSH connection errors', async ({ page }) => {
    await createDeviceWithSSH(page, true);
    await page.waitForTimeout(2000);

    // Mock connection error
    await page.route('**/api/shutdown', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Failed to connect via SSH',
          details: 'Connection timeout'
        })
      });
    });

    page.on('dialog', dialog => dialog.accept());
    await page.locator('button:has-text("Shutdown")').first().click();
    await page.waitForTimeout(500);

    await expect(page.locator('text=Error: Failed to connect via SSH - Connection timeout')).toBeVisible();
  });

  test('should handle missing SSH credentials error', async ({ page }) => {
    await createDeviceWithSSH(page, true);
    await page.waitForTimeout(2000);

    // Mock missing credentials error
    await page.route('**/api/shutdown', route => {
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'SSH credentials not configured for this device'
        })
      });
    });

    page.on('dialog', dialog => dialog.accept());
    await page.locator('button:has-text("Shutdown")').first().click();
    await page.waitForTimeout(500);

    await expect(page.locator('text=Error: SSH credentials not configured for this device')).toBeVisible();
  });

  test('should disable SSH buttons during command execution', async ({ page }) => {
    await createDeviceWithSSH(page, true);
    await page.waitForTimeout(2000);

    // Mock slow shutdown command
    await page.route('**/api/shutdown', async route => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'Shutdown sent' })
      });
    });

    page.on('dialog', dialog => dialog.accept());

    const shutdownButton = page.locator('button:has-text("Shutdown")').first();
    const sleepButton = page.locator('button:has-text("Sleep")').first();

    await shutdownButton.click();

    // Both buttons should be disabled during execution
    await expect(shutdownButton).toBeDisabled();
    await expect(sleepButton).toBeDisabled();
  });

  test('should cancel shutdown when dialog is dismissed', async ({ page }) => {
    await createDeviceWithSSH(page, true);
    await page.waitForTimeout(2000);

    page.on('dialog', dialog => dialog.dismiss());

    await page.locator('button:has-text("Shutdown")').first().click();
    await page.waitForTimeout(500);

    // No success message should appear
    await expect(page.locator('text=Success! Shutdown command sent')).not.toBeVisible();
  });

  test('should handle device not found error', async ({ page }) => {
    await createDeviceWithSSH(page, true);
    await page.waitForTimeout(2000);

    // Mock device not found error
    await page.route('**/api/shutdown', route => {
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Device not found' })
      });
    });

    page.on('dialog', dialog => dialog.accept());
    await page.locator('button:has-text("Shutdown")').first().click();
    await page.waitForTimeout(500);

    await expect(page.locator('text=Error: Device not found')).toBeVisible();
  });

  test('should show sending status message', async ({ page }) => {
    await createDeviceWithSSH(page, true);
    await page.waitForTimeout(2000);

    await page.route('**/api/shutdown', async route => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'Shutdown sent' })
      });
    });

    page.on('dialog', dialog => dialog.accept());
    await page.locator('button:has-text("Shutdown")').first().click();

    // Sending status should appear
    await expect(page.locator(`text=Sending shutdown command to ${TEST_DEVICES.withAllFields.name}...`)).toBeVisible();
  });
});
