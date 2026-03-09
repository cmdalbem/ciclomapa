import '@testing-library/jest-dom';

// Polyfill for mapbox-gl (and other deps) in jsdom
if (typeof global.TextDecoder === 'undefined') {
  const { TextDecoder, TextEncoder } = require('util');
  global.TextDecoder = TextDecoder;
  global.TextEncoder = TextEncoder;
}

// JSDOM does not implement IntersectionObserver (used by LayersLegendModal and others in tests)
if (typeof global.IntersectionObserver === 'undefined') {
  global.IntersectionObserver = class IntersectionObserver {
    constructor(callback, _options) {
      this.callback = callback;
      this.elements = new Set();
    }
    observe(element) {
      this.elements.add(element);
    }
    unobserve(element) {
      this.elements.delete(element);
    }
    disconnect() {
      this.elements.clear();
    }
  };
}
