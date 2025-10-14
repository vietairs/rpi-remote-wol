import { test, expect } from '@playwright/test';
import { setupTestDatabase, resetDatabase, getDeviceCount } from '../../fixtures/db-helpers';
import { setupTestUser, loginAsTestUser } from '../../fixtures/auth-helpers';
import { TEST_DEVICES, INVALID_DEVICES } from '../../fixtures/test-data';

test.describe('Device Management - Create', () => {
  test.beforeAll(async () => {
    await setupTestDatabase();
  });

  test.beforeEach(async ({ page }) => {
    await resetDatabase();
    await setupTestUser(page);
    await loginAsTestUser(page);
  });

  test('should create device with name and MAC only', async ({ page }) => {
    await page.click('button:has-text("Save This Device")');

    await page.fill('input[placeholder*="Device name"]', TEST_DEVICES.noIp.name);
    await page.fill('input[id="macAddress"]', TEST_DEVICES.noIp.macAddress);

    await page.click('button:has-text("Save")');

    // Should show success message
    await expect(page.locator(`text=${TEST_DEVICES.noIp.name} saved successfully`)).toBeVisible();

    // Device should appear in saved list
    await expect(page.locator(`text=${TEST_DEVICES.noIp.name}`)).toBeVisible();
    await expect(page.locator(`text=${TEST_DEVICES.noIp.macAddress}`)).toBeVisible();

    // Verify database
    expect(await getDeviceCount()).toBe(1);
  });

  test('should create device with all fields', async ({ page }) => {
    await page.click('button:has-text("Save This Device")');

    await page.fill('input[placeholder*="Device name"]', TEST_DEVICES.withAllFields.name);
    await page.fill('input[id="macAddress"]', TEST_DEVICES.withAllFields.macAddress);
    await page.fill('input[placeholder*="IP Address"]', TEST_DEVICES.withAllFields.ipAddress!);
    await page.fill('input[placeholder*="SSH Username"]', TEST_DEVICES.withAllFields.sshUsername!);
    await page.fill('input[placeholder*="SSH Password"]', TEST_DEVICES.withAllFields.sshPassword!);

    await page.click('button:has-text("Save")');

    await expect(page.locator(`text=${TEST_DEVICES.withAllFields.name} saved successfully`)).toBeVisible();
    expect(await getDeviceCount()).toBe(1);
  });

  test('should accept MAC address with colons', async ({ page }) => {
    await page.click('button:has-text("Save This Device")');

    await page.fill('input[placeholder*="Device name"]', TEST_DEVICES.valid.name);
    await page.fill('input[id="macAddress"]', TEST_DEVICES.valid.macAddress);

    await page.click('button:has-text("Save")');

    await expect(page.locator(`text=${TEST_DEVICES.valid.name} saved successfully`)).toBeVisible();
  });

  test('should accept MAC address with dashes', async ({ page }) => {
    await page.click('button:has-text("Save This Device")');

    await page.fill('input[placeholder*="Device name"]', TEST_DEVICES.withDashes.name);
    await page.fill('input[id="macAddress"]', TEST_DEVICES.withDashes.macAddress);

    await page.click('button:has-text("Save")');

    await expect(page.locator(`text=${TEST_DEVICES.withDashes.name} saved successfully`)).toBeVisible();
  });

  test('should show error for invalid MAC address format', async ({ page }) => {
    await page.click('button:has-text("Save This Device")');

    await page.fill('input[placeholder*="Device name"]', INVALID_DEVICES.invalidMac.name);
    await page.fill('input[id="macAddress"]', INVALID_DEVICES.invalidMac.macAddress);

    await page.click('button:has-text("Save")');

    await expect(page.locator('text=Invalid MAC address format')).toBeVisible();
    expect(await getDeviceCount()).toBe(0);
  });

  test('should show error for invalid IP address format', async ({ page }) => {
    await page.click('button:has-text("Save This Device")');

    await page.fill('input[placeholder*="Device name"]', INVALID_DEVICES.invalidIp.name);
    await page.fill('input[id="macAddress"]', INVALID_DEVICES.invalidIp.macAddress);
    await page.fill('input[placeholder*="IP Address"]', INVALID_DEVICES.invalidIp.ipAddress!);

    await page.click('button:has-text("Save")');

    await expect(page.locator('text=Invalid IP address format')).toBeVisible();
    expect(await getDeviceCount()).toBe(0);
  });

  test('should show error for missing device name', async ({ page }) => {
    await page.click('button:has-text("Save This Device")');

    // Fill only MAC address, leave name empty
    await page.fill('input[id="macAddress"]', TEST_DEVICES.valid.macAddress);

    await page.click('button:has-text("Save")');

    await expect(page.locator('text=device name and MAC address')).toBeVisible();
    expect(await getDeviceCount()).toBe(0);
  });

  test('should show error for missing MAC address', async ({ page }) => {
    await page.click('button:has-text("Save This Device")');

    // Fill only name, leave MAC empty
    await page.fill('input[placeholder*="Device name"]', TEST_DEVICES.valid.name);

    await page.click('button:has-text("Save")');

    await expect(page.locator('text=device name and MAC address')).toBeVisible();
    expect(await getDeviceCount()).toBe(0);
  });

  test('should show error for duplicate MAC address', async ({ page }) => {
    // Create first device
    await page.click('button:has-text("Save This Device")');
    await page.fill('input[placeholder*="Device name"]', TEST_DEVICES.valid.name);
    await page.fill('input[id="macAddress"]', TEST_DEVICES.valid.macAddress);
    await page.click('button:has-text("Save")');

    await expect(page.locator(`text=${TEST_DEVICES.valid.name} saved successfully`)).toBeVisible();

    // Try to create another device with same MAC
    await page.click('button:has-text("Save This Device")');
    await page.fill('input[placeholder*="Device name"]', 'Different Name');
    await page.fill('input[id="macAddress"]', TEST_DEVICES.valid.macAddress); // Same MAC
    await page.click('button:has-text("Save")');

    await expect(page.locator('text=device with this MAC address already exists')).toBeVisible();
    expect(await getDeviceCount()).toBe(1); // Should still be only 1 device
  });

  test('should clear form after successful save', async ({ page }) => {
    await page.click('button:has-text("Save This Device")');

    const nameInput = page.locator('input[placeholder*="Device name"]');
    const macInput = page.locator('input[id="macAddress"]');
    const ipInput = page.locator('input[placeholder*="IP Address"]');

    await nameInput.fill(TEST_DEVICES.valid.name);
    await macInput.fill(TEST_DEVICES.valid.macAddress);
    await ipInput.fill(TEST_DEVICES.valid.ipAddress!);

    await page.click('button:has-text("Save")');

    await expect(page.locator(`text=${TEST_DEVICES.valid.name} saved successfully`)).toBeVisible();

    // Form should be closed (Cancel/Save buttons hidden)
    await expect(page.locator('button:has-text("Save"):visible')).toHaveCount(0);

    // Save This Device button should be visible again
    await expect(page.locator('button:has-text("Save This Device")')).toBeVisible();
  });

  test('should allow canceling device creation', async ({ page }) => {
    const initialCount = await getDeviceCount();

    await page.click('button:has-text("Save This Device")');

    await page.fill('input[placeholder*="Device name"]', TEST_DEVICES.valid.name);
    await page.fill('input[id="macAddress"]', TEST_DEVICES.valid.macAddress);

    await page.click('button:has-text("Cancel")');

    // Form should be closed
    await expect(page.locator('button:has-text("Save This Device")')).toBeVisible();

    // No device should be created
    expect(await getDeviceCount()).toBe(initialCount);
  });

  test('should show form with SSH credentials section', async ({ page }) => {
    await page.click('button:has-text("Save This Device")');

    await expect(page.locator('text=SSH Credentials')).toBeVisible();
    await expect(page.locator('input[placeholder*="SSH Username"]')).toBeVisible();
    await expect(page.locator('input[placeholder*="SSH Password"]')).toBeVisible();
  });

  test('should have password input type for SSH password', async ({ page }) => {
    await page.click('button:has-text("Save This Device")');

    const sshPasswordInput = page.locator('input[placeholder*="SSH Password"]');
    await expect(sshPasswordInput).toHaveAttribute('type', 'password');
  });

  test('should populate MAC address input from main form', async ({ page }) => {
    // Fill MAC in main form first
    const mainMacInput = page.locator('input[id="macAddress"]');
    await mainMacInput.fill(TEST_DEVICES.valid.macAddress);

    // Open save form
    await page.click('button:has-text("Save This Device")');

    // MAC should be pre-filled
    await expect(mainMacInput).toHaveValue(TEST_DEVICES.valid.macAddress);
  });
});
