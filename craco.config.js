const CracoLessPlugin = require('craco-less');
const { getThemeVariables } = require('antd/dist/theme');

module.exports = {
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
            }
        }
    }
};
