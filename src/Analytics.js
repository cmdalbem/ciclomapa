let mapReadySignaled = false;

class Analytics {
  static gtag() {
    if (window.dataLayer) {
      window.dataLayer.push(arguments);
    }
  }

  // Pushes a `mapReady` event into the dataLayer exactly once so GTM can defer
  // heavy tags (e.g. PostHog + session recorder) until the map has settled,
  // instead of loading them during app boot. Idempotent: GTM dedupe aside, we
  // never push twice (map can idle repeatedly; the fallback timer may also fire).
  static signalMapReady() {
    if (mapReadySignaled) return;
    mapReadySignaled = true;
    if (window.dataLayer) {
      window.dataLayer.push({ event: 'mapReady' });
    }
    console.debug("dataLayer.push({ event: 'mapReady' })");
  }

  static event(name, opts = {}) {
    this.gtag('event', name, opts);
    console.debug(`this.gtag('event', ${name}, ...);`, opts);
  }

  static setUserProperty(opts = {}) {
    this.gtag('set', 'user_properties', opts);
  }
}

export default Analytics;
