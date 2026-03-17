#!/usr/bin/env node
/**
 * Generates PWA icons from the CicloMapa logo.
 * Run: node scripts/generate-pwa-icons.js
 *
 * Expects two source files in public/:
 *   icon-dark.png  — for light theme (dark icon on light background)
 *   icon-light.png — for dark theme (light icon on dark background)
 *
 * Requires: sharp, to-ico (yarn add -D sharp to-ico)
 */

const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const ICON_PATH = path.join(PUBLIC_DIR, 'icon.png');
const FAVICON_DARK_PATH = path.join(PUBLIC_DIR, 'favicon-dark.png');
const FAVICON_LIGHT_PATH = path.join(PUBLIC_DIR, 'favicon-light.png');

async function generateWithSharp() {
  const sharp = require('sharp');

  const iconBuffer = fs.readFileSync(ICON_PATH);
  const faviconDarkBuffer = fs.readFileSync(FAVICON_DARK_PATH);
  const faviconLightBuffer = fs.readFileSync(FAVICON_LIGHT_PATH);

  // PWA icons: resize icon.png (main icon) to standard sizes
  const pwaIconSizes = [
    { name: 'icon-192.png', size: 192 },
    { name: 'icon-512.png', size: 512 },
  ];

  for (const { name, size } of pwaIconSizes) {
    await sharp(iconBuffer).resize(size, size).png().toFile(path.join(PUBLIC_DIR, name));
    console.log(`Generated ${name}`);
  }

  // Favicons: generate dark and light theme variants
  const faviconSizes = [16, 32, 48];
  const variants = [
    { suffix: '-dark', icon: faviconDarkBuffer },
    { suffix: '-light', icon: faviconLightBuffer },
  ];

  for (const { suffix, icon } of variants) {
    const buffers = [];

    for (const size of faviconSizes) {
      const buf = await sharp(icon).resize(size, size).png().toBuffer();
      buffers.push(buf);
    }

    const pngPath = path.join(PUBLIC_DIR, `favicon${suffix}.png`);
    fs.writeFileSync(pngPath, buffers[2]);
    console.log(`Generated favicon${suffix}.png`);

    try {
      const toIco = require('to-ico');
      const icoBuffer = await toIco(buffers);
      fs.writeFileSync(path.join(PUBLIC_DIR, `favicon${suffix}.ico`), icoBuffer);
      console.log(`Generated favicon${suffix}.ico (16x16, 32x32, 48x48)`);
    } catch {
      fs.copyFileSync(pngPath, path.join(PUBLIC_DIR, `favicon${suffix}.ico`));
      console.log(`Generated favicon${suffix}.ico (PNG fallback - add to-ico for proper ICO)`);
    }
  }

  // Default favicon.ico (dark variant) for legacy compatibility
  fs.copyFileSync(path.join(PUBLIC_DIR, 'favicon-dark.ico'), path.join(PUBLIC_DIR, 'favicon.ico'));
  console.log('Generated favicon.ico (copy of dark variant)');

  // SVG favicon with embedded prefers-color-scheme (works in Chrome, Firefox, Safari)
  const darkBase64 = (await sharp(faviconDarkBuffer).resize(32, 32).png().toBuffer()).toString(
    'base64'
  );
  const lightBase64 = (await sharp(faviconLightBuffer).resize(32, 32).png().toBuffer()).toString(
    'base64'
  );
  const svgFavicon = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">
  <style>
    image.light { display: none; }
    image.dark { display: inline; }
    @media (prefers-color-scheme: light) {
      image.light { display: inline; }
      image.dark { display: none; }
    }
  </style>
  <image class="dark" width="32" height="32" href="data:image/png;base64,${darkBase64}"/>
  <image class="light" width="32" height="32" href="data:image/png;base64,${lightBase64}"/>
</svg>`;
  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.svg'), svgFavicon);
  console.log('Generated favicon.svg (auto dark/light switching)');
}

async function main() {
  const missing = [ICON_PATH, FAVICON_DARK_PATH, FAVICON_LIGHT_PATH].filter(
    (p) => !fs.existsSync(p)
  );
  if (missing.length) {
    console.error('Missing source icon(s):');
    missing.forEach((p) => console.error(`  ${p}`));
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
