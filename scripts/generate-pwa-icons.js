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
const LOGO_PATH = path.join(PUBLIC_DIR, 'logo.svg');

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
    // Logo aspect ratio ~105:18, fit by width
    const logoWidth = innerSize;
    const logoHeight = Math.round(innerSize * (18 / 105));

    const resizedLogo = await sharp(logoBuffer)
      .resize(logoWidth, logoHeight)
      .toBuffer();

    const bgSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="${BACKGROUND_COLOR}"/></svg>`;
    const outputPath = path.join(PUBLIC_DIR, name);
    await sharp(Buffer.from(bgSvg))
      .composite([
        {
          input: resizedLogo,
          top: Math.round((size - logoHeight) / 2),
          left: padding,
        },
      ])
      .png()
      .toFile(outputPath);
    console.log(`Generated ${name}`);
  }

  // Favicon: use circle icon (from logo's "O") - 48x48 and 32x32
  const faviconSvg = `
    <svg width="48" height="48" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" fill="${BACKGROUND_COLOR}"/>
      <circle cx="24" cy="24" r="18" fill="none" stroke="${ACCENT_COLOR}" stroke-width="4"/>
    </svg>
  `;
  const favicon48Path = path.join(PUBLIC_DIR, 'favicon-48.png');
  await sharp(Buffer.from(faviconSvg)).png().toFile(favicon48Path);

  const favicon32Svg = `
    <svg width="32" height="32" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" fill="${BACKGROUND_COLOR}"/>
      <circle cx="16" cy="16" r="12" fill="none" stroke="${ACCENT_COLOR}" stroke-width="2.5"/>
    </svg>
  `;
  const favicon32Path = path.join(PUBLIC_DIR, 'favicon-32.png');
  await sharp(Buffer.from(favicon32Svg)).png().toFile(favicon32Path);

  try {
    const toIco = require('to-ico');
    const icon32 = fs.readFileSync(favicon32Path);
    const icoBuffer = await toIco([icon32]);
    fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.ico'), icoBuffer);
    console.log('Generated favicon.ico');
  } catch {
    fs.copyFileSync(favicon32Path, path.join(PUBLIC_DIR, 'favicon.ico'));
    console.log('Generated favicon.ico (PNG format - add to-ico for proper ICO)');
  }
  fs.unlinkSync(favicon48Path);
  fs.unlinkSync(favicon32Path);
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
