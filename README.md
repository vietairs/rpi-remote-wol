# PC Remote Wake - Wake-on-LAN Controller

A Next.js web application for remotely managing your Windows 11 PC using Wake-on-LAN (WOL). Designed to run on a Raspberry Pi, it provides comprehensive device management, real-time monitoring, and Apple HomeKit integration.

## Features

### Core Functionality
- ⚡ **Wake-on-LAN** - Send magic packets to wake your PC from sleep or powered-off state
- 🔄 **Remote Control** - Shutdown and sleep commands via SSH
- 💾 **Device Management** - Save and manage multiple devices with SQLite database
- 📊 **Real-time Monitoring** - Device status (Online/Offline/RDP Ready)
- 🔍 **Auto IP Discovery** - Automatic IP address discovery from MAC address (ARP lookup)

### Advanced Features
- 📈 **System Metrics** - Collect CPU, RAM, GPU usage, and power consumption
- ⚡ **Energy Monitoring** - Track power consumption with hourly/daily/monthly views
- ⏰ **Background Scheduler** - Automatic 24/7 metrics collection (configurable intervals)
- 🔔 **Smart Notifications** - Power threshold alerts and device offline notifications
- 🔑 **API Keys** - Programmatic access for integrations (Homebridge, automation)
- 🏠 **Homebridge Plugin** - Full Apple HomeKit integration (control via Siri and Home app)
- 📱 **Progressive Web App** - Install as native mobile app on iOS/Android
- 🔐 **Dual Authentication** - JWT cookies (web UI) + API keys (programmatic access)

### User Experience
- 🎨 Modern, responsive UI with real-time updates
- 📲 Mobile-friendly design with offline support
- 🌐 Accessible from any device on your network
- ⚙️ Customizable preferences (polling intervals, notification settings)

## Prerequisites

### Windows 11 PC Setup

1. **Enable Wake-on-LAN in BIOS/UEFI:**
   - Restart your PC and enter BIOS (usually Del, F2, or F12)
   - Look for "Wake on LAN" or "Power On By PCI-E" settings
   - Enable the option and save

2. **Enable WOL in Windows:**
   - Open Device Manager
   - Expand "Network adapters"
   - Right-click your network adapter → Properties
   - Go to "Power Management" tab
   - Check "Allow this device to wake the computer"
   - Check "Only allow a magic packet to wake the computer"
   - Go to "Advanced" tab
   - Enable "Wake on Magic Packet"
   - Click OK

3. **Find Your PC's MAC Address:**
   ```bash
   ipconfig /all
   ```
   Look for "Physical Address" under your network adapter

4. **Disable Fast Startup (Recommended):**
   - Control Panel → Power Options → Choose what the power buttons do
   - Click "Change settings that are currently unavailable"
   - Uncheck "Turn on fast startup"

5. **Enable OpenSSH Server (for remote shutdown/sleep/metrics):**
   ```powershell
   # Run as Administrator
   Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
   Start-Service sshd
   Set-Service -Name sshd -StartupType 'Automatic'
   ```

6. **Allow SSH through Firewall:**
   ```powershell
   # Run as Administrator
   New-NetFirewallRule -Name sshd -DisplayName 'OpenSSH Server (sshd)' -Enabled True -Direction Inbound -Protocol TCP -Action Allow -LocalPort 22
   ```

### Raspberry Pi Setup

1. **Install Node.js** (if not already installed):
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

2. **Ensure your Raspberry Pi is on the same network** as your PC

## Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/rpi-remote-wol.git
   cd rpi-remote-wol
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   nano .env
   ```

   Generate a secure JWT secret:
   ```bash
   openssl rand -base64 32
   ```

   Edit your `.env` file:
   ```env
   # Required: JWT Secret for authentication
   JWT_SECRET=your-generated-secret-here

   # Optional: Metrics retention (default: 365 days)
   METRICS_RETENTION_DAYS=365

   # Optional: Background metrics collection
   ENABLE_BACKGROUND_METRICS=true
   BACKGROUND_METRICS_INTERVAL=300000  # 5 minutes in milliseconds
   BACKGROUND_METRICS_CONCURRENT=3     # Max concurrent device collections
   ```

4. **Build the production version:**
   ```bash
   npm run build
   ```

## Running the Application

### Development Mode
```bash
npm run dev
```
Access at: `http://localhost:3000`

### Production Mode
```bash
npm run build
npm start
```

### Run on Different Port
```bash
PORT=8080 npm start
```

### Access from Other Devices
Find your Raspberry Pi's IP address:
```bash
hostname -I
```
Then access from any device on your network: `http://<raspberry-pi-ip>:3000`

## Usage

### First Time Setup - Creating Admin Account

1. Open the web interface in your browser
2. You'll be redirected to the setup page automatically
3. Create your admin account:
   - Enter a username
   - Enter a password (minimum 6 characters)
   - Confirm your password
4. Click "Create Admin Account"
5. You'll be redirected to the login page

### Logging In

1. Enter your username and password
2. Click "Sign In"
3. You'll be taken to the main dashboard

### Installing as Mobile App (PWA)

**iPhone/iPad:**
1. Open Safari and navigate to your app URL
2. Tap the Share button (square with arrow)
3. Scroll down and tap "Add to Home Screen"
4. Tap "Add" - the app will appear on your home screen

**Android:**
1. Open Chrome and navigate to your app URL
2. Tap the menu (⋮) → "Add to Home screen" or "Install app"
3. The app icon will appear on your home screen

Once installed, the app runs in standalone mode (no browser UI) and works offline. See [PWA_SETUP.md](PWA_SETUP.md) for detailed instructions.

### Adding Devices

1. Enter your PC's MAC address (format: XX:XX:XX:XX:XX:XX)
2. (Optional) Click "🔍 Find IP" to auto-discover the IP address
3. Click "💾 Save This Device" button
4. Enter a friendly name for your device (e.g., "Gaming PC", "Work Desktop")
5. Enter or auto-discover the IP address for status monitoring
6. **(Optional)** Add SSH credentials for remote shutdown/sleep and metrics collection:
   - SSH Username (usually your Windows username)
   - SSH Password
7. Click Save

### Basic Device Control

**Waking Your PC:**
1. Select a saved device from the right panel (or enter MAC address manually)
2. Click "⚡ Wake PC" button
3. Watch the status change from "Waking" to "Online" to "RDP Ready"
4. Your PC should wake up within a few seconds

**Remote Shutdown/Sleep:**
1. Click the device menu (⋯) on any saved device
2. Select "Shutdown" or "Sleep"
3. The command will be sent via SSH
   - *Note: Requires SSH credentials configured for the device*

### Device Status Indicators

- **RDP Ready** (Green) - Device is online and Remote Desktop is accessible
- **Online** (Green) - Device is reachable but RDP is not confirmed
- **Offline** (Red) - Device is not responding
- **Waking** (Yellow, animated) - Wake packet sent, waiting for device to come online
- **Checking** (Blue) - Currently checking device status
- **No IP** (Gray) - No IP address configured for this device

## Advanced Features

### System Metrics Collection

Monitor your PC's performance metrics in real-time:
- **CPU Usage** - Percentage utilization
- **RAM Usage** - Used/Total GB and percentage
- **GPU Usage** - NVIDIA GPU utilization and memory (requires nvidia-smi)
- **Power Consumption** - Real-time power draw in watts

**How to Enable:**
1. Add SSH credentials to your device (required for metrics collection)
2. Click on a device to view its metrics panel
3. Click "Collect Metrics" to fetch current data
4. Metrics are displayed in charts with historical data

**Automatic Collection:**
- Configure polling interval in Settings (⚙️ icon)
- Default: 5 minutes when device is online
- Metrics are stored in SQLite database for historical analysis

### Energy Monitoring

Track power consumption over time:
- View power usage charts (hourly, daily, weekly, monthly)
- Total energy consumption in kWh
- Average power draw statistics
- Min/max power readings

**Access:** Click on any device → Metrics panel → Energy tab

### Background Scheduler (24/7 Monitoring)

Automatically collect metrics from all devices around the clock:

**Features:**
- Runs independently in the background
- Only collects from online devices (checks status first)
- Configurable collection interval (1-60 minutes)
- Batch processing with concurrency control
- Automatic retry on failures

**Configuration:**
```env
ENABLE_BACKGROUND_METRICS=true           # Enable/disable
BACKGROUND_METRICS_INTERVAL=300000       # 5 minutes (in milliseconds)
BACKGROUND_METRICS_CONCURRENT=3          # Max concurrent collections
```

**API Control:**
- View scheduler status in Settings
- Start/Stop scheduler manually
- Trigger immediate collection

### Notifications

Stay informed about your devices:

**Notification Types:**
- ⚠️ **Power Threshold Alerts** - Warns when power consumption exceeds your set threshold
- ❌ **Collection Failures** - Notifies when metrics collection fails
- 📡 **Device Offline** - Alerts when a device goes offline

**Setup:**
1. Click Settings (⚙️) in the header
2. Enable "Power Consumption Alerts"
3. Set your power threshold in watts (e.g., 300W)
4. Save preferences

**Features:**
- Notification bell icon shows unread count
- Anti-spam logic (1-hour cooldown for power alerts)
- Mark as read or delete notifications
- Bulk actions (mark all read, cleanup)

### API Keys (Programmatic Access)

Generate API keys for external integrations:

**Creating an API Key:**
1. Navigate to Settings (⚙️)
2. Scroll to "API Keys" section
3. Enter a name (e.g., "Homebridge", "Home Assistant")
4. Click "Generate API Key"
5. **Copy the key immediately** - it's only shown once!
   - Format: `pcw_xxxxxxxxxxxxx`

**Using API Keys:**
```bash
# Wake a device
curl -X POST http://localhost:3000/api/wake \
  -H "Authorization: Bearer pcw_xxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"macAddress": "AA:BB:CC:DD:EE:FF"}'

# Check device status
curl -X POST http://localhost:3000/api/status \
  -H "Authorization: Bearer pcw_xxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"ipAddress": "192.168.1.100"}'

# Collect metrics
curl -X POST http://localhost:3000/api/metrics/collect \
  -H "Authorization: Bearer pcw_xxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"deviceId": 1}'
```

**Use Cases:**
- Homebridge/HomeBridge plugins
- Home Assistant integrations
- Custom automation scripts
- Third-party monitoring tools

### Homebridge Plugin (Apple HomeKit)

Control your PC via Apple Home app and Siri:

**Features (v2.1.0+):**
- ✅ Wake, Sleep, Shutdown switches (all in one device)
- ✅ Device Status (Contact Sensor - online/offline)
- ✅ CPU Usage (Temperature Sensor)
- ✅ RAM Usage (Humidity Sensor)
- ✅ GPU Usage (Temperature Sensor)
- ✅ Power Consumption (Light Sensor in Lux)

**Installation:**
```bash
cd homebridge-plugin
chmod +x install.sh
./install.sh
```

**Configuration:**
Add to your Homebridge `config.json`:
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

**Siri Commands:**
- "Hey Siri, turn on Wake"
- "Hey Siri, turn on Sleep"
- "Hey Siri, what's the CPU temperature?"
- "Hey Siri, what's the humidity in Gaming PC?" (RAM usage)

**Documentation:**
- Quick Start: [homebridge-plugin/QUICKSTART.md](homebridge-plugin/QUICKSTART.md)
- Full Guide: [homebridge-plugin/README.md](homebridge-plugin/README.md)
- Migration: [homebridge-plugin/MIGRATION.md](homebridge-plugin/MIGRATION.md)

## Managing Devices

- **Add new device**: Enter MAC address and click "💾 Save This Device"
- **Auto-discover IP**: Click "🔍 Find IP" to automatically find the device's IP address
- **Select device**: Click on any saved device to load its MAC address
- **Delete device**: Click the trash icon on any saved device
- **Edit device**: Click the edit icon to update SSH credentials or device info
- **Manual entry**: You can still enter MAC addresses manually without saving
- **Logout**: Click the "Logout" button in the top right corner

## Running as a System Service (Optional)

To keep the application running on boot:

1. **Create a systemd service:**
   ```bash
   sudo nano /etc/systemd/system/pc-wake.service
   ```

2. **Add the following content:**
   ```ini
   [Unit]
   Description=PC Wake-on-LAN Web Interface
   After=network.target

   [Service]
   Type=simple
   User=pi
   WorkingDirectory=/home/pi/rpi-remote-wol
   ExecStart=/usr/bin/npm start
   Restart=on-failure
   Environment=NODE_ENV=production
   Environment=PORT=3000

   [Install]
   WantedBy=multi-user.target
   ```

3. **Enable and start the service:**
   ```bash
   sudo systemctl enable pc-wake.service
   sudo systemctl start pc-wake.service
   ```

4. **Check status:**
   ```bash
   sudo systemctl status pc-wake.service
   ```

## Troubleshooting

### PC doesn't wake up

- **Check BIOS/UEFI settings:** Ensure WOL is enabled
- **Disable Fast Startup:** Windows Fast Startup can prevent WOL
- **Use Ethernet:** WOL works more reliably over wired connections
- **Check Windows settings:** Verify network adapter power management
- **Firewall:** Ensure UDP port 9 (WOL) is not blocked on your network
- **Test from same network:** Ensure Raspberry Pi and PC are on same subnet

### Cannot access web interface

- **Check if service is running:** `npm run dev` or check systemd status
- **Check firewall on Raspberry Pi:** `sudo ufw allow 3000`
- **Verify IP address:** Use correct Raspberry Pi IP
- **Check port:** Ensure the port (default 3000) is correct

### Invalid MAC address error

- MAC address must be in format: `XX:XX:XX:XX:XX:XX` or `XX-XX-XX-XX-XX-XX`
- Use uppercase or lowercase letters (both work)
- Verify MAC address using `ipconfig /all` on Windows

### SSH commands not working

- **Verify SSH server is running on Windows:** `Get-Service sshd` in PowerShell
- **Check SSH credentials:** Ensure username/password are correct
- **Firewall:** Ensure port 22 is open on Windows
- **Test SSH manually:** `ssh username@pc-ip-address` from Raspberry Pi

### Metrics collection fails

- **SSH must be working:** Test SSH connection first
- **PowerShell execution policy:** May need to allow remote scripts
- **NVIDIA GPU metrics:** Requires nvidia-smi (gracefully fails if unavailable)
- **Timeout errors:** Increase timeout if PC is slow to respond

### Background scheduler not running

- **Check environment variables:** Ensure `ENABLE_BACKGROUND_METRICS=true`
- **Check logs:** Look for scheduler startup messages in console
- **Restart application:** Stop and start the service
- **View status:** Check Settings page for scheduler status

## Testing

Run the comprehensive E2E test suite:

```bash
# Run all tests
npm test

# Run tests with UI
npm run test:ui

# Run tests in headed browser (watch execution)
npm run test:headed

# Debug mode
npm run test:debug

# View test report
npm run test:report
```

**Test Coverage:**
- ✅ Authentication (setup, login, logout)
- ✅ API key lifecycle
- ✅ Device CRUD operations
- ✅ Wake-on-LAN functionality
- ✅ Status monitoring
- ✅ Dual authentication (JWT + API keys)

## Technical Details

### Stack
- **Framework:** Next.js 15 with App Router (React 19)
- **Styling:** Tailwind CSS v4
- **Authentication:** JWT (jose) + bcryptjs for password hashing
- **Database:** SQLite (better-sqlite3) with WAL mode
- **Wake-on-LAN:** wake_on_lan npm package
- **SSH:** node-ssh for remote commands
- **Status Monitoring:** tcp-ping for port checking
- **Metrics:** PowerShell scripts via SSH
- **Runtime:** Node.js 20+

### Database Schema

**Tables:**
- `users` - User accounts (username, password_hash)
- `devices` - Device info (MAC, IP, SSH credentials)
- `api_keys` - API keys (bcrypt hashed, with last_used tracking)
- `system_metrics` - Performance metrics (CPU, RAM, GPU, power)
- `user_preferences` - User settings (polling interval, notifications)
- `collection_history` - Metrics collection logs (success/failure tracking)
- `notifications` - Notification queue (power alerts, failures)

**Database Location:** `data/devices.db` (auto-created on first run)

### Security Features

- **Dual Authentication:** JWT cookies (web UI) + API keys (programmatic)
- **Password Hashing:** bcrypt (10 rounds)
- **Session Management:** 7-day JWT expiration
- **Protected Routes:** Middleware enforces authentication
- **HTTP-only Cookies:** Prevents XSS attacks
- **First-time Setup:** Ensures admin account creation
- **API Key Tracking:** last_used_at timestamps for auditing

### API Endpoints

**Authentication:**
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/session` - Check session
- `GET /api/auth/init` - First-time setup check

**Devices:**
- `GET /api/devices` - List all devices
- `POST /api/devices` - Create device
- `PUT /api/devices/[id]` - Update device
- `DELETE /api/devices/[id]` - Delete device

**Device Control:**
- `POST /api/wake` - Send WOL magic packet
- `POST /api/status` - Check device status
- `POST /api/shutdown` - Remote shutdown
- `POST /api/sleep` - Remote sleep
- `POST /api/discover-ip` - ARP IP discovery

**Metrics:**
- `POST /api/metrics/collect` - Collect metrics
- `GET /api/metrics/[deviceId]` - Get metrics history
- `GET /api/metrics/[deviceId]/latest` - Get latest metrics
- `GET /api/metrics/[deviceId]/energy` - Energy stats
- `POST /api/metrics/cleanup` - Delete old metrics

**API Keys:**
- `GET /api/keys` - List API keys
- `POST /api/keys` - Generate new key
- `DELETE /api/keys/[id]` - Revoke key

**Preferences & Notifications:**
- `GET /api/preferences` - Get user preferences
- `PATCH /api/preferences` - Update preferences
- `GET /api/notifications` - List notifications
- `PATCH /api/notifications/[id]` - Mark as read
- `DELETE /api/notifications/[id]` - Delete notification

**Scheduler:**
- `GET /api/scheduler` - Get scheduler status
- `POST /api/scheduler` - Control scheduler (start/stop/run-now)
- `PATCH /api/scheduler` - Update configuration

## Network Requirements

- Both devices must be on the same local network (LAN)
- Router must allow broadcast packets for WOL
- Some networks may block WOL packets (check router settings)
- SSH requires port 22 open on Windows PC

## Security Notes

- This application includes built-in authentication for secure access
- Designed for local network use only
- **Do not expose directly to the internet** without additional security measures:
  - Use a VPN for remote access
  - Set up a reverse proxy with HTTPS (nginx, Caddy)
  - Configure firewall rules appropriately
- Change the default JWT_SECRET to a secure random string
- Use strong passwords for your admin account
- SSH credentials are stored in plaintext (local network assumption)
- API keys are bcrypt-hashed before storage
- Consider using certificate-based SSH authentication for better security

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Acknowledgments

- Built with Next.js 15 and React 19
- Uses the wake_on_lan library for WOL functionality
- Inspired by the need for simple, reliable remote PC management

---

**Made with ❤️ for home lab enthusiasts and remote PC management**
