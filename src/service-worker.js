/* eslint-disable no-restricted-globals */
/**
 * Service worker for CicloMapa PWA.
 * CRA uses Workbox InjectManifest — __WB_MANIFEST is injected at build time.
 * See: https://create-react-app.dev/docs/making-a-progressive-web-app/
 */

import { clientsClaim } from 'workbox-core';
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { enable as enableNavigationPreload } from 'workbox-navigation-preload';

clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);

enableNavigationPreload();

// SPA navigation: prefer network (benefits from navigation preload on cold start),
// fall back to cache when offline or slow (> 3 s).
registerRoute(
  new NavigationRoute(
    new NetworkFirst({
      cacheName: 'navigations',
      networkTimeoutSeconds: 3,
    }),
    { denylist: [/^\/_/, /[^/?]+\.[^/]+$/] }
  )
);

// --- Runtime caching for external resources ---

// CacheFirst: Mapbox (tiles, geocoding, styles, glyphs, sprites)
registerRoute(
  ({ url }) => url.hostname.endsWith('.mapbox.com'),
  new CacheFirst({
    cacheName: 'mapbox',
    plugins: [new ExpirationPlugin({ maxEntries: 500, maxAgeSeconds: 7 * 24 * 60 * 60 })],
  })
);

// CacheFirst: Nominatim (search, reverse geocoding)
registerRoute(
  ({ url }) => url.hostname === 'nominatim.openstreetmap.org',
  new CacheFirst({
    cacheName: 'nominatim',
    plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 24 * 60 * 60 })],
  })
);

// StaleWhileRevalidate: Airtable (city metadata, comments)
registerRoute(
  ({ url }) => url.hostname === 'api.airtable.com',
  new StaleWhileRevalidate({
    cacheName: 'airtable',
    plugins: [new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 7 * 24 * 60 * 60 })],
  })
);

// StaleWhileRevalidate: Google Fonts
registerRoute(
  ({ url }) =>
    url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
  new StaleWhileRevalidate({
    cacheName: 'google-fonts',
    plugins: [new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 365 * 24 * 60 * 60 })],
  })
);

// Listen for skipWaiting message (sent from update banner in index.js)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
