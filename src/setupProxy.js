const { createProxyMiddleware } = require('http-proxy-middleware');

// Local BRouter (routing/brouter/run-local.sh). Avoids browser CORS.
module.exports = function setupProxy(app) {
  app.use(
    '/local-brouter',
    createProxyMiddleware({
      target: 'http://127.0.0.1:17777',
      changeOrigin: true,
      // Nested profile path unlocks BRouter's _debug/debug.txt engine log
      // (see routing/brouter/run-local.sh). Bare "ciclomapa" never opens it.
      pathRewrite: (urlPath) =>
        urlPath
          .replace(/^\/local-brouter/, '')
          .replace(/([?&])profile=ciclomapa\b/, '$1profile=_debug/p/ciclomapa'),
      logLevel: 'warn',
    })
  );
};
