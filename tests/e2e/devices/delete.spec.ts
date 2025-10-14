import { test, expect } from '@playwright/test';
import { setupTestDatabase, resetDatabase, getDeviceCount } from '../../fixtures/db-helpers';
import { setupTestUser, loginAsTestUser } from '../../fixtures/auth-helpers';
import { TEST_DEVICES } from '../../fixtures/test-data';

test.describe('Device Management - Delete', () => {
  test.beforeAll(async () => {
    await setupTestDatabase();
  });

  test.beforeEach(async ({ page }) => {
    await resetDatabase();
    await setupTestUser(page);
    await loginAsTestUser(page);
  });

  async function createTestDevice(page: any, device = TEST_DEVICES.valid) {
    await page.click('button:has-text("Save This Device")');
    await page.fill('input[placeholder*="Device name"]', device.name);
    await page.fill('input[id="macAddress"]', device.macAddress);
    if (device.ipAddress) {
      await page.fill('input[placeholder*="IP Address"]', device.ipAddress);
    }
    await page.click('button:has-text("Save")');
    await page.waitForTimeout(500);
  }

  test('should delete device successfully', async ({ page }) => {
    await createTestDevice(page);

    // Click delete button
    await page.click('button[title="Delete device"]');

    // Confirm deletion in dialog
    page.on('dialog', dialog => dialog.accept());

    // Device should be removed
    await expect(page.locator(`text=${TEST_DEVICES.valid.name}`)).not.toBeVisible();
    await expect(page.locator('text=Device deleted successfully')).toBeVisible();

    // Verify database
    expect(await getDeviceCount()).toBe(0);
  });

  test('should show confirmation dialog before deleting', async ({ page }) => {
    await createTestDevice(page);

    let dialogShown = false;
    page.on('dialog', dialog => {
      dialogShown = true;
      expect(dialog.message()).toContain('Are you sure you want to delete this device');
      dialog.dismiss();
    });

    await page.click('button[title="Delete device"]');
    await page.waitForTimeout(500);

    expect(dialogShown).toBe(true);
  });

  test('should cancel deletion when dialog is dismissed', async ({ page }) => {
    await createTestDevice(page);

    page.on('dialog', dialog => dialog.dismiss());

    await page.click('button[title="Delete device"]');
    await page.waitForTimeout(500);

    // Device should still be visible
    await expect(page.locator(`text=${TEST_DEVICES.valid.name}`)).toBeVisible();
    expect(await getDeviceCount()).toBe(1);
  });

  test('should clear selection after deleting selected device', async ({ page }) => {
    await createTestDevice(page);

    // Select the device
    await page.click(`text=${TEST_DEVICES.valid.name}`);

    // Verify it's selected (MAC is populated)
    await expect(page.locator('input[id="macAddress"]')).toHaveValue(TEST_DEVICES.valid.macAddress);

    // Delete it
    page.on('dialog', dialog => dialog.accept());
    await page.click('button[title="Delete device"]');
    await page.waitForTimeout(500);

    // MAC input should be cleared
    await expect(page.locator('input[id="macAddress"]')).toHaveValue('');
  });

  test('should not clear selection when deleting different device', async ({ page }) => {
    // Create two devices
    await createTestDevice(page, TEST_DEVICES.valid);
    await createTestDevice(page, TEST_DEVICES.noSsh);

    // Select first device
    await page.click(`text=${TEST_DEVICES.valid.name}`);
    await expect(page.locator('input[id="macAddress"]')).toHaveValue(TEST_DEVICES.valid.macAddress);

    // Delete second device
    page.on('dialog', dialog => dialog.accept());
    const deleteButtons = page.locator('button[title="Delete device"]');
    await deleteButtons.nth(1).click();
    await page.waitForTimeout(500);

    // First device should still be selected
    await expect(page.locator('input[id="macAddress"]')).toHaveValue(TEST_DEVICES.valid.macAddress);
    await expect(page.locator(`text=${TEST_DEVICES.valid.name}`)).toBeVisible();
    await expect(page.locator(`text=${TEST_DEVICES.noSsh.name}`)).not.toBeVisible();
  });

  test('should delete multiple devices independently', async ({ page }) => {
    // Create three devices
    await createTestDevice(page, TEST_DEVICES.valid);
    await createTestDevice(page, TEST_DEVICES.noSsh);
    await createTestDevice(page, TEST_DEVICES.noIp);

    expect(await getDeviceCount()).toBe(3);

    // Delete first device
    page.on('dialog', dialog => dialog.accept());
    await page.locator('button[title="Delete device"]').nth(0).click();
    await page.waitForTimeout(500);

    expect(await getDeviceCount()).toBe(2);

    // Delete another device
    await page.locator('button[title="Delete device"]').nth(0).click();
    await page.waitForTimeout(500);

    expect(await getDeviceCount()).toBe(1);
  });

  test('should show empty state after deleting all devices', async ({ page }) => {
    await createTestDevice(page);

    page.on('dialog', dialog => dialog.accept());
    await page.click('button[title="Delete device"]');
    await page.waitForTimeout(500);

    await expect(page.locator('text=No saved devices yet')).toBeVisible();
  });

  test('should handle deletion errors gracefully', async ({ page }) => {
    await createTestDevice(page);

    // Intercept delete request to simulate error
    await page.route('**/api/devices/*', route => {
      if (route.request().method() === 'DELETE') {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Database error' })
        });
      } else {
        route.continue();
      }
    });

    page.on('dialog', dialog => dialog.accept());
    await page.click('button[title="Delete device"]');
    await page.waitForTimeout(500);

    // Error message should be displayed
    await expect(page.locator('text=Error: Database error')).toBeVisible();

    // Device should still be visible
    await expect(page.locator(`text=${TEST_DEVICES.valid.name}`)).toBeVisible();
  });

  test('should handle non-existent device deletion', async ({ page }) => {
    await createTestDevice(page);

    // Intercept delete request to return 404
    await page.route('**/api/devices/*', route => {
      if (route.request().method() === 'DELETE') {
        route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Device not found' })
        });
      } else {
        route.continue();
      }
    });

    page.on('dialog', dialog => dialog.accept());
    await page.click('button[title="Delete device"]');
    await page.waitForTimeout(500);

    await expect(page.locator('text=Error: Device not found')).toBeVisible();
  });

  test('should stop propagation when clicking delete button', async ({ page }) => {
    await createTestDevice(page);

    // Click delete button should not select the device
    const deleteButton = page.locator('button[title="Delete device"]');

    page.on('dialog', dialog => dialog.dismiss());
    await deleteButton.click();
    await page.waitForTimeout(500);

    // Device should not be selected (MAC should be empty)
    const macInput = page.locator('input[id="macAddress"]');
    await expect(macInput).toHaveValue('');
  });
});
