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
            // Add rule to handle TypeScript files in node_modules
            webpackConfig.module.rules.push({
                test: /\.tsx?$/,
                include: /node_modules\/(mapbox-pmtiles|pmtiles)/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: [
                            ['@babel/preset-env', { targets: { node: 'current' } }],
                            ['@babel/preset-typescript', { 
                                allowDeclareFields: true,
                                onlyRemoveTypeImports: true 
                            }]
                        ],
                        plugins: [
                            '@babel/plugin-proposal-class-properties'
                        ]
                    }
                }
            });

            // Exclude these packages from source-map-loader
            const sourceMapLoaderRule = webpackConfig.module.rules.find(
                rule => rule.use && rule.use.find && rule.use.find(use => use.loader && use.loader.includes('source-map-loader'))
            );
            
            if (sourceMapLoaderRule) {
                sourceMapLoaderRule.exclude = [
                    ...(sourceMapLoaderRule.exclude || []),
                    /node_modules\/(mapbox-pmtiles|pmtiles)/
                ];
            }

            return webpackConfig;
        }
    },
    devServer: {
        proxy: {
            '/api/openrouteservice': {
                target: 'https://api.openrouteservice.org',
                changeOrigin: true,
                pathRewrite: {
                    '^/api/openrouteservice': ''
                },
                secure: true,
                logLevel: 'debug'
            },
            '/pmtiles': {
                target: 'http://localhost:3000',
                changeOrigin: true,
                secure: false,
                logLevel: 'debug'
            }
        }
    }
};
