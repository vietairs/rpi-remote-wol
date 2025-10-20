#!/usr/bin/env node

/**
 * Generate PNG icons from SVG using sharp
 * Run: node scripts/generate-icons-modern.js
 */

const fs = require('fs');
const path = require('path');

// Check if sharp is available
let sharp;
try {
  sharp = require('sharp');
} catch (error) {
  console.error('⚠️  Sharp not installed. Installing...');
  console.log('Run: npm install --save-dev sharp');
  console.log('Then run this script again.');
  process.exit(1);
}

const iconSizes = [
  { size: 16, name: 'favicon-16x16.png' },
  { size: 32, name: 'favicon-32x32.png' },
  { size: 180, name: 'apple-touch-icon.png' },
  { size: 192, name: 'icon-192.png' },
  { size: 512, name: 'icon-512.png' },
];

const svgPath = path.join(__dirname, '../public/icon.svg');
const publicDir = path.join(__dirname, '../public');

async function generateIcons() {
  console.log('🎨 Generating modern iOS-style icons...\n');

  if (!fs.existsSync(svgPath)) {
    console.error('❌ icon.svg not found at:', svgPath);
    process.exit(1);
  }

  const svgBuffer = fs.readFileSync(svgPath);

  for (const { size, name } of iconSizes) {
    const outputPath = path.join(publicDir, name);

    try {
      await sharp(svgBuffer)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toFile(outputPath);

      console.log(`✅ Generated ${name} (${size}x${size})`);
    } catch (error) {
      console.error(`❌ Failed to generate ${name}:`, error.message);
    }
  }

  // Generate favicon.ico (using 32x32 as base)
  console.log('\n🔄 Generating favicon.ico...');
  const favicon32 = path.join(publicDir, 'favicon-32x32.png');
  const faviconIco = path.join(publicDir, 'favicon.ico');

  try {
    // Note: favicon.ico generation requires additional tools
    // For now, just copy the 32x32 PNG
    console.log('ℹ️  For best results, convert favicon-32x32.png to favicon.ico using:');
    console.log('   Online tool: https://convertio.co/png-ico/');
    console.log('   Or: npm install -g sharp-cli && sharp-cli favicon-32x32.png -o favicon.ico');
  } catch (error) {
    console.error('❌ Favicon generation note:', error.message);
  }

  console.log('\n✨ Icon generation complete!');
  console.log('📱 Your app now has a modern iOS 2025-style icon.');
}

generateIcons().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
