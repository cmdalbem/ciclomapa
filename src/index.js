import React from 'react';
import ReactDOM from 'react-dom/client'; // Note the updated import
import App from './App';
import * as serviceWorker from './serviceWorker';
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

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

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<App ref={(app) => { window.ciclomapa = app }} />} />
      <Route path="/routes" element={<App ref={(app) => { window.ciclomapa = app }} />} />
      <Route path="/:city" element={<App ref={(app) => { window.ciclomapa = app }} />} />
    </Routes>
  );
}

// Render the app using the new root API
root.render(
  <Router>
    <AppRoutes />
  </Router>
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
