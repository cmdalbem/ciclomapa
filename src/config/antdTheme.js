import { theme } from 'antd';

const { defaultAlgorithm, darkAlgorithm } = theme;

/** Matches legacy CicloMapa branding; dark tokens align with former antd.dark.less base. */
const BRAND_TOKEN = {
  colorPrimary: 'black',
  colorLink: 'black',
  colorLinkHover: '#444444',
  borderRadius: 8,
  fontFamily: "'Inter', system-ui, sans-serif",
};

const LIGHT_EXTRA = {
  // Black `colorPrimary` makes antd's generated primary-bg scale charcoal
  // (#404040). Selected dropdown rows then look like a dark-mode chip on a
  // light menu. Keep filled primary buttons black; use a light wash for
  // primary-container and selected-item backgrounds.
  colorPrimaryBg: 'rgba(0, 0, 0, 0.04)',
  colorPrimaryBgHover: 'rgba(0, 0, 0, 0.08)',
  controlItemBgActive: 'rgba(0, 0, 0, 0.06)',
  controlItemBgActiveHover: 'rgba(0, 0, 0, 0.1)',
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
      ...(isDarkMode ? DARK_EXTRA : LIGHT_EXTRA),
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
