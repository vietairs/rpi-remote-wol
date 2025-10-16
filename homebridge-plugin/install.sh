#!/bin/bash

# PC Remote Wake Homebridge Plugin Installation Script
# This script installs the plugin and guides you through configuration

set -e

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║   PC Remote Wake - Homebridge Plugin Installation        ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Check if running on Raspberry Pi / Linux
if [[ ! -f /etc/os-release ]]; then
    echo "⚠️  Warning: This script is designed for Linux/Raspberry Pi"
    echo "   Installation may need manual steps on other systems"
    echo ""
fi

# Check if Homebridge is installed
if ! command -v homebridge &> /dev/null; then
    echo "❌ Error: Homebridge is not installed"
    echo ""
    echo "Please install Homebridge first:"
    echo "  sudo npm install -g --unsafe-perm homebridge homebridge-config-ui-x"
    echo ""
    echo "Or visit: https://github.com/homebridge/homebridge/wiki/Install-Homebridge-on-Raspbian"
    exit 1
fi

echo "✅ Homebridge is installed"
echo ""

# Install plugin dependencies
echo "📦 Installing plugin dependencies..."
cd "$(dirname "$0")"
npm install
echo ""

# Link plugin globally
echo "🔗 Linking plugin to Homebridge..."
sudo npm link
echo ""

echo "✅ Plugin installed successfully!"
echo ""

# Guide user through configuration
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║   Configuration Setup                                     ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

echo "Step 1: Generate API Key"
echo "  1. Open PC Remote Wake web UI: http://localhost:3000"
echo "  2. Login with your credentials"
echo "  3. Generate a new API key"
echo "  4. Copy the API key (starts with pcw_)"
echo ""
read -p "Press Enter when you have your API key..."
echo ""

read -p "Enter your API key: " API_KEY
echo ""

echo "Step 2: Get Device ID"
echo "  1. In the web UI, check your saved devices list"
echo "  2. The device ID is the numeric identifier (1, 2, 3, etc.)"
echo ""
read -p "Enter your device ID: " DEVICE_ID
echo ""

read -p "Enter your device name (e.g., Gaming PC): " DEVICE_NAME
DEVICE_NAME=${DEVICE_NAME:-PC}
echo ""

# Generate config snippet
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║   Configuration                                           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "Add this to your Homebridge config.json (in the platforms array):"
echo ""
echo "{"
echo "  \"platform\": \"PCRemoteWake\","
echo "  \"name\": \"PC Remote Wake\","
echo "  \"baseUrl\": \"http://localhost:3000\","
echo "  \"apiKey\": \"$API_KEY\","
echo "  \"deviceId\": $DEVICE_ID,"
echo "  \"deviceName\": \"$DEVICE_NAME\","
echo "  \"pollingInterval\": 30"
echo "}"
echo ""

# Save config to file for reference
CONFIG_FILE="homebridge-config-snippet.json"
cat > "$CONFIG_FILE" <<EOF
{
  "platform": "PCRemoteWake",
  "name": "PC Remote Wake",
  "baseUrl": "http://localhost:3000",
  "apiKey": "$API_KEY",
  "deviceId": $DEVICE_ID,
  "deviceName": "$DEVICE_NAME",
  "pollingInterval": 30
}
EOF

echo "✅ Configuration saved to: $CONFIG_FILE"
echo ""

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║   Next Steps                                              ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "1. Add the configuration above to your Homebridge config.json"
echo "   Config location: ~/.homebridge/config.json"
echo "   Or use Homebridge UI: http://localhost:8581"
echo ""
echo "2. Restart Homebridge:"
echo "   sudo systemctl restart homebridge"
echo "   Or: sudo hb-service restart"
echo ""
echo "3. Open Home app on your iPhone/iPad"
echo "   Your PC accessories should appear automatically"
echo ""
echo "For manual config editing:"
echo "  nano ~/.homebridge/config.json"
echo ""
echo "For Homebridge logs:"
echo "  tail -f ~/.homebridge/homebridge.log"
echo ""
echo "📱 Enjoy controlling your PC via HomeKit!"
