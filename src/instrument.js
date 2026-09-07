import * as Sentry from '@sentry/react';

const dsn = process.env.REACT_APP_SENTRY_DSN;

// Only report from real deploys: ciclomapa.app and Vercel preview URLs (beta).
// Skip localhost / yarn start even if the DSN is in .env.
function sentryEnvironment() {
  if (typeof window === 'undefined') return null;
  const host = window.location.hostname;
  if (host === 'ciclomapa.app' || host === 'www.ciclomapa.app') return 'production';
  if (host.endsWith('.vercel.app')) return 'preview';
  return null;
}

const environment = sentryEnvironment();

if (dsn && environment) {
  Sentry.init({
    dsn,
    environment,
    sendDefaultPii: false,
    dataCollection: {
      userInfo: false,
      httpBodies: [],
    },
    integrations: (integrations) => [
      ...integrations,
      Sentry.captureConsoleIntegration({ levels: ['error', 'warn'] }),
    ],
    // Drop known noise before it hits the free-plan quota. Chunk-load failures
    // already trigger a reload in index.js. Google Places and Mapbox `light`
    // deprecations are library/style warnings until those APIs are migrated.
    ignoreErrors: [
      /Loading chunk [\d]+ failed/,
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      /google\.maps\.places\.(PlacesService|AutocompleteService)/,
      /As of May 2023, bounds, location, and radius are deprecated/,
      /The `light` root property is deprecated/,
    ],
  });

  let anonymousUserId;
  try {
    anonymousUserId = window.localStorage.getItem('ciclomapa:sentry-user-id');
    if (!anonymousUserId) {
      anonymousUserId = window.crypto.randomUUID();
      window.localStorage.setItem('ciclomapa:sentry-user-id', anonymousUserId);
    }
  } catch {
    anonymousUserId = window.crypto.randomUUID();
  }
  Sentry.setUser({ id: anonymousUserId });
}
