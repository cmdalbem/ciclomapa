#!/usr/bin/env node
/**
 * Generates PWA icons from the CicloMapa logo.
 * Run: node scripts/generate-pwa-icons.js
 *
 * Requires: sharp (npm install sharp --save-dev)
 * Fallback: If sharp is not available, prints instructions.
 */

const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const LOGO_PATH = path.join(PUBLIC_DIR, 'icon.png');

// Brand colors from logo.svg
const BACKGROUND_COLOR = '#1a1a1a';
const ACCENT_COLOR = '#B6F9D1';

async function generateWithSharp() {
  const sharp = require('sharp');

  const logoBuffer = fs.readFileSync(LOGO_PATH);

  const sizes = [
    { name: 'icon-192.png', size: 192 },
    { name: 'icon-512.png', size: 512 },
    { name: 'icon-maskable-192.png', size: 192, maskable: true },
    { name: 'icon-maskable-512.png', size: 512, maskable: true },
  ];

  for (const { name, size, maskable } of sizes) {
    const padding = maskable ? Math.round(size * 0.1) : 0;
    const innerSize = size - padding * 2;

    const resizedLogo = await sharp(logoBuffer)
      .resize(innerSize, innerSize)
      .toBuffer();

    const bgSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="${BACKGROUND_COLOR}"/></svg>`;
    const outputPath = path.join(PUBLIC_DIR, name);
    await sharp(Buffer.from(bgSvg))
      .composite([
        {
          input: resizedLogo,
          top: padding,
          left: padding,
        },
      ])
      .png()
      .toFile(outputPath);
    console.log(`Generated ${name}`);
  }

  // Favicon: resize icon.png to standard favicon sizes
  const faviconSizes = [16, 32, 48];
  const faviconBuffers = [];

  for (const size of faviconSizes) {
    const buf = await sharp(logoBuffer).resize(size, size).png().toBuffer();
    faviconBuffers.push(buf);
  }

  const favicon48Path = path.join(PUBLIC_DIR, 'favicon-48.png');
  fs.writeFileSync(favicon48Path, faviconBuffers[2]);

  const faviconPngPath = path.join(PUBLIC_DIR, 'favicon.png');
  fs.writeFileSync(faviconPngPath, faviconBuffers[2]);
  console.log('Generated favicon.png');

  try {
    const toIco = require('to-ico');
    const icoBuffer = await toIco(faviconBuffers);
    fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.ico'), icoBuffer);
    console.log('Generated favicon.ico (16x16, 32x32, 48x48)');
  } catch {
    fs.copyFileSync(favicon48Path, path.join(PUBLIC_DIR, 'favicon.ico'));
    console.log('Generated favicon.ico (PNG fallback - add to-ico for proper ICO)');
  }
  fs.unlinkSync(favicon48Path);
}

async function main() {
  if (!fs.existsSync(LOGO_PATH)) {
    console.error('Logo not found at', LOGO_PATH);
    process.exit(1);
  }

  try {
    await generateWithSharp();
    console.log('\nPWA icons generated successfully.');
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      console.error(
        'Missing dependency. Install with:\n  yarn add -D sharp to-ico\n\nThen run:\n  node scripts/generate-pwa-icons.js'
      );
    } else {
      console.error('Error generating icons:', err.message);
    }
    process.exit(1);
  }
}

main();
