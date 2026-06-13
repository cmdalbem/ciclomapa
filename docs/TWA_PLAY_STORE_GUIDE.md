# CicloMapa — TWA & Google Play Store Submission Guide

This document describes how to package CicloMapa as a Trusted Web Activity (TWA) app and submit it to the Google Play Store.

## Prerequisites

- **Production site live** at https://ciclomapa.app (TWA loads the real site)
- **PWA readiness** (manifest, icons, service worker) — completed in this branch
- **Node.js 22** and **JDK 17+** (required by current Bubblewrap)
- **Android Studio** or **Android SDK** (for signing and building)

---

## Part 1: TWA Implementation with Bubblewrap

### 1.1 Install Bubblewrap

```bash
yarn global add @bubblewrap/cli
bubblewrap init
```

When prompted:

- **Application ID**: `app.ciclomapa` (reverse-DNS of `ciclomapa.app`; permanent once published)
- **Application Name**: CicloMapa
- **Launcher Name**: CicloMapa
- **Start URL**: `https://ciclomapa.app/`
- **Icon URL**: `https://ciclomapa.app/icon-512.png`
- **Maskable Icon URL**: Not used (current `icon-512.png` is safe to mask)
- **Theme Color**: `#1c1717`
- **Background Color**: `#1a1a1a`

Bubblewrap reads `display` from the live web manifest. CicloMapa uses **`standalone`**
(not `fullscreen`). Standalone hides the browser chrome but keeps the Android system
navigation bar (back, home, recents) visible. **`fullscreen` hides that bar** and is a
common source of “I can't go back” reports on installed Android builds.

### 1.2 Digital Asset Links (Required for TWA)

TWA requires your site to declare the link between the web app and the Android app.

1. **Get your app signing fingerprint** (SHA-256):

   ```bash
   keytool -list -v -keystore path/to/your.keystore -alias your-alias
   ```

   Or from Play Console: **Setup → App signing** → copy SHA-256 certificate fingerprint.

2. **Create** `public/.well-known/assetlinks.json` (copy from `assetlinks.json.template`):
   - Replace `REPLACE_WITH_YOUR_SHA256_FINGERPRINT` with your app signing SHA-256 (colon-separated, e.g. `AB:CD:EF:...`).
   - Replace `app.ciclomapa` if you chose a different package name.
   - Save as `assetlinks.json` (remove the `.template` suffix). **Only the `.template` is committed** — the real file is the last step (you need the fingerprint first).
   - `react-scripts build` copies `public/.well-known/` into the build output, so it will be served at `https://ciclomapa.app/.well-known/assetlinks.json`.

3. **Hosting (Vercel) — important gotcha:**
   - The site uses a **SPA catch-all rewrite**, so any path that is _not_ a real file (including `.well-known/assetlinks.json` before you create it) returns `index.html` with HTTP **200** and `Content-Type: text/html`. This looks like the file exists but it does **not** — TWA verification will fail.
   - Vercel serves real static files _before_ the rewrite, so once the actual `assetlinks.json` exists in `public/.well-known/`, it is served correctly.
   - `vercel.json` pins `Content-Type: application/json` for that path. Do **not** add a redirect on it.
   - Sanity check after deploy: `curl -sI https://ciclomapa.app/.well-known/assetlinks.json` should show `content-type: application/json` (not `text/html`).

4. **Verify** at: https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://ciclomapa.app&relation=delegate_permission/common.handle_all_urls

### 1.3 Build the TWA

```bash
cd <bubblewrap-output-directory>
bubblewrap build
```

This produces an AAB (Android App Bundle) for Play Store upload.

### 1.4 Updating the TWA after manifest changes

When `public/manifest.json` changes (e.g. `display`, icons, theme colors), deploy the site
first, then refresh the Android shell:

```bash
cd <bubblewrap-output-directory>
bubblewrap update   # pulls the live manifest from https://ciclomapa.app
bubblewrap build
```

Upload the new AAB to Play Console. Existing installs pick up the change after users
update the app from the store (PWA “Add to Home Screen” installs may need a reinstall).

---

## Part 2: Play Store Submission Checklist

### 2.1 Before Submission

| Item                                                             | Status |
| ---------------------------------------------------------------- | ------ |
| PWA installable on Chrome Android                                | ✓      |
| manifest.json with name, icons, start_url, `display: standalone` | ✓      |
| Service worker registered in production                          | ✓      |
| assetlinks.json on production                                    | ⬜     |
| Privacy policy URL (`/privacidade`)                              | ✓      |
| App signing key generated                                        | ⬜     |

### 2.2 Play Console Setup

> Store listing copy (PT-BR) and the Data Safety field-by-field mapping live in
> [`docs/PLAY_STORE_LISTING.md`](./PLAY_STORE_LISTING.md). The steps below are the
> click-path in the Play Console (the part only the account owner can do).

These steps all happen in the [Google Play Console](https://play.google.com/console)
web UI with the developer account (one-time **US$25** registration fee if it's a new account).

1. **Create app**
   - **All apps → Create app.**
   - App name: `CicloMapa` · Default language: `Português (Brasil)` · Type: **App** · **Free**.
   - Accept the Developer Program / US export declarations.

2. **App signing** (Setup → App integrity → App signing)
   - Use **Play App Signing** (recommended; Google holds the app signing key).
   - You upload an **upload key**; the simplest path is to let **Bubblewrap generate the
     keystore** (Part 1.3) and upload the AAB — Play enrolls you automatically on first upload.
   - After the app exists, copy the **SHA-256 of the _app signing_ certificate** from this
     page → that's the fingerprint for `assetlinks.json` (Part 1.2). ⚠️ Use the **app signing**
     cert, not the upload cert, or TWA verification fails.

3. **Store listing** (Grow → Store presence → Main store listing)
   - Paste short/full description and graphics from `docs/PLAY_STORE_LISTING.md`.
   - App icon: **512×512** → `public/icon-512.png`.
   - Feature graphic **1024×500** and ≥2 phone screenshots still need to be produced.

4. **Content rating** (Policy → App content → Content rating)
   - Complete the IARC questionnaire (expected **Livre / Everyone** for a map app).

5. **Data safety** (Policy → App content → Data safety)
   - Fill exactly as mapped in `docs/PLAY_STORE_LISTING.md` §3.
   - Confirm the ⚠️ items there (PostHog session replay, GA data-sharing, IP handling)
     before submitting — they can flip "Shared" to Yes.

6. **Privacy policy** (Policy → App content → Privacy policy)
   - URL: `https://ciclomapa.app/privacidade` (already live and linked in-app). ✓

7. **Target audience & ads** (Policy → App content)
   - Target age: 13+ (not a children's app). Primary region: Brazil + Latin America.
   - Ads: **No** (the app shows no ads).

8. **Create a release** (Release → Testing → Internal testing, then Production)
   - Start with **Internal testing** to validate the TWA on real devices before going live.
   - Upload the **AAB** from `bubblewrap build`, add release notes (see listing doc), roll out.

### 2.3 Testing Before Release

- Install the TWA on a real Android device.
- Confirm the app opens https://ciclomapa.app in **standalone** mode (no browser address bar).
- Confirm the **Android system navigation bar** (back, home, recents) stays visible — do not
  ship with `display: fullscreen` in the manifest.
- Test geolocation, external links, file export.
- Run **Pre-launch report** in Play Console and fix any issues.

---

## Part 3: Repo Changes Summary (This Branch)

### Files Changed

| File                                          | Change                                                                                                 |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `public/manifest.json`                        | start_url `/`, scope, `display: standalone`, theme/background colors, icon entries (favicon, 192, 512) |
| `public/icon-192.png`                         | New — PWA icon                                                                                         |
| `public/icon-512.png`                         | New — PWA icon (also used as the 512×512 Play Store icon)                                              |
| `public/favicon.ico` / `favicon.svg`          | New — favicons generated from `favicon-dark.png` / `favicon-light.png`                                 |
| `public/.well-known/assetlinks.json.template` | New — Digital Asset Links template (real file created at submission)                                   |
| `vercel.json`                                 | New — pins `Content-Type: application/json` for `/.well-known/assetlinks.json`                         |
| `src/service-worker.js`                       | New — Workbox service worker (precache, routing)                                                       |
| `src/index.js`                                | `serviceWorkerRegistration.register()` (enables PWA service worker)                                    |
| `src/serviceWorkerRegistration.js`            | Renamed — service worker registration helper (was `src/serviceWorker.js`)                              |
| `scripts/generate-pwa-icons.js`               | New — Icon generation from `icon.png` + favicon sources                                                |
| `package.json`                                | `generate-pwa-icons` script, sharp, to-ico devDependencies                                             |

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

7. **Manifest `display` mode**
   - Use **`standalone`**, not **`fullscreen`**, on Android. Fullscreen hides the system
     navigation bar; users may think the app is broken or trapped.

---

## Part 5: Quick Reference

- **TWA tool**: [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap)
- **Digital Asset Links**: [Android docs](https://developer.android.com/training/app-links/verify-android-applinks)
- **PWA + TWA**: [web.dev TWA](https://web.dev/trusted-web-activity/)
