# Transfer Plugin to Raspberry Pi

This guide will help you copy the Homebridge plugin to your Raspberry Pi and install it.

## Prerequisites

- SSH access to your Raspberry Pi
- PC Remote Wake already running on Raspberry Pi
- Homebridge installed on Raspberry Pi

## Method 1: Using SCP (Recommended)

### Step 1: Find Your Raspberry Pi IP Address

If you don't know your Pi's IP address, you can find it by:
- Checking your router's DHCP client list
- Using the web UI of PC Remote Wake (you're already connected to it)
- Or if you have monitor/keyboard on Pi: `hostname -I`

### Step 2: Copy Plugin Files

From your Mac, run:

```bash
# Navigate to project directory
cd ~/Projects/rpi-remote-wol

# Copy the entire homebridge-plugin directory to Pi
# Replace 'pi' with your Pi username if different
# Replace 192.168.1.100 with your Pi's IP address
scp -r homebridge-plugin/ pi@192.168.1.100:~/

# Example:
# scp -r homebridge-plugin/ pi@192.168.1.50:~/
```

You'll be prompted for your Pi password.

### Step 3: SSH into Raspberry Pi

```bash
ssh pi@192.168.1.100
```

### Step 4: Install Plugin

```bash
cd ~/homebridge-plugin
chmod +x install.sh
./install.sh
```

Follow the installation wizard to configure your API key and device ID.

## Method 2: Using Git (Alternative)

If your project is already on Git:

### On Raspberry Pi:

```bash
# Clone or pull latest changes
cd ~
git clone https://github.com/vietairs/rpi-remote-wol.git
# Or if already cloned:
# cd rpi-remote-wol && git pull

# Navigate to plugin directory
cd rpi-remote-wol/homebridge-plugin

# Install
chmod +x install.sh
./install.sh
```

## Method 3: Manual File Transfer (If SCP Not Available)

### Step 1: Create Plugin Directory on Pi

SSH into Pi and run:
```bash
mkdir -p ~/homebridge-plugin
```

### Step 2: Copy Files One by One

From your Mac, you can use any of these methods:

**Option A: SFTP Client**
- Use Cyberduck, FileZilla, or similar
- Connect to your Pi via SFTP
- Upload the `homebridge-plugin` folder

**Option B: Create Files Manually**
- SSH into Pi
- Create each file with `nano filename`
- Copy/paste contents

## Verification

After installation, verify it's working:

```bash
# Check if plugin is linked
npm list -g | grep homebridge-pc-remote-wake

# Should output:
# homebridge-pc-remote-wake@1.0.0
```

## Next Steps

1. **Generate API Key** (if you haven't already):
   - Open PC Remote Wake: http://your-pi-ip:3000
   - Login → Generate API Key
   - Copy the key

2. **Configure Homebridge**:
   - Use Homebridge UI: http://your-pi-ip:8581
   - Or edit `~/.homebridge/config.json`

3. **Restart Homebridge**:
   ```bash
   sudo systemctl restart homebridge
   ```

4. **Open Home App**:
   - Your PC accessories should appear automatically

## Troubleshooting

### SCP Permission Denied
```bash
# Make sure you can SSH first
ssh pi@192.168.1.100

# Check your Pi username (might not be 'pi')
whoami
```

### Homebridge Not Found
```bash
# Install Homebridge first
sudo npm install -g --unsafe-perm homebridge homebridge-config-ui-x
```

### Plugin Not Showing Up
```bash
# Check Homebridge logs
tail -f ~/.homebridge/homebridge.log

# Or use journalctl
sudo journalctl -u homebridge -f
```

## Quick Copy-Paste Command

Replace the IP address with your Raspberry Pi's IP:

```bash
cd ~/Projects/rpi-remote-wol && scp -r homebridge-plugin/ pi@192.168.1.100:~/ && ssh pi@192.168.1.100 "cd ~/homebridge-plugin && chmod +x install.sh && ./install.sh"
```

This single command will:
1. Copy the plugin to your Pi
2. SSH into your Pi
3. Run the installation script

You'll be prompted for:
- Pi password (for SCP)
- Pi password (for SSH)
- API key
- Device ID
