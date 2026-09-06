import * as Sentry from '@sentry/react';

const dsn = process.env.REACT_APP_SENTRY_DSN;

function sentryEnvironment() {
  if (process.env.NODE_ENV !== 'production') return 'development';
  if (typeof window !== 'undefined' && window.location.hostname === 'ciclomapa.app') {
    return 'production';
  }
  return 'preview';
}

if (dsn && process.env.NODE_ENV !== 'test') {
  Sentry.init({
    dsn,
    environment: sentryEnvironment(),
    sendDefaultPii: false,
    dataCollection: {
      userInfo: false,
      httpBodies: [],
    },
    // Chunk-load failures already trigger a reload in index.js; don't burn quota on them.
    ignoreErrors: [
      /Loading chunk [\d]+ failed/,
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
    ],
  });
}
