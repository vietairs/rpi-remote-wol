# PC Remote Wake - Wake-on-LAN Controller

A Next.js web application for remotely waking your Windows 11 PC from sleep or powered-off state using Wake-on-LAN (WOL). Designed to run on a Raspberry Pi.

## Features

- ⚡ Send Wake-on-LAN magic packets to your PC
- 💾 Save and manage multiple devices with SQLite database
- 🔄 Persistent storage - devices are saved between sessions
- 🎯 Quick device selection from saved list
- 📊 Real-time device status monitoring (Online/Offline/RDP Ready)
- 🔍 Auto IP discovery from MAC address (ARP lookup)
- 🔐 Secure authentication system with login page
- 🎨 Modern, responsive UI with real-time status updates
- 🔒 MAC address validation
- 📱 Mobile-friendly design
- 🌐 Accessible from any device on your network

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

### Raspberry Pi Setup

1. **Install Node.js** (if not already installed):
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

2. **Ensure your Raspberry Pi is on the same network** as your PC

## Installation

1. **Clone or copy this project to your Raspberry Pi**

2. **Install dependencies:**
   ```bash
   cd rpi-remote-wol
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
   Add it to your `.env` file:
   ```
   JWT_SECRET=your-generated-secret-here
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

### Adding Devices

1. Enter your PC's MAC address (format: XX:XX:XX:XX:XX:XX)
2. (Optional) Click "🔍 Find IP" to auto-discover the IP address
3. Click "💾 Save This Device" button
4. Enter a friendly name for your device (e.g., "Gaming PC", "Work Desktop")
5. (Optional) Enter or auto-discover the IP address for status monitoring
6. Click Save

### Waking Your PC

1. Select a saved device from the right panel (or enter MAC address manually)
2. Click "⚡ Wake PC" button
3. Watch the status change from "Waking" to "Online" to "RDP Ready"
4. Your PC should wake up within a few seconds

### Device Status Indicators

- **RDP Ready** (Green) - Device is online and Remote Desktop is accessible
- **Online** (Green) - Device is reachable but RDP is not confirmed
- **Offline** (Red) - Device is not responding
- **Waking** (Yellow, animated) - Wake packet sent, waiting for device to come online
- **Checking** (Blue) - Currently checking device status
- **No IP** (Gray) - No IP address configured for this device

### Managing Devices

- **Add new device**: Enter MAC address and click "💾 Save This Device"
- **Auto-discover IP**: Click "🔍 Find IP" to automatically find the device's IP address
- **Select device**: Click on any saved device to load its MAC address
- **Delete device**: Click the trash icon on any saved device
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

## Technical Details

- **Framework:** Next.js 15 with App Router
- **Styling:** Tailwind CSS
- **Authentication:** JWT-based sessions with bcryptjs password hashing
- **Wake-on-LAN:** wake_on_lan npm package
- **Status Monitoring:** TCP port checking (ports 445, 3389)
- **IP Discovery:** ARP table lookup via system commands
- **Database:** SQLite (better-sqlite3) for persistent storage
- **Runtime:** Node.js

### Database Location

The SQLite database is stored at `data/devices.db` in the project directory. This file is automatically created on first run and persists:
- User accounts (hashed passwords)
- Saved devices with MAC addresses and IP addresses

### Security Features

- JWT-based session management with HTTP-only cookies
- Bcrypt password hashing (10 rounds)
- Session expiration (7 days)
- Protected routes via middleware
- Secure cookie settings in production
- First-time setup workflow for admin account creation

## Network Requirements

- Both devices must be on the same local network (LAN)
- Router must allow broadcast packets for WOL
- Some networks may block WOL packets (check router settings)

## Security Notes

- This application includes built-in authentication for secure access
- Designed for local network use only
- **Do not expose directly to the internet** without additional security measures:
  - Use a VPN for remote access
  - Set up a reverse proxy with HTTPS (nginx, Caddy)
  - Configure firewall rules appropriately
- Change the default JWT_SECRET to a secure random string
- Use strong passwords for your admin account
- The database contains hashed passwords and is stored locally

## License

MIT
