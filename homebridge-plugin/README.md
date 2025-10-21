# Homebridge PC Remote Wake Plugin

Monitor and control your Windows PC via Apple HomeKit using the PC Remote Wake API.

## Features

✅ **Device Status** - Contact sensor shows if PC is online/offline
✅ **Wake PC** - Switch to send Wake-on-LAN magic packet
✅ **Sleep PC** - Switch to put PC to sleep
✅ **Shutdown PC** - Switch to shutdown PC
✅ **CPU Usage** - Temperature sensor (0-100°C represents 0-100%)
✅ **RAM Usage** - Humidity sensor (0-100% humidity represents 0-100% RAM usage)
✅ **GPU Usage** - Temperature sensor (0-100°C represents 0-100%)
✅ **Power Consumption** - Light sensor (Lux = Watts)

## Prerequisites

1. **PC Remote Wake** running on Raspberry Pi (http://localhost:3000)
2. **Homebridge** installed on Raspberry Pi
3. **API Key** generated from PC Remote Wake web UI

## Installation

### Option 1: Local Installation (Recommended for development)

```bash
# From the rpi-remote-wol directory
cd homebridge-plugin
npm install
sudo npm link

# Homebridge will now be able to find the plugin
```

### Option 2: Global Installation

```bash
# Install globally
sudo npm install -g homebridge-pc-remote-wake
```

## Configuration

### Step 1: Generate API Key

1. Open PC Remote Wake web UI: http://localhost:3000
2. Login with your credentials
3. Generate a new API key (it will look like: `pcw_xxxxxxxxxxxxx`)
4. **Copy the API key** - it's only shown once!

### Step 2: Get Device ID

1. In the web UI, check the URL or device list
2. Your device ID is the numeric ID (e.g., `1`, `2`, `3`)

### Step 3: Configure Homebridge

Add this to your Homebridge `config.json`:

```json
{
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

### Configuration Options

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `platform` | ✅ | - | Must be `"PCRemoteWake"` |
| `name` | ✅ | - | Platform name (appears in logs) |
| `baseUrl` | ❌ | `http://localhost:3000` | PC Remote Wake API URL |
| `apiKey` | ✅ | - | API key from web UI |
| `deviceId` | ✅ | - | Device ID from web UI |
| `deviceName` | ❌ | `"PC"` | Device name (prefix for accessories) |
| `pollingInterval` | ❌ | `30` | Metrics polling interval (seconds) |

## HomeKit Accessories

Once configured and Homebridge is restarted, you'll see these accessories in the Home app:

### Main Control Device
- **[Device Name]** - Single device with 3 switches:
  - **Wake** - Tap to send WOL magic packet (auto-turns off)
  - **Sleep** - Tap to put PC to sleep (auto-turns off)
  - **Shutdown** - Tap to shutdown PC (auto-turns off)

### Status
- **[Device Name] Device Status** - Contact Sensor (Detected = Online, Not Detected = Offline)

### Monitoring
- **[Device Name] CPU Usage** - Temperature Sensor (°C = % usage)
- **[Device Name] RAM Usage** - Humidity Sensor (% = % usage)
- **GPU Usage** - Temperature Sensor (°C = % usage)
- **Power Consumption** - Light Sensor (Lux = Watts)

## Usage Examples

### Home App
1. Open Home app on iPhone/iPad
2. Navigate to your PC accessories
3. Tap "Wake PC" switch to wake your computer
4. View CPU, RAM, GPU usage as temperature/humidity sensors
5. View power consumption in the light sensor

### Siri Commands
- "Hey Siri, turn on Wake PC"
- "Hey Siri, what's the temperature of Gaming PC CPU Usage?"
- "Hey Siri, what's the humidity in Gaming PC RAM Usage?"

### Automations
Create automations based on PC status:
- Turn on smart lights when PC wakes up
- Send notification when power consumption exceeds threshold
- Automatically sleep PC at night

## Troubleshooting

### Accessories not appearing
1. Check Homebridge logs: `homebridge -D`
2. Verify API key is correct
3. Verify deviceId exists in web UI
4. Ensure PC Remote Wake is running on http://localhost:3000

### Metrics not updating
1. Check polling interval in config
2. Verify PC is online and accessible
3. Check Homebridge logs for errors
4. Verify API key has not been revoked

### Wake/Sleep/Shutdown not working
1. Verify SSH credentials are configured in web UI
2. Check device IP address is correct
3. Ensure OpenSSH server is running on Windows PC
4. Test commands in web UI first

## Architecture

```
Apple Home App
      ↓
  Homebridge (Raspberry Pi)
      ↓
homebridge-pc-remote-wake plugin
      ↓
PC Remote Wake API (http://localhost:3000)
      ↓
Windows PC (via WOL/SSH)
```

## API Endpoints Used

- `GET /api/devices` - Fetch device info
- `GET /api/metrics/:deviceId/latest` - Fetch current metrics
- `POST /api/status` - Check device online status
- `POST /api/wake` - Send Wake-on-LAN packet
- `POST /api/sleep` - Send sleep command via SSH
- `POST /api/shutdown` - Send shutdown command via SSH

All endpoints use Bearer token authentication with your API key.

## License

MIT

## Support

For issues and feature requests, please visit:
https://github.com/vietairs/rpi-remote-wol/issues
