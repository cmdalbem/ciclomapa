import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AboutModal from './AboutModal.js';

const noop = () => {};

function renderAbout(ui) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

it('renders when visible and exposes primary actions', () => {
  renderAbout(
    <AboutModal visible={true} onClose={noop} openLayersLegendModal={noop} openCityPicker={noop} />
  );
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.getByTestId('about-modal-title')).toBeInTheDocument();
  expect(screen.getByTestId('about-modal-dismiss')).toBeInTheDocument();
  expect(screen.getByTestId('about-modal-open-legend')).toBeInTheDocument();
  expect(screen.getByTestId('about-modal-open-city-picker')).toBeInTheDocument();
});

it('Ver cidades calls openCityPicker', async () => {
  const user = userEvent.setup();
  const openCityPicker = jest.fn();
  renderAbout(
    <AboutModal
      visible={true}
      onClose={noop}
      openLayersLegendModal={noop}
      openCityPicker={openCityPicker}
    />
  );
  await user.click(screen.getByTestId('about-modal-open-city-picker'));
  expect(openCityPicker).toHaveBeenCalledTimes(1);
});

it('hides Ver cidades in embed mode', () => {
  renderAbout(
    <AboutModal
      visible={true}
      onClose={noop}
      openLayersLegendModal={noop}
      openCityPicker={noop}
      embedMode
    />
  );
  expect(screen.queryByTestId('about-modal-open-city-picker')).not.toBeInTheDocument();
});

it('close button calls onClose when clicked', async () => {
  const user = userEvent.setup();
  const onClose = jest.fn();
  renderAbout(
    <AboutModal
      visible={true}
      onClose={onClose}
      openLayersLegendModal={noop}
      openCityPicker={noop}
    />
  );
  await user.click(screen.getByTestId('about-modal-dismiss'));
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('shows metric skeletons while mapDataLoading', () => {
  const layers = [
    { id: 'ciclovia', name: 'Ciclovia', shortName: 'Ciclovia', type: 'way' },
    { id: 'ciclofaixa', name: 'Ciclofaixa', shortName: 'Ciclofaixa', type: 'way' },
    { id: 'ciclorrota', name: 'Ciclorrota', shortName: 'Ciclorrota', type: 'way' },
    {
      id: 'calcada-compartilhada',
      name: 'Calçada compartilhada',
      shortName: 'Calçada',
      type: 'way',
    },
    { id: 'lojas-and-oficinas', name: 'Lojas & oficinas', shortName: 'Lojas', type: 'poi' },
  ];
  renderAbout(
    <AboutModal
      visible={true}
      onClose={noop}
      openLayersLegendModal={noop}
      openCityPicker={noop}
      cityCanonicalSlug="sao-paulo"
      layers={layers}
      lengths={{}}
      mapDataLoading={true}
    />
  );
  expect(screen.getAllByTestId('about-modal-metric-skeleton')).toHaveLength(3);
  expect(screen.getByTestId('about-quick-ciclovia')).not.toHaveAttribute('data-metric-km');
});

it('shows metric skeletons when geoJson is not in app state yet (loading flag can be false)', () => {
  const layers = [
    { id: 'ciclovia', name: 'Ciclovia', shortName: 'Ciclovia', type: 'way' },
    { id: 'ciclofaixa', name: 'Ciclofaixa', shortName: 'Ciclofaixa', type: 'way' },
    { id: 'ciclorrota', name: 'Ciclorrota', shortName: 'Ciclorrota', type: 'way' },
    {
      id: 'calcada-compartilhada',
      name: 'Calçada compartilhada',
      shortName: 'Calçada',
      type: 'way',
    },
    { id: 'lojas-and-oficinas', name: 'Lojas & oficinas', shortName: 'Lojas', type: 'poi' },
  ];
  renderAbout(
    <AboutModal
      visible={true}
      onClose={noop}
      openLayersLegendModal={noop}
      openCityPicker={noop}
      cityCanonicalSlug="sao-paulo"
      layers={layers}
      lengths={{}}
      mapDataLoading={false}
      mapHasGeoJson={false}
    />
  );
  expect(screen.getAllByTestId('about-modal-metric-skeleton')).toHaveLength(3);
});

it('shows city contextual block when cityCanonicalSlug is a known catalog slug', () => {
  const layers = [
    { id: 'ciclovia', name: 'Ciclovia', shortName: 'Ciclovia', type: 'way' },
    { id: 'ciclofaixa', name: 'Ciclofaixa', shortName: 'Ciclofaixa', type: 'way' },
    { id: 'ciclorrota', name: 'Ciclorrota', shortName: 'Ciclorrota', type: 'way' },
    {
      id: 'calcada-compartilhada',
      name: 'Calçada compartilhada',
      shortName: 'Calçada',
      type: 'way',
    },
    { id: 'lojas-and-oficinas', name: 'Lojas & oficinas', shortName: 'Lojas', type: 'poi' },
  ];
  const lengths = {
    ciclovia: 8,
    ciclofaixa: 2,
    ciclorrota: 0,
    'calcada-compartilhada': 1,
    'lojas-and-oficinas': 3,
  };
  renderAbout(
    <AboutModal
      visible={true}
      onClose={noop}
      openLayersLegendModal={noop}
      openCityPicker={noop}
      cityCanonicalSlug="sao-paulo"
      layers={layers}
      lengths={lengths}
      mapDataLoading={false}
      mapHasGeoJson
    />
  );
  expect(screen.getByTestId('about-modal-title')).toHaveAttribute(
    'data-about-city-slug',
    'sao-paulo'
  );
  expect(screen.getByTestId('about-modal-quick-stats')).toBeInTheDocument();
  expect(screen.getByTestId('about-quick-ciclovia')).toHaveAttribute('data-metric-km', '8');
  expect(screen.getByTestId('about-quick-ciclofaixa')).toHaveAttribute('data-metric-km', '2');
  expect(screen.getByTestId('about-quick-poi')).toHaveAttribute('data-poi-count', '3');
});

it.skip('shows PNB in summary when Airtable fields include pnb_total (re-enable when PNB badge is visible again)', () => {
  const layers = [
    { id: 'ciclovia', name: 'Ciclovia', shortName: 'Ciclovia', type: 'way' },
    { id: 'ciclofaixa', name: 'Ciclofaixa', shortName: 'Ciclofaixa', type: 'way' },
    { id: 'ciclorrota', name: 'Ciclorrota', shortName: 'Ciclorrota', type: 'way' },
    {
      id: 'calcada-compartilhada',
      name: 'Calçada compartilhada',
      shortName: 'Calçada',
      type: 'way',
    },
    { id: 'lojas-and-oficinas', name: 'Lojas & oficinas', shortName: 'Lojas', type: 'poi' },
  ];
  renderAbout(
    <AboutModal
      visible={true}
      onClose={noop}
      openLayersLegendModal={noop}
      openCityPicker={noop}
      cityCanonicalSlug="sao-paulo"
      layers={layers}
      lengths={{ ciclovia: 1, ciclofaixa: 0, ciclorrota: 0, 'calcada-compartilhada': 0 }}
      mapDataLoading={false}
    />
  );
  expect(screen.getByRole('link', { name: /PNB/ })).toBeInTheDocument();
  expect(screen.getAllByText(/18%/).length).toBeGreaterThanOrEqual(1);
});
