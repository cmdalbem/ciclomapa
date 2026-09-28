import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

import AppLayout from './AppLayout.js';

jest.mock('./Map.js', () => () => <div data-testid="map" />);
jest.mock('./TopBar.js', () => (props) => (
  <div data-testid="topbar">{props.title || 'no-area'}</div>
));
jest.mock('./LayersBar.js', () => () => <div data-testid="layers-bar" />);
jest.mock('./LayersPanel.js', () => () => <div data-testid="layers-panel" />);
jest.mock(
  './AboutModal.js',
  () => (props) => (props.visible ? <div data-testid="about-modal" /> : null)
);
jest.mock(
  './PrivacyPolicy.jsx',
  () => (props) => (props.visible ? <div data-testid="privacy-modal" /> : null)
);
jest.mock('./AnalyticsSidebar.js', () => () => <div data-testid="analytics" />);
jest.mock('./DirectionsPanel.js', () => () => <div data-testid="directions" />);
jest.mock('./CitySwitcherModal', () => () => <div data-testid="city-switcher" />);
jest.mock(
  './LayersLegendModal.js',
  () => (props) => (props.visible ? <div data-testid="legend-modal" /> : null)
);
jest.mock('./dev/ApiDebugOverlay.jsx', () => () => <div data-testid="debug-overlay" />);

jest.mock('./config/constants.js', () => {
  const actual = jest.requireActual('./config/constants.js');
  return { ...actual, IS_MOBILE: false, IS_PROD: true, ENABLE_SATELLITE_TOGGLE: false };
});

const handlers = {
  getMapViewport: jest.fn(() => ({ lat: -30.03, lng: -51.23, zoom: 12 })),
  toggleSidebar: jest.fn(),
  openAboutModal: jest.fn(),
  toggleTheme: jest.fn(),
  toggleDirectionsPanel: jest.fn(),
  triggerGeolocate: jest.fn(),
  setMapComponentRef: jest.fn(),
  onMapMoved: jest.fn(),
  onMapPositionChange: jest.fn(),
  needsCityGeoJsonContext: jest.fn(() => false),
  updateLengths: jest.fn(),
  setMapRef: jest.fn(),
  onTrackingUserLocationChange: jest.fn(),
  clearGlobalSearchPin: jest.fn(),
  handleFavoritesChanged: jest.fn(),
  onChangeStrategy: jest.fn(),
  downloadData: jest.fn(),
  forceUpdate: jest.fn(),
  cancelDataLoad: jest.fn(),
  openCityPicker: jest.fn(),
  handleGlobalSearchPlaceSelect: jest.fn(),
  onLayersChange: jest.fn(),
  openLayersLegendModal: jest.fn(),
  setDirectionsPanelRef: jest.fn(),
  setFromPoint: jest.fn(),
  setToPoint: jest.fn(),
  clearRoutePoints: jest.fn(),
  onDirectionsPanelToggle: jest.fn(),
  setArea: jest.fn(),
  closeAboutModal: jest.fn(),
  closeLayersLegendModal: jest.fn(),
  openPrivacyPolicyModal: jest.fn(),
  closePrivacyPolicyModal: jest.fn(),
};

const baseState = {
  hideUI: false,
  hideUIFromUrl: false,
  isSidebarOpen: false,
  area: 'Porto Alegre, Rio Grande do Sul, Brasil',
  lat: -30,
  lng: -51,
  zoom: 12,
  embedMode: false,
  debugMode: false,
  isDarkMode: false,
  mapBootReady: true,
  mapKey: 0,
  geoJson: null,
  layers: [],
  mapStyle: 'dark',
  showSatellite: true,
  toPoint: null,
  fromPoint: null,
  isTrackingUserLocation: false,
  globalSearchPin: null,
  favorites: [],
  cleanMode: false,
  lengths: {},
  airtableCityFields: null,
  lengthCalculationStrategy: 'average',
  dataUpdatedAt: null,
  loading: false,
  map: null,
  aboutModal: false,
  privacyPolicyModal: false,
  layersLegendModal: false,
  layersLegendScrollToSection: null,
};

function renderLayout(state = {}, extra = {}) {
  return render(
    <AppLayout
      state={{ ...baseState, ...state }}
      handlers={handlers}
      seoPageTitle="Porto Alegre — CicloMapa"
      cityCanonicalSlug="porto-alegre"
      {...extra}
    />
  );
}

describe('AppLayout', () => {
  it('renders the map once boot is ready and wires hideUI / sidebar classes', async () => {
    const { rerender } = renderLayout();
    expect(screen.getByRole('heading', { name: 'Porto Alegre — CicloMapa' })).toHaveClass(
      'sr-only'
    );
    expect(screen.getByTestId('map')).toBeInTheDocument();
    expect(screen.getByTestId('topbar')).toHaveTextContent('Porto Alegre');
    expect(await screen.findByTestId('city-switcher')).toBeInTheDocument();
    expect(screen.getByTestId('directions')).toBeInTheDocument();
    expect(document.getElementById('ciclomapa').className).toBe('');

    rerender(
      <AppLayout
        state={{ ...baseState, hideUI: true, isSidebarOpen: true, mapBootReady: false }}
        handlers={handlers}
        seoPageTitle="x"
      />
    );
    expect(screen.queryByTestId('map')).not.toBeInTheDocument();
    expect(document.getElementById('ciclomapa')).toHaveClass('hideUI');
    expect(document.getElementById('ciclomapa')).toHaveClass('analyticsSidebarOpen');
  });

  it('shows Analytics on desktop when not embed, and drops it in embed mode with no directions', async () => {
    const { rerender } = renderLayout({ isSidebarOpen: true });
    expect(await screen.findByTestId('analytics')).toBeInTheDocument();
    expect(document.querySelector('.analytics-sidebar-overlay--open')).toBeTruthy();

    rerender(
      <AppLayout
        state={{ ...baseState, embedMode: true, isSidebarOpen: true }}
        handlers={handlers}
        seoPageTitle="x"
      />
    );
    await waitFor(() => expect(screen.queryByTestId('directions')).not.toBeInTheDocument());
    expect(screen.queryByTestId('analytics')).not.toBeInTheDocument();
  });

  it('falls back to state lat/lng when getMapViewport is missing', async () => {
    render(
      <AppLayout
        state={baseState}
        handlers={{ ...handlers, getMapViewport: undefined }}
        seoPageTitle="x"
      />
    );
    expect(await screen.findByTestId('city-switcher')).toBeInTheDocument();
  });

  it('opens About, legend and privacy when their flags are on', () => {
    renderLayout({
      aboutModal: true,
      layersLegendModal: true,
      privacyPolicyModal: true,
    });
    expect(screen.getByTestId('about-modal')).toBeInTheDocument();
    expect(screen.getByTestId('privacy-modal')).toBeInTheDocument();
  });

  it('only mounts the debug overlay in production when debugMode is on', async () => {
    const { rerender } = renderLayout({ debugMode: false });
    await waitFor(() => expect(screen.queryByTestId('debug-overlay')).not.toBeInTheDocument());
    rerender(
      <AppLayout state={{ ...baseState, debugMode: true }} handlers={handlers} seoPageTitle="x" />
    );
    expect(await screen.findByTestId('debug-overlay')).toBeInTheDocument();
  });
});
