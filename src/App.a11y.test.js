import React from 'react';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { BrowserRouter as Router } from 'react-router-dom';
import { DirectionsProvider } from './contexts/DirectionsContext';
import AboutModal from './AboutModal.js';
import LayersLegendModal from './LayersLegendModal.js';

expect.extend(toHaveNoViolations);

const noop = () => {};

// Meaningful tree that avoids map/Firebase: layout-like structure with heading and button
function MinimalAccessibleTree() {
  return (
    <div>
      <h1>CicloMapa</h1>
      <button type="button">Abrir legenda</button>
    </div>
  );
}

it('has no critical a11y violations on minimal layout tree', async () => {
  const { container } = render(
    <Router>
      <DirectionsProvider>
        <MinimalAccessibleTree />
      </DirectionsProvider>
    </Router>
  );
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});

it('has no critical a11y violations when AboutModal is open', async () => {
  const { container } = render(
    <AboutModal visible={true} onClose={noop} openLayersLegendModal={noop} />
  );
  const dialog = screen.getByRole('dialog', { name: /sobre o ciclomapa/i });
  expect(dialog).toBeInTheDocument();
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});

it('AboutModal closes on Escape key', async () => {
  const onClose = jest.fn();
  const { rerender } = render(
    <AboutModal visible={false} onClose={onClose} openLayersLegendModal={noop} />
  );
  rerender(<AboutModal visible={true} onClose={onClose} openLayersLegendModal={noop} />);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

const minimalLayersForLegend = [
  { id: 'poi-1', name: 'Lojas', type: 'poi', description: 'Lojas e oficinas', onlyDebug: false },
  { id: 'way-1', name: 'Ciclovia', type: 'way', description: 'Ciclovia', onlyDebug: false },
];

it('has no critical a11y violations when LayersLegendModal is open', async () => {
  const { container } = render(
    <LayersLegendModal visible={true} onClose={noop} layers={minimalLayersForLegend} />
  );
  const dialog = screen.getByRole('dialog', { name: /legenda do mapa/i });
  expect(dialog).toBeInTheDocument();
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});

it('LayersLegendModal closes on Escape key', async () => {
  const onClose = jest.fn();
  const { rerender } = render(
    <LayersLegendModal visible={false} onClose={onClose} layers={minimalLayersForLegend} />
  );
  rerender(<LayersLegendModal visible={true} onClose={onClose} layers={minimalLayersForLegend} />);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

// DirectionsPanel uses Ant Design AutoComplete, which can report aria violations in jsdom
// (e.g. aria-expanded, aria-owns). Full a11y coverage for the panel is optional; see DirectionsPanel.test.js for render test.
