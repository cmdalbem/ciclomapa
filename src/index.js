import React from 'react';
import ReactDOM from 'react-dom/client'; // Note the updated import
import App from './App';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { getCssCustomProperties } from './config/design-tokens.js';

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
    </Routes>
  );
}

// Render the app using the new root API
root.render(
  <Router>
    <AppRoutes />
  </Router>
);

// --- Service Worker update lifecycle ---
// On update, activate the new SW immediately; controllerchange handler reloads once.
let hasReloadedForSwUpdate = false;
if ('serviceWorker' in navigator) {
  const hadControllerOnLoad = Boolean(navigator.serviceWorker.controller);

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hasReloadedForSwUpdate) return;
    if (!hadControllerOnLoad) return;
    hasReloadedForSwUpdate = true;
    window.location.reload();
  });
}

// --- Chunk-load error recovery with infinite-reload guard ---
const CHUNK_RELOAD_KEY = 'ciclomapa-chunk-fail-reloads';

function reloadForChunkError() {
  const count = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0);
  if (count >= 2) return;
  sessionStorage.setItem(CHUNK_RELOAD_KEY, String(count + 1));
  window.location.reload();
}

window.addEventListener('load', () => sessionStorage.removeItem(CHUNK_RELOAD_KEY));

window.addEventListener('error', (event) => {
  const msg = event?.message || '';
  if (typeof msg === 'string' && msg.includes('Loading chunk') && msg.includes('failed')) {
    reloadForChunkError();
  }
});
window.addEventListener('unhandledrejection', (event) => {
  const msg = event?.reason?.message || '';
  if (typeof msg === 'string' && msg.includes('Loading chunk') && msg.includes('failed')) {
    reloadForChunkError();
  }
});

// Register service worker (production only).
serviceWorkerRegistration.register({
  onUpdate: (registration) => {
    const waiting = registration?.waiting;
    if (waiting) {
      waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  },
});
