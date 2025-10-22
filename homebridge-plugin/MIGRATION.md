# Migration Guide: v2.0.0 → v2.1.0

## What Changed?

**Old behavior (v2.0.0):**
- Created **6 separate accessories** per device
- Sensors scattered across different HomeKit categories
- CPU/GPU sensors appeared in Temperature section
- RAM sensor appeared in Humidity section
- Power sensor appeared in Light section
- Device status and controls were separate

**New behavior (v2.1.0):**
- Creates **1 consolidated accessory** per device
- All controls and sensors appear together on device page
- Device Status (online/offline) visible with controls
- Easier to find and manage all PC-related sensors
- Cleaner Home app organization

## Migration Steps

### Step 1: Update the Plugin

```bash
cd ~/Projects/rpi-remote-wol/homebridge-plugin
npm install
```

Or if installed globally via npm:
```bash
npm update -g homebridge-pc-remote-wake
```

### Step 2: Remove Old Accessories

**Important:** You must remove the old accessories before the new ones will appear correctly.

1. Open the **Home app** on your iOS device
2. Long-press the **HVN Home PC** accessory
3. Scroll down and tap **Remove Accessory**
4. Confirm removal
5. Repeat for any other PC accessories (CPU %, RAM %, etc.)

### Step 3: Restart Homebridge

```bash
# If using Homebridge UI
# Restart via the UI

# If using systemd service
sudo systemctl restart homebridge

# If running manually
# Stop and restart homebridge
```

### Step 4: Clear Homebridge Cache (if needed)

If accessories don't appear correctly:

```bash
# Stop Homebridge first
rm -rf ~/.homebridge/accessories/cachedAccessories
# Restart Homebridge
```

### Step 5: Add New Consolidated Accessory

1. Open the **Home app**
2. Tap **+** (Add Accessory)
3. Scan the Homebridge QR code or enter the code manually
4. Wait for "HVN Home PC" to appear
5. Tap **Add to Home**
6. Assign to a room

### Step 6: Verify All Services

After adding the accessory, you should see **on the same page**:
- ✅ Device Status (Contact Sensor)
- ✅ Wake (Switch)
- ✅ Sleep (Switch)
- ✅ Shutdown (Switch)
- ✅ CPU % (Temperature Sensor)
- ✅ RAM % (Humidity Sensor)
- ✅ GPU % (Temperature Sensor)
- ✅ Power (W) (Light Sensor)

All 8 services should appear together when you open the device in Home app.

## Troubleshooting

### Accessories Still Scattered Across Categories

**Problem:** Sensors still appear in separate Temperature/Humidity sections

**Solution:**
1. Remove ALL old accessories completely
2. Clear Homebridge cached accessories: `rm -rf ~/.homebridge/accessories/cachedAccessories`
3. Restart Homebridge
4. Re-add the accessory from scratch

### "No Response" on Sensors

**Problem:** Sensors show "No Response"

**Solution:**
1. Verify PC is online and SSH is configured
2. Check API endpoint: `curl -H "Authorization: Bearer YOUR_API_KEY" http://localhost:3000/api/devices`
3. Manually collect metrics: `curl -X POST -H "Authorization: Bearer YOUR_API_KEY" http://localhost:3000/api/metrics/collect -d '{"deviceId": 1}'`
4. Check Homebridge logs for errors

### Device Status Always Shows "Not Detected"

**Problem:** Online status never updates

**Solution:**
1. Verify device has `ip_address` configured in database
2. Test status endpoint: `curl -X POST -H "Authorization: Bearer YOUR_API_KEY" http://localhost:3000/api/status -d '{"ipAddress": "192.168.1.100"}'`
3. Ensure PC allows TCP ping on ports 445 (SMB) or 3389 (RDP)
4. Check polling interval in Homebridge config (default 30s)

### Accessories Appear Twice

**Problem:** Both old (6 accessories) and new (1 accessory) exist

**Solution:**
1. Remove ALL accessories from Home app
2. Clear cache: `rm -rf ~/.homebridge/accessories/cachedAccessories`
3. Restart Homebridge
4. Re-add ONLY the new consolidated accessory

## Benefits of New Structure

- **Better Organization:** All PC controls/sensors in one place
- **Easier Discovery:** No more hunting through sensor categories
- **Visual Clarity:** See device status alongside controls
- **Faster Access:** Fewer taps to reach metrics
- **Cleaner Home:** Reduces accessory clutter in app

## Rollback (if needed)

If you need to revert to the old behavior:

```bash
cd ~/Projects/rpi-remote-wol/homebridge-plugin
git checkout v2.0.0
npm install
# Restart Homebridge
```

Then remove the new accessory and re-add the old ones.

## Need Help?

- Check Homebridge logs: `journalctl -u homebridge -f` (systemd) or Homebridge UI logs
- Verify API connectivity: `curl -H "Authorization: Bearer YOUR_API_KEY" http://localhost:3000/api/devices`
- Ensure database has device configured: Check `data/devices.db`
- Review configuration: `~/.homebridge/config.json`
