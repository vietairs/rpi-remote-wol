#!/bin/bash
# Generate PWA icons from SVG
# Requires ImageMagick: brew install imagemagick (macOS) or apt-get install imagemagick (Linux)

cd "$(dirname "$0")/.."

echo "Generating PWA icons from SVG..."

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo "Error: ImageMagick is not installed."
    echo "Install it with: brew install imagemagick (macOS) or apt-get install imagemagick (Linux/Raspberry Pi)"
    exit 1
fi

# Generate icons
convert public/icon.svg -resize 192x192 public/icon-192.png
convert public/icon.svg -resize 512x512 public/icon-512.png
convert public/icon.svg -resize 180x180 public/apple-touch-icon.png
convert public/icon.svg -resize 32x32 public/favicon-32x32.png
convert public/icon.svg -resize 16x16 public/favicon-16x16.png

# Generate favicon.ico (contains 16x16 and 32x32)
convert public/icon.svg -resize 16x16 -background transparent -flatten public/favicon-16.png
convert public/icon.svg -resize 32x32 -background transparent -flatten public/favicon-32.png
convert public/favicon-16.png public/favicon-32.png public/favicon.ico

# Clean up temporary files
rm public/favicon-16.png public/favicon-32.png

echo "✅ Icons generated successfully!"
echo "   - icon-192.png"
echo "   - icon-512.png"
echo "   - apple-touch-icon.png"
echo "   - favicon-32x32.png"
echo "   - favicon-16x16.png"
echo "   - favicon.ico"
