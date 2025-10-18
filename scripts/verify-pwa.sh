#!/bin/bash
# Verify PWA setup is complete

cd "$(dirname "$0")/.."

echo "🔍 Verifying PWA setup..."
echo ""

# Track if all checks pass
all_passed=true

# Check manifest.json
if [ -f "public/manifest.json" ]; then
    echo "✅ manifest.json exists"
else
    echo "❌ manifest.json is missing"
    all_passed=false
fi

# Check service worker
if [ -f "public/sw.js" ]; then
    echo "✅ sw.js exists"
else
    echo "❌ sw.js is missing"
    all_passed=false
fi

# Check offline page
if [ -f "public/offline.html" ]; then
    echo "✅ offline.html exists"
else
    echo "❌ offline.html is missing"
    all_passed=false
fi

# Check icons
icons=(
    "icon-192.png"
    "icon-512.png"
    "apple-touch-icon.png"
    "favicon-16x16.png"
    "favicon-32x32.png"
    "favicon.ico"
)

echo ""
echo "📱 Checking icons..."
for icon in "${icons[@]}"; do
    if [ -f "public/$icon" ]; then
        echo "  ✅ $icon"
    else
        echo "  ❌ $icon is missing"
        all_passed=false
    fi
done

# Check PWA component
if [ -f "app/components/PWARegister.tsx" ]; then
    echo ""
    echo "✅ PWARegister component exists"
else
    echo ""
    echo "❌ PWARegister component is missing"
    all_passed=false
fi

# Check if PWARegister is imported in layout
if grep -q "PWARegister" app/layout.tsx; then
    echo "✅ PWARegister imported in layout"
else
    echo "❌ PWARegister not imported in layout"
    all_passed=false
fi

echo ""
if [ "$all_passed" = true ]; then
    echo "🎉 PWA setup is complete!"
    echo ""
    echo "Next steps:"
    echo "1. Build production version: npm run build"
    echo "2. Start server: npm start"
    echo "3. Access from mobile device and add to home screen"
    echo ""
    echo "📖 See PWA_SETUP.md for installation instructions"
    exit 0
else
    echo "⚠️  Some PWA files are missing. Please run:"
    echo "   ./scripts/generate-icons.sh"
    exit 1
fi
