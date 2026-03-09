import '@testing-library/jest-dom';

// Polyfill for mapbox-gl (and other deps) in jsdom
if (typeof global.TextDecoder === 'undefined') {
  const { TextDecoder, TextEncoder } = require('util');
  global.TextDecoder = TextDecoder;
  global.TextEncoder = TextEncoder;
}
