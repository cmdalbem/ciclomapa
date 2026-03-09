import React from 'react';
import { render, screen } from '@testing-library/react';
import { DirectionsProvider } from './contexts/DirectionsContext';
import DirectionsPanel from './DirectionsPanel.js';

jest.mock('mapbox-gl', () => ({ default: {} }));
jest.mock('./GooglePlacesGeocoder.js', () => ({
  __esModule: true,
  default: class GooglePlacesGeocoder {},
}));

const noop = () => {};

const defaultProps = {
  embedMode: false,
  map: null,
  geoJson: null,
  layers: [],
  area: 'Fortaleza, Ceará, Brasil',
  fromPoint: null,
  toPoint: null,
  onFromPointChange: noop,
  onToPointChange: noop,
  onClearRoutePoints: noop,
  onDirectionsPanelToggle: noop,
  isDarkMode: false,
  debugMode: false,
  onAreaChange: noop,
  openLayersLegendModal: noop,
};

it('renders DirectionsPanel with DirectionsProvider and shows key UI', () => {
  render(
    <DirectionsProvider>
      <DirectionsPanel {...defaultProps} />
    </DirectionsProvider>
  );
  // Panel header "Rotas" or search inputs (Origem/Destino)
  const rotas = screen.queryByText(/Rotas/);
  const origemPlaceholder =
    document.querySelector('input[placeholder="Origem"]') ||
    document.querySelector('input[placeholder*="rigem"]');
  const destinoPlaceholder =
    document.querySelector('input[placeholder="Destino"]') ||
    document.querySelector('input[placeholder*="estino"]');
  expect(rotas || origemPlaceholder || destinoPlaceholder).toBeTruthy();
});
