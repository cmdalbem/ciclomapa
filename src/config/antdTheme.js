import { theme } from 'antd';

const { defaultAlgorithm, darkAlgorithm } = theme;

/** Matches legacy CicloMapa branding; dark tokens align with former antd.dark.less base. */
const BRAND_TOKEN = {
  colorPrimary: 'black',
  colorLink: 'black',
  colorLinkHover: '#444444',
  borderRadius: 8,
  fontFamily: "'IBM Plex Sans', sans-serif",
};

const DARK_EXTRA = {
  // colorPrimary: '#b6f9d1',
  // colorPrimary: '#4ea76f',
  colorPrimary: 'white',
  // colorPrimaryText: 'black',
  // `Button[type="primary"]` uses the "light solid" text token for its label.
  // When `colorPrimary` is white, the default label also becomes white unless
  // we explicitly override this token.
  colorTextLightSolid: 'black',
  colorTextLightSolidHover: 'black',
  colorTextLightSolidActive: 'black',
  colorLink: 'white',
  colorLinkHover: '#aaaaaa',
  // colorText: 'white',
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
