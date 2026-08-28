const CracoLessPlugin = require('craco-less');

// Tree-shake antd in webpack only; applying this in Jest breaks TS/ESM transforms.
const babelPlugins =
  process.env.NODE_ENV === 'test'
    ? []
    : [
        [
          'import',
          {
            libraryName: 'antd',
            libraryDirectory: 'es',
            style: false,
          },
          'antd',
        ],
      ];

module.exports = {
  babel: {
    plugins: babelPlugins,
  },
  plugins: [
    {
      plugin: CracoLessPlugin,
      options: {
        lessLoaderOptions: {
          lessOptions: {
            javascriptEnabled: true,
          },
        },
      },
    },
  ],
  webpack: {
    configure: (webpackConfig) => {
      // CRA's default webpack config runs Babel on most node_modules packages.
      // mapbox-gl shares code between the main thread and its Web Worker; transpiling
      // it injects helpers (e.g. _createClass) that exist only in the main bundle, so the
      // worker throws ReferenceError for minified names like "a" / "o" in production.
      // https://docs.mapbox.com/mapbox-gl-js/guides/install/#transpiling
      const mapboxGlPath = /[\\/]node_modules[\\/]mapbox-gl[\\/]/;
      const oneOfRule = webpackConfig.module.rules.find((rule) => rule.oneOf)?.oneOf;
      if (oneOfRule) {
        for (const rule of oneOfRule) {
          const isNodeModulesBabelRule =
            rule.loader &&
            String(rule.loader).includes('babel-loader') &&
            !rule.include &&
            rule.test &&
            String(rule.test).includes('mjs');
          if (!isNodeModulesBabelRule) continue;

          if (Array.isArray(rule.exclude)) {
            rule.exclude.push(mapboxGlPath);
          } else if (rule.exclude) {
            rule.exclude = [rule.exclude, mapboxGlPath];
          } else {
            rule.exclude = mapboxGlPath;
          }
        }
      }

      return webpackConfig;
    },
  },
  devServer: {
    proxy: {
      '/api/openrouteservice': {
        target: 'https://api.openrouteservice.org',
        changeOrigin: true,
        pathRewrite: {
          '^/api/openrouteservice': '',
        },
        secure: true,
        logLevel: 'debug',
      },
      '/pmtiles': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        logLevel: 'debug',
      },
    },
  },
};
