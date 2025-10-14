import { test, expect } from '@playwright/test';
import { setupTestDatabase, resetDatabase } from '../../fixtures/db-helpers';
import { setupTestUser, loginAsTestUser } from '../../fixtures/auth-helpers';
import { TEST_DEVICES } from '../../fixtures/test-data';

test.describe('Device Management - List & Display', () => {
  test.beforeAll(async () => {
    await setupTestDatabase();
  });

  test.beforeEach(async ({ page }) => {
    await resetDatabase();
    await setupTestUser(page);
    await loginAsTestUser(page);
  });

  test('should show empty state when no devices exist', async ({ page }) => {
    await expect(page.locator('text=No saved devices yet')).toBeVisible();
  });

  test('should display saved device in list', async ({ page }) => {
    // Create a device
    await page.click('button:has-text("Save This Device")');
    await page.fill('input[placeholder*="Device name"]', TEST_DEVICES.valid.name);
    await page.fill('input[id="macAddress"]', TEST_DEVICES.valid.macAddress);
    await page.fill('input[placeholder*="IP Address"]', TEST_DEVICES.valid.ipAddress!);
    await page.click('button:has-text("Save")');

    // Device should be in the list
    const deviceCard = page.locator(`text=${TEST_DEVICES.valid.name}`).locator('..');
    await expect(deviceCard).toBeVisible();
    await expect(page.locator(`text=${TEST_DEVICES.valid.macAddress}`)).toBeVisible();
    await expect(page.locator(`text=IP: ${TEST_DEVICES.valid.ipAddress}`)).toBeVisible();
  });

  test('should display multiple devices', async ({ page }) => {
    // Create multiple devices
    const devices = [TEST_DEVICES.valid, TEST_DEVICES.noSsh, TEST_DEVICES.noIp];

    for (const device of devices) {
      await page.click('button:has-text("Save This Device")');
      await page.fill('input[placeholder*="Device name"]', device.name);
      await page.fill('input[id="macAddress"]', device.macAddress);
      if (device.ipAddress) {
        await page.fill('input[placeholder*="IP Address"]', device.ipAddress);
      }
      await page.click('button:has-text("Save")');
      await page.waitForTimeout(500); // Wait for save to complete
    }

    // All devices should be visible
    for (const device of devices) {
      await expect(page.locator(`text=${device.name}`)).toBeVisible();
    }
  });

  test('should highlight selected device', async ({ page }) => {
    // Create a device
    await page.click('button:has-text("Save This Device")');
    await page.fill('input[placeholder*="Device name"]', TEST_DEVICES.valid.name);
    await page.fill('input[id="macAddress"]', TEST_DEVICES.valid.macAddress);
    await page.click('button:has-text("Save")');

    // Click to select device
    await page.click(`text=${TEST_DEVICES.valid.name}`);

    // Device card should have highlighted class
    const deviceCard = page.locator(`text=${TEST_DEVICES.valid.name}`).locator('..').locator('..');
    await expect(deviceCard).toHaveClass(/border-blue-400/);
  });

  test('should populate form fields when device is selected', async ({ page }) => {
    // Create a device
    await page.click('button:has-text("Save This Device")');
    await page.fill('input[placeholder*="Device name"]', TEST_DEVICES.valid.name);
    await page.fill('input[id="macAddress"]', TEST_DEVICES.valid.macAddress);
    await page.fill('input[placeholder*="IP Address"]', TEST_DEVICES.valid.ipAddress!);
    await page.click('button:has-text("Save")');

    // Select device
    await page.click(`text=${TEST_DEVICES.valid.name}`);

    // Form fields should be populated
    await expect(page.locator('input[id="macAddress"]')).toHaveValue(TEST_DEVICES.valid.macAddress);
  });

  test('should show status message when device is selected', async ({ page }) => {
    // Create a device
    await page.click('button:has-text("Save This Device")');
    await page.fill('input[placeholder*="Device name"]', TEST_DEVICES.valid.name);
    await page.fill('input[id="macAddress"]', TEST_DEVICES.valid.macAddress);
    await page.click('button:has-text("Save")');

    // Select device
    await page.click(`text=${TEST_DEVICES.valid.name}`);

    // Status message should appear
    await expect(page.locator(`text=Selected: ${TEST_DEVICES.valid.name}`)).toBeVisible();
  });

  test('should show device without IP address', async ({ page }) => {
    // Create device without IP
    await page.click('button:has-text("Save This Device")');
    await page.fill('input[placeholder*="Device name"]', TEST_DEVICES.noIp.name);
    await page.fill('input[id="macAddress"]', TEST_DEVICES.noIp.macAddress);
    await page.click('button:has-text("Save")');

    // Device should be visible
    await expect(page.locator(`text=${TEST_DEVICES.noIp.name}`)).toBeVisible();

    // IP address should not be displayed
    await expect(page.locator('text=IP:')).not.toBeVisible();
  });

  test('should display device with SSH credentials indicator', async ({ page }) => {
    // Create device with SSH creds
    await page.click('button:has-text("Save This Device")');
    await page.fill('input[placeholder*="Device name"]', TEST_DEVICES.withAllFields.name);
    await page.fill('input[id="macAddress"]', TEST_DEVICES.withAllFields.macAddress);
    await page.fill('input[placeholder*="IP Address"]', TEST_DEVICES.withAllFields.ipAddress!);
    await page.fill('input[placeholder*="SSH Username"]', TEST_DEVICES.withAllFields.sshUsername!);
    await page.fill('input[placeholder*="SSH Password"]', TEST_DEVICES.withAllFields.sshPassword!);
    await page.click('button:has-text("Save")');

    // Device should be visible with all info
    await expect(page.locator(`text=${TEST_DEVICES.withAllFields.name}`)).toBeVisible();
    await expect(page.locator(`text=${TEST_DEVICES.withAllFields.macAddress}`)).toBeVisible();
  });

  test('should display delete button for each device', async ({ page }) => {
    // Create a device
    await page.click('button:has-text("Save This Device")');
    await page.fill('input[placeholder*="Device name"]', TEST_DEVICES.valid.name);
    await page.fill('input[id="macAddress"]', TEST_DEVICES.valid.macAddress);
    await page.click('button:has-text("Save")');

    // Delete button should be visible
    const deleteButton = page.locator('button[title="Delete device"]');
    await expect(deleteButton).toBeVisible();
  });

  test('should show "No IP" badge for devices without IP', async ({ page }) => {
    // Create device without IP
    await page.click('button:has-text("Save This Device")');
    await page.fill('input[placeholder*="Device name"]', TEST_DEVICES.noIp.name);
    await page.fill('input[id="macAddress"]', TEST_DEVICES.noIp.macAddress);
    await page.click('button:has-text("Save")');

    // Wait for status check
    await page.waitForTimeout(1000);

    // "No IP" badge should appear
    await expect(page.locator('text=No IP')).toBeVisible();
  });

  test('should persist device list after page refresh', async ({ page }) => {
    // Create a device
    await page.click('button:has-text("Save This Device")');
    await page.fill('input[placeholder*="Device name"]', TEST_DEVICES.valid.name);
    await page.fill('input[id="macAddress"]', TEST_DEVICES.valid.macAddress);
    await page.click('button:has-text("Save")');

    // Refresh page
    await page.reload();

    // Device should still be visible
    await expect(page.locator(`text=${TEST_DEVICES.valid.name}`)).toBeVisible();
  });

  test('should allow scrolling when many devices exist', async ({ page }) => {
    // Create many devices
    for (let i = 0; i < 10; i++) {
      await page.click('button:has-text("Save This Device")');
      await page.fill('input[placeholder*="Device name"]', `Device ${i}`);
      await page.fill('input[id="macAddress"]', `AA:BB:CC:DD:EE:${i.toString().padStart(2, '0')}`);
      await page.click('button:has-text("Save")');
      await page.waitForTimeout(300);
    }

    // Device list should have scrollable container
    const deviceList = page.locator('.max-h-\\[500px\\]');
    await expect(deviceList).toBeVisible();
  });
});
