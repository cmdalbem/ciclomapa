# CicloMapa — TWA & Google Play Store Submission Guide

This document describes how to package CicloMapa as a Trusted Web Activity (TWA) app and submit it to the Google Play Store.

## Prerequisites

- **Production site live** at https://ciclomapa.app (TWA loads the real site)
- **PWA readiness** (manifest, icons, service worker) — completed in this branch
- **Node.js 22** and **Java 11+** (for Bubblewrap)
- **Android Studio** or **Android SDK** (for signing and building)

---

## Part 1: TWA Implementation with Bubblewrap

### 1.1 Install Bubblewrap

```bash
npm install -g @bubblewrap/cli
bubblewrap init
```

When prompted:

- **Application ID**: `br.org.ciclomapa.app` (or your chosen package name)
- **Application Name**: CicloMapa
- **Launcher Name**: CicloMapa
- **Start URL**: `https://ciclomapa.app/`
- **Icon URL**: `https://ciclomapa.app/icon-512.png`
- **Maskable Icon URL**: Not used (current `icon-512.png` is safe to mask)
- **Theme Color**: `#1c1717`
- **Background Color**: `#1a1a1a`

### 1.2 Digital Asset Links (Required for TWA)

TWA requires your site to declare the link between the web app and the Android app.

1. **Get your app signing fingerprint** (SHA-256):

   ```bash
   keytool -list -v -keystore path/to/your.keystore -alias your-alias
   ```

   Or from Play Console: **Setup → App signing** → copy SHA-256 certificate fingerprint.

2. **Create** `public/.well-known/assetlinks.json` (copy from `assetlinks.json.template`):
   - Replace `REPLACE_WITH_YOUR_SHA256_FINGERPRINT` with your app signing SHA-256 (colon-separated, e.g. `AB:CD:EF:...`).
   - Replace `br.org.ciclomapa.app` if you chose a different package name.
   - Rename/copy to `assetlinks.json` (remove `.template`).
   - This will be served at `https://ciclomapa.app/.well-known/assetlinks.json`.

3. **Serve** `assetlinks.json` with:
   - `Content-Type: application/json`
   - HTTPS
   - No redirects

4. **Verify** at: https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://ciclomapa.app&relation=delegate_permission/common.handle_all_urls

### 1.3 Build the TWA

```bash
cd <bubblewrap-output-directory>
bubblewrap build
```

This produces an AAB (Android App Bundle) for Play Store upload.

---

## Part 2: Play Store Submission Checklist

### 2.1 Before Submission

| Item                                               | Status |
| -------------------------------------------------- | ------ |
| PWA installable on Chrome Android                  | ✓      |
| manifest.json with name, icons, start_url, display | ✓      |
| Service worker registered in production            | ✓      |
| assetlinks.json on production                      | ⬜     |
| Privacy policy URL                                 | ⬜     |
| App signing key generated                          | ⬜     |

### 2.2 Play Console Setup

1. **Create app** in [Google Play Console](https://play.google.com/console).

2. **App signing**
   - Use Play App Signing (recommended).
   - Upload your upload key or let Google generate it.

3. **Store listing**
   - Short description (80 chars)
   - Full description (4000 chars)
   - Screenshots: at least 2 phone screenshots (min 320px, max 3840px)
   - Feature graphic: 1024×500 px
   - App icon: 512×512 px (use `icon-512.png`)

4. **Content rating**
   - Complete the questionnaire (likely “Everyone” for a map app).

5. **Data safety**
   - Declare data collection (e.g. location if used, analytics).
   - GTM/Analytics, Mapbox, Firestore, etc. may collect data — document each.

6. **Privacy policy**
   - Required. Host at e.g. `https://ciclomapa.app/privacidade` or similar.
   - Link it in the store listing and in the app if you have an About/Privacy screen.

7. **Target audience**
   - Set age groups and regions (e.g. Brazil).

8. **Upload AAB**
   - Use the AAB from `bubblewrap build`.
   - Fill in release notes.

### 2.3 Testing Before Release

- Install the TWA on a real Android device.
- Confirm the app opens https://ciclomapa.app in fullscreen.
- Test geolocation, external links, file export.
- Run **Pre-launch report** in Play Console and fix any issues.

---

## Part 3: Repo Changes Summary (This Branch)

### Files Changed

| File                            | Change                                                                           |
| ------------------------------- | -------------------------------------------------------------------------------- |
| `public/manifest.json`          | start_url `/`, scope, theme/background colors, icon entries (192, 512, maskable) |
| `public/icon-192.png`           | New — PWA icon                                                                   |
| `public/icon-512.png`           | New — PWA icon                                                                   |
| `public/icon-maskable-192.png`  | Not used                                                                         |
| `public/icon-maskable-512.png`  | Not used                                                                         |
| `public/favicon.ico`            | New — Favicon (from logo)                                                        |
| `src/service-worker.js`         | New — Workbox service worker (precache, routing)                                 |
| `src/index.js`                  | `serviceWorker.register()` instead of `unregister()`                             |
| `scripts/generate-pwa-icons.js` | New — Icon generation from logo                                                  |
| `package.json`                  | `generate-pwa-icons` script, sharp, to-ico devDependencies                       |

### Regenerating Icons

```bash
yarn generate-pwa-icons
```

---

## Part 4: Risks and Limitations

1. **TWA = web app in a shell**
   - Not a fully native app. Limited access to native APIs.

2. **assetlinks.json must be correct**
   - Wrong fingerprint or package name will prevent TWA from launching.

3. **Play review**
   - Approval is not guaranteed. Thin wrappers can be rejected if they add little value.

4. **Offline behavior**
   - Service worker caches the shell and static assets. Map data, Firestore, Overpass, etc. still need network.

5. **External links**
   - Links with `target="_blank"` open in the system browser. This is expected and usually desired.

6. **Geolocation**
   - Works in TWA. Ensure the site requests permission appropriately on first use.

---

## Part 5: Quick Reference

- **TWA tool**: [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap)
- **Digital Asset Links**: [Android docs](https://developer.android.com/training/app-links/verify-android-applinks)
- **PWA + TWA**: [web.dev TWA](https://web.dev/trusted-web-activity/)
