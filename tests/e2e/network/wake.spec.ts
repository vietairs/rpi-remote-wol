import { test, expect } from '@playwright/test';
import { setupTestDatabase, resetDatabase } from '../../fixtures/db-helpers';
import { setupTestUser, loginAsTestUser } from '../../fixtures/auth-helpers';
import { TEST_DEVICES } from '../../fixtures/test-data';

test.describe('Network Operations - Wake-on-LAN', () => {
  test.beforeAll(async () => {
    await setupTestDatabase();
  });

  test.beforeEach(async ({ page }) => {
    await resetDatabase();
    await setupTestUser(page);
    await loginAsTestUser(page);
  });

  test('should show error when no MAC address is entered', async ({ page }) => {
    await page.click('button:has-text("Wake PC")');

    await expect(page.locator('text=Please enter a MAC address')).toBeVisible();
  });

  test('should send wake-on-LAN packet with valid MAC', async ({ page }) => {
    await page.fill('input[id="macAddress"]', TEST_DEVICES.valid.macAddress);

    // Mock the WOL API response
    await page.route('**/api/wake', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Wake-on-LAN packet sent successfully',
          macAddress: TEST_DEVICES.valid.macAddress
        })
      });
    });

    await page.click('button:has-text("Wake PC")');

    await expect(page.locator(`text=Success! Wake packet sent to ${TEST_DEVICES.valid.macAddress}`)).toBeVisible();
  });

  test('should show loading state while sending wake packet', async ({ page }) => {
    await page.fill('input[id="macAddress"]', TEST_DEVICES.valid.macAddress);

    // Add delay to mock response to see loading state
    await page.route('**/api/wake', async route => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, macAddress: TEST_DEVICES.valid.macAddress })
      });
    });

    await page.click('button:has-text("Wake PC")');

    // Loading spinner should appear
    await expect(page.locator('text=Sending...')).toBeVisible();
  });

  test('should disable wake button during loading', async ({ page }) => {
    await page.fill('input[id="macAddress"]', TEST_DEVICES.valid.macAddress);

    await page.route('**/api/wake', async route => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, macAddress: TEST_DEVICES.valid.macAddress })
      });
    });

    const wakeButton = page.locator('button:has-text("Wake PC")');
    await wakeButton.click();

    // Button should be disabled
    await expect(wakeButton).toBeDisabled();
  });

  test('should handle invalid MAC address format', async ({ page }) => {
    await page.fill('input[id="macAddress"]', 'INVALID-MAC');

    await page.route('**/api/wake', route => {
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Invalid MAC address format' })
      });
    });

    await page.click('button:has-text("Wake PC")');

    await expect(page.locator('text=Error: Invalid MAC address format')).toBeVisible();
  });

  test('should handle network errors gracefully', async ({ page }) => {
    await page.fill('input[id="macAddress"]', TEST_DEVICES.valid.macAddress);

    await page.route('**/api/wake', route => {
      route.abort('failed');
    });

    await page.click('button:has-text("Wake PC")');

    await expect(page.locator('text=Failed to connect to server')).toBeVisible();
  });

  test('should accept MAC address from saved device', async ({ page }) => {
    // Create and save a device first
    await page.click('button:has-text("Save This Device")');
    await page.fill('input[placeholder*="Device name"]', TEST_DEVICES.valid.name);
    await page.fill('input[id="macAddress"]', TEST_DEVICES.valid.macAddress);
    await page.click('button:has-text("Save")');

    await page.waitForTimeout(500);

    // Select the device
    await page.click(`text=${TEST_DEVICES.valid.name}`);

    // MAC should be populated
    await expect(page.locator('input[id="macAddress"]')).toHaveValue(TEST_DEVICES.valid.macAddress);

    // Mock WOL response
    await page.route('**/api/wake', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, macAddress: TEST_DEVICES.valid.macAddress })
      });
    });

    await page.click('button:has-text("Wake PC")');

    await expect(page.locator(`text=Success! Wake packet sent to ${TEST_DEVICES.valid.macAddress}`)).toBeVisible();
  });

  test('should show status message while sending', async ({ page }) => {
    await page.fill('input[id="macAddress"]', TEST_DEVICES.valid.macAddress);

    await page.route('**/api/wake', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, macAddress: TEST_DEVICES.valid.macAddress })
      });
    });

    await page.click('button:has-text("Wake PC")');

    // Sending message should appear first
    await expect(page.locator('text=Sending Wake-on-LAN packet...')).toBeVisible();
  });

  test('should handle server errors', async ({ page }) => {
    await page.fill('input[id="macAddress"]', TEST_DEVICES.valid.macAddress);

    await page.route('**/api/wake', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Failed to send Wake-on-LAN packet' })
      });
    });

    await page.click('button:has-text("Wake PC")');

    await expect(page.locator('text=Error: Failed to send Wake-on-LAN packet')).toBeVisible();
  });

  test('should accept MAC with dashes format', async ({ page }) => {
    await page.fill('input[id="macAddress"]', TEST_DEVICES.withDashes.macAddress);

    await page.route('**/api/wake', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, macAddress: TEST_DEVICES.withDashes.macAddress })
      });
    });

    await page.click('button:has-text("Wake PC")');

    await expect(page.locator(`text=Success! Wake packet sent to ${TEST_DEVICES.withDashes.macAddress}`)).toBeVisible();
  });

  test('should show format hint for MAC address', async ({ page }) => {
    await expect(page.locator('text=Format: XX:XX:XX:XX:XX:XX or XX-XX-XX-XX-XX-XX')).toBeVisible();
  });

  test('should have appropriate placeholder for MAC input', async ({ page }) => {
    const macInput = page.locator('input[id="macAddress"]');
    await expect(macInput).toHaveAttribute('placeholder', 'XX:XX:XX:XX:XX:XX');
  });
});
