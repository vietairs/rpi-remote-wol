#!/bin/bash

# Quick transfer script for copying Homebridge plugin to Raspberry Pi

set -e

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║   Transfer Homebridge Plugin to Raspberry Pi             ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -f "index.js" ]; then
    echo "❌ Error: This script must be run from the homebridge-plugin directory"
    echo ""
    echo "Please run:"
    echo "  cd ~/Projects/rpi-remote-wol/homebridge-plugin"
    echo "  ./transfer-to-pi.sh"
    exit 1
fi

# Get Raspberry Pi details
echo "Enter your Raspberry Pi details:"
echo ""
read -p "Raspberry Pi IP address (e.g., 192.168.1.100): " PI_IP
read -p "Raspberry Pi username [pi]: " PI_USER
PI_USER=${PI_USER:-pi}

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║   Step 1: Test SSH Connection                            ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Test SSH connection
if ! ssh -o ConnectTimeout=5 -o BatchMode=yes -o StrictHostKeyChecking=no "$PI_USER@$PI_IP" "echo 'SSH connection successful'" 2>/dev/null; then
    echo "⚠️  Cannot connect via SSH key, you'll need to enter password"
    echo ""
fi

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║   Step 2: Copy Plugin Files                              ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Copy plugin directory to Pi
echo "📦 Copying plugin files to Raspberry Pi..."
scp -r "$(pwd)" "$PI_USER@$PI_IP:~/homebridge-plugin-temp"

if [ $? -ne 0 ]; then
    echo "❌ Failed to copy files"
    exit 1
fi

# Clean up and move to final location
ssh "$PI_USER@$PI_IP" "rm -rf ~/homebridge-plugin && mv ~/homebridge-plugin-temp ~/homebridge-plugin"

echo "✅ Files copied successfully!"
echo ""

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║   Step 3: Install Plugin                                 ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

read -p "Do you want to install the plugin now? (y/n): " INSTALL
echo ""

if [ "$INSTALL" = "y" ] || [ "$INSTALL" = "Y" ]; then
    echo "📦 Installing plugin on Raspberry Pi..."
    echo ""

    # Run installation script on Pi
    ssh -t "$PI_USER@$PI_IP" "cd ~/homebridge-plugin && chmod +x install.sh && ./install.sh"

    echo ""
    echo "✅ Installation complete!"
else
    echo "⚠️  Skipping installation"
    echo ""
    echo "To install later, SSH into your Pi and run:"
    echo "  ssh $PI_USER@$PI_IP"
    echo "  cd ~/homebridge-plugin"
    echo "  chmod +x install.sh"
    echo "  ./install.sh"
fi

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║   Next Steps                                              ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "1. Generate API Key from PC Remote Wake web UI"
echo "   http://$PI_IP:3000"
echo ""
echo "2. Configure Homebridge (if not done during install):"
echo "   http://$PI_IP:8581"
echo ""
echo "3. Restart Homebridge:"
echo "   ssh $PI_USER@$PI_IP"
echo "   sudo systemctl restart homebridge"
echo ""
echo "4. Open Home app on your iPhone/iPad"
echo "   Your PC accessories should appear automatically"
echo ""
echo "📱 Enjoy controlling your PC via HomeKit!"
