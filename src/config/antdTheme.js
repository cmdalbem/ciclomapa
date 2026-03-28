import { theme } from 'antd';

const { defaultAlgorithm, darkAlgorithm } = theme;

/** Matches legacy CicloMapa branding; dark tokens align with former antd.dark.less base. */
const BRAND_TOKEN = {
  colorPrimary: '#4ea76f',
  colorLink: '#ffffff',
  borderRadius: 8,
  fontFamily: "'IBM Plex Sans', sans-serif",
};

const DARK_EXTRA = {
  // colorPrimary: '#b6f9d1',
  colorLink: '#ffffff',
  // colorBgBase: '#141414',
  // colorBgContainer: '#141414',
  // colorBgElevated: '#262626',
};

/** @param {boolean} isDarkMode */
export function getAntdTheme(isDarkMode) {
  return {
    algorithm: isDarkMode ? darkAlgorithm : defaultAlgorithm,
    token: {
      ...BRAND_TOKEN,
      ...(isDarkMode ? DARK_EXTRA : {}),
    },
  };
}

/** Props spread onto ConfigProvider (theme, overlay defaults). */
export function getAntdConfigProviderProps(isDarkMode) {
  return {
    theme: getAntdTheme(isDarkMode),
    // Map-heavy UI: avoid fullscreen blur on every modal (antd v6 default).
    modal: { mask: { blur: false } },
    drawer: { mask: { blur: false } },
  };
}
