import React from 'react';
import ReactDOM from 'react-dom/client'; // Note the updated import
import App from './App';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import PlaceTypeIconsReviewPage from './dev/PlaceTypeIconsReviewPage.jsx';
import { getCssCustomProperties } from './config/design-tokens.js';
import { IS_PROD } from './config/constants.js';

// No-op console.debug in production to reduce noise
if (process.env.NODE_ENV === 'production') {
  console.debug = () => {};
}

// Expose design tokens as CSS custom properties
const tokens = getCssCustomProperties();
Object.entries(tokens).forEach(([key, value]) => {
  document.documentElement.style.setProperty(key, value);
});

// Function to set viewport height CSS custom property
// This accounts for mobile browser UI (address bar, navigation bar) which 100vh doesn't
function setViewportHeight() {
  document.documentElement.style.setProperty('--viewport-height', `${window.innerHeight}px`);
}

// Set initial viewport height
setViewportHeight();

// Update viewport height on resize and orientation change
// Use a debounced approach to avoid excessive updates
let resizeTimeout;
function handleResize() {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    setViewportHeight();
  }, 100);
}

window.addEventListener('resize', handleResize);
window.addEventListener('orientationchange', () => {
  // Small delay to ensure the viewport has updated after orientation change
  setTimeout(setViewportHeight, 100);
});

// Also update on visual viewport changes (for mobile browsers with dynamic UI)
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', handleResize);
  window.visualViewport.addEventListener('scroll', handleResize);
}

// Create a root using ReactDOM.createRoot
const root = ReactDOM.createRoot(document.getElementById('root'));

const shouldExposeDebugHandles =
  new URLSearchParams(window.location.search).has('debug') && process.env.NODE_ENV !== 'production';

function AppRoutes() {
  const appRef = (app) => {
    if (!shouldExposeDebugHandles) return;
    window.ciclomapa = app;
  };

  return (
    <Routes>
      <Route path="/" element={<App ref={appRef} />} />
      <Route path="/routes" element={<App ref={appRef} />} />
      <Route path="/:city/routes" element={<App ref={appRef} />} />
      <Route path="/:city" element={<App ref={appRef} />} />
      {!IS_PROD ? (
        <Route path="/dev/place-type-icons" element={<PlaceTypeIconsReviewPage />} />
      ) : null}
    </Routes>
  );
}

// Render the app using the new root API
root.render(
  <Router>
    <AppRoutes />
  </Router>
);

// If a deploy happens while the PWA is "sleeping" on mobile, it's common to end up with
// an old HTML shell referencing new/removed chunk files, resulting in a black screen.
// This forces a clean reload once the updated service worker takes control.
let hasReloadedForSwUpdate = false;
if ('serviceWorker' in navigator) {
  // On first service-worker install there is no previous controller yet.
  // Reloading in that case creates the "auto refresh on first visit" symptom.
  // We only want to reload for SW updates (when there *was* a controller).
  const hadServiceWorkerControllerOnLoad = Boolean(navigator.serviceWorker.controller);

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hasReloadedForSwUpdate) return;
    if (!hadServiceWorkerControllerOnLoad) return;
    hasReloadedForSwUpdate = true;
    window.location.reload();
  });
}

// Last-resort guard: if a JS chunk fails to load (typically after an update), reload.
window.addEventListener('error', (event) => {
  const message = event?.message || '';
  if (
    typeof message === 'string' &&
    message.includes('Loading chunk') &&
    message.includes('failed')
  ) {
    window.location.reload();
  }
});
window.addEventListener('unhandledrejection', (event) => {
  const message = event?.reason?.message || '';
  if (
    typeof message === 'string' &&
    message.includes('Loading chunk') &&
    message.includes('failed')
  ) {
    window.location.reload();
  }
});

// Register service worker for PWA/TWA (production only).
// On update, activate the new SW immediately; controllerchange handler above reloads once.
serviceWorkerRegistration.register({
  onUpdate: (registration) => {
    const waiting = registration?.waiting;
    if (waiting) {
      waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  },
});
