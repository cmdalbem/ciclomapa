import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { DirectionsProvider } from './contexts/DirectionsContext';
import DirectionsPanel from './DirectionsPanel.js';

jest.mock('mapbox-gl', () => ({ default: {} }));
jest.mock('./googlePlacesClient.js', () => {
  const actual = jest.requireActual('./googlePlacesClient.js');
  return {
    getCityFromResultLike: actual.getCityFromResultLike,
    getAreaStringFromResultLike: actual.getAreaStringFromResultLike,
    getGooglePlacesGeocoder: jest.fn().mockReturnValue({
      search: jest.fn(),
      getPlaceDetails: jest.fn(),
      reverseGeocode: jest.fn(),
      loadGoogleMapsAPI: jest.fn(),
    }),
    ensureGooglePlacesReady: jest.fn().mockResolvedValue(undefined),
    getPlacesSearchUserMessage: actual.getPlacesSearchUserMessage,
    resetPlacesAutocompleteSession: jest.fn(),
  };
});

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

it('shows legend link in panel header', () => {
  render(
    <DirectionsProvider>
      <DirectionsPanel {...defaultProps} />
    </DirectionsProvider>
  );
  expect(screen.getByTestId('directions-panel-legend-link')).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: /como interpretar o mapa e as rotas/i })
  ).toBeInTheDocument();
});

it('keeps extra route options behind Ajustes', () => {
  render(
    <DirectionsProvider>
      <DirectionsPanel {...defaultProps} />
    </DirectionsProvider>
  );

  expect(screen.getByRole('button', { name: 'Priorizar na rota' })).toHaveTextContent(
    'Mais protegida'
  );
  expect(screen.getByRole('button', { name: 'Ajustes da rota' })).toBeInTheDocument();
  expect(screen.queryByText('Qualquer terreno')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Permitir subidas' })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Ajustes da rota' }));

  expect(screen.getByRole('button', { name: 'Priorizar na rota' })).toHaveTextContent(
    'Mais protegida'
  );
  expect(screen.getByRole('button', { name: 'Qualquer terreno' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Permitir subidas' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Permitir subidas' }));
  fireEvent.click(screen.getByRole('button', { name: 'Evitar ruído' }));
  fireEvent.click(screen.getByRole('button', { name: 'Ocultar ajustes' }));

  expect(screen.queryByRole('button', { name: 'Permitir subidas' })).not.toBeInTheDocument();
  const ajustes = screen.getByRole('button', { name: 'Ajustes da rota, 2 ativos' });
  expect(ajustes).toBeInTheDocument();
  expect(ajustes).toHaveTextContent('2');
});
