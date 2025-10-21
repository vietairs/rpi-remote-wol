# Quick Start Guide - Homebridge Plugin

Get your PC metrics in Apple Home app in 5 minutes!

## Prerequisites

✅ Raspberry Pi with PC Remote Wake running (http://localhost:3000)
✅ Homebridge installed on Raspberry Pi
✅ iPhone/iPad with Home app

## Installation (5 minutes)

### Step 1: Install the Plugin

SSH into your Raspberry Pi and run:

```bash
cd ~/rpi-remote-wol/homebridge-plugin
chmod +x install.sh
./install.sh
```

The script will:
- Install dependencies
- Link the plugin to Homebridge
- Guide you through configuration

### Step 2: Generate API Key

1. Open web browser: http://your-raspberry-pi-ip:3000
2. Login to PC Remote Wake
3. Click your username → **Generate API Key**
4. Copy the key (looks like: `pcw_xxxxxxxxxxxxx`)
5. **Save it** - you won't see it again!

### Step 3: Find Device ID

1. In PC Remote Wake web UI
2. Look at your device in "Saved Devices"
3. The device ID is shown (usually `1` if it's your first device)

### Step 4: Configure Homebridge

#### Option A: Using Homebridge UI (Recommended)

1. Open Homebridge UI: http://your-raspberry-pi-ip:8581
2. Go to **Plugins** tab
3. Search for "PC Remote Wake" (should show as installed)
4. Click **Settings** (⚙️ icon)
5. Fill in:
   - API Key: `pcw_xxxxxxxxxxxxx`
   - Device ID: `1`
   - Device Name: `Gaming PC`
6. Click **Save**
7. Restart Homebridge

#### Option B: Manual Configuration

Edit `~/.homebridge/config.json`:

```json
{
  "bridge": {
    ...
  },
  "platforms": [
    {
      "platform": "PCRemoteWake",
      "name": "PC Remote Wake",
      "baseUrl": "http://localhost:3000",
      "apiKey": "pcw_xxxxxxxxxxxxx",
      "deviceId": 1,
      "deviceName": "Gaming PC",
      "pollingInterval": 30
    }
  ]
}
```

Restart Homebridge:
```bash
sudo systemctl restart homebridge
# Or
sudo hb-service restart
```

### Step 5: Add to Home App

1. Open **Home** app on iPhone/iPad
2. Your PC accessories should appear automatically
3. If not, tap **+** → **Add Accessory** → **More Options**
4. Select your Homebridge bridge
5. Your PC accessories will appear

## What You'll See in Home App

### Main Control Device (One device with 3 switches)
- 🎮 **Gaming PC** (or your custom device name)
  - ⚡ **Wake** - Tap to wake your computer
  - 💤 **Sleep** - Tap to put PC to sleep
  - 🔴 **Shutdown** - Tap to shutdown PC

### Monitoring (Separate accessories)
- 📱 **Device Status** - Contact sensor (shows online/offline)
- 🌡️ **CPU Usage** - Temperature sensor (°C = % usage)
- 💧 **RAM Usage** - Humidity sensor (% = % usage)
- 🌡️ **GPU Usage** - Temperature sensor (°C = % usage)
- 💡 **Power Consumption** - Light sensor (Lux = Watts)

## Using with Siri

Try these commands:

- **"Hey Siri, turn on Wake"** - Wake your computer
- **"Hey Siri, turn on Sleep"** - Put PC to sleep
- **"Hey Siri, turn on Shutdown"** - Shutdown computer
- **"Hey Siri, what's the CPU temperature?"** - Check CPU usage
- **"Hey Siri, what's the humidity in Gaming PC?"** - Check RAM usage

## Creating Automations

### Example: Night Mode
1. Open Home app
2. Go to **Automation** tab
3. Create "When Time is 11:00 PM"
4. Add action: Turn on "Sleep" (under Gaming PC)
5. Your PC automatically sleeps at 11 PM!

### Example: Work Hours Monitor
1. Create automation "When I arrive at Home"
2. If "Device Status" is "Not Detected" (offline)
3. Send notification "Your PC is offline"
4. Turn on "Wake" (under Gaming PC)

### Example: Power Monitoring
1. Create automation based on "Power Consumption"
2. If light level > 400 lux (400W)
3. Send notification "High power usage detected"

## Troubleshooting

### Accessories not appearing
```bash
# Check Homebridge logs
tail -f ~/.homebridge/homebridge.log

# Look for errors from PC Remote Wake plugin
```

### Check plugin is loaded
```bash
# Should show homebridge-pc-remote-wake
npm list -g | grep homebridge-pc-remote-wake
```

### Test API connection
```bash
# Replace with your API key
curl -H "Authorization: Bearer pcw_xxxxxxxxxxxxx" \
  http://localhost:3000/api/devices
```

### Restart Homebridge
```bash
# Using systemd
sudo systemctl restart homebridge

# Using hb-service
sudo hb-service restart

# Check status
sudo systemctl status homebridge
```

## Advanced Configuration

### Multiple PCs

Add multiple platform entries in config.json:

```json
{
  "platforms": [
    {
      "platform": "PCRemoteWake",
      "name": "Gaming PC",
      "apiKey": "pcw_xxxxxxxxxxxxx",
      "deviceId": 1,
      "deviceName": "Gaming PC"
    },
    {
      "platform": "PCRemoteWake",
      "name": "Work PC",
      "apiKey": "pcw_xxxxxxxxxxxxx",
      "deviceId": 2,
      "deviceName": "Work PC"
    }
  ]
}
```

### Custom Polling Interval

Poll more/less frequently:

```json
{
  "pollingInterval": 60  // Check every 60 seconds
}
```

Recommended: 30-60 seconds for balance between responsiveness and network usage.

### Remote Access

If PC Remote Wake is on different machine:

```json
{
  "baseUrl": "http://192.168.1.100:3000"
}
```

## Tips & Tricks

### Organize in Rooms
1. In Home app, long-press an accessory
2. Select "Room"
3. Assign to "Office" or "Gaming Room"

### Create Scenes
1. Go to **Scenes** tab
2. Create "Gaming Mode" scene
3. Add action: Turn on "Wake" (under Gaming PC)
4. Add action: Set lights to gaming colors

### Widget Dashboard
1. Add Home app widget to iPhone home screen
2. Pin your favorite accessories (Wake PC, CPU usage)
3. Quick glance at PC status!

## Support

- GitHub Issues: https://github.com/vietairs/rpi-remote-wol/issues
- Full Documentation: See README.md
- PC Remote Wake Docs: See main project README

Enjoy controlling your PC with Siri! 🎉
