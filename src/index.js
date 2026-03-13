import React from 'react';
import ReactDOM from 'react-dom/client'; // Note the updated import
import App from './App';
import * as serviceWorker from './serviceWorker';
import { BrowserRouter as Router } from 'react-router-dom';
import { MobileProvider } from './contexts/MobileContext.js';
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

// Render the app using the new root API
root.render(
  <MobileProvider>
    <Router>
      <App
        ref={(app) => {
          if (!shouldExposeDebugHandles) return;
          window.ciclomapa = app;
        }}
      />
    </Router>
  </MobileProvider>
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
