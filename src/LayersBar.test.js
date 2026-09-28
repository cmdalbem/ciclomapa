import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';

import LayersBar from './LayersBar.js';

// LayersBar is mobile-only.
jest.mock('./config/constants.js', () => {
  const actual = jest.requireActual('./config/constants.js');
  return { ...actual, IS_MOBILE: true };
});

const way = (name, isActive, extra = {}) => ({
  id: name.toLowerCase().replace(/\s/g, '-'),
  name,
  type: 'way',
  isActive,
  style: { lineColor: '#0f0', lineStyle: 'solid' },
  ...extra,
});
const poi = (name, icon, isActive, extra = {}) => ({
  id: name.toLowerCase(),
  name,
  type: 'poi',
  icon,
  isActive,
  ...extra,
});

const layers = () => [
  way('Ciclovia', true),
  way('Ciclofaixa', true, { shortName: 'Faixa' }),
  way('Ciclorrota', false),
  way('Calçada compartilhada', false),
  way('Baixa velocidade', true), // never shown on mobile
  way('Trilha', true, { isAvailable: false }),
  way('DEBUG - Inclusas', true, { onlyDebug: true }),
  poi('Bicicletários', 'poi-bikeparking', true),
  poi('Lojas', 'poi-bikeshop', false, { isAvailable: false }),
  poi('Estações', 'poi-rental', false),
];

function renderBar(props = {}) {
  const onLayersChange = jest.fn();
  const openLayersLegendModal = jest.fn();
  const utils = render(
    <LayersBar
      layers={layers()}
      onLayersChange={onLayersChange}
      openLayersLegendModal={openLayersLegendModal}
      isDarkMode={false}
      {...props}
    />
  );
  return { ...utils, onLayersChange, openLayersLegendModal };
}

describe('LayersBar', () => {
  it('renders nothing in embed mode or without layers', () => {
    const { container, rerender } = renderBar({ embedMode: true });
    expect(container).toBeEmptyDOMElement();
    rerender(
      <LayersBar layers={null} onLayersChange={() => {}} openLayersLegendModal={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows cycleway and POI pills, skipping unavailable, debug and "outras vias" layers', () => {
    renderBar();
    expect(screen.getByRole('button', { name: 'Ciclovia' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Faixa' })).toBeInTheDocument(); // shortName wins
    expect(screen.getByRole('button', { name: 'Ciclorrota' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bicicletários' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Estações' })).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: 'Trilha' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Lojas' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Baixa velocidade' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /DEBUG/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Vias cicláveis' })).not.toBeInTheDocument();
  });

  it('toggles a single layer and reports the new state', () => {
    const { onLayersChange } = renderBar();
    fireEvent.click(screen.getByRole('button', { name: 'Ciclovia' }));
    expect(onLayersChange).toHaveBeenCalledWith('ciclovia', false);
    fireEvent.click(screen.getByRole('button', { name: 'Ciclorrota' }));
    expect(onLayersChange).toHaveBeenCalledWith('ciclorrota', true);
  });

  it('opens the legend', () => {
    const { openLayersLegendModal } = renderBar();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir legenda do mapa' }));
    expect(openLayersLegendModal).toHaveBeenCalledTimes(1);
  });

  it('collapses a category into one pill when all its layers are off, and expanding re-activates them', () => {
    jest.useFakeTimers();
    const all = layers().map((l) => ({ ...l, isActive: false }));
    const { onLayersChange } = renderBar({ layers: all });

    expect(screen.queryByRole('button', { name: 'Ciclovia' })).not.toBeInTheDocument();
    const cicloways = screen.getByRole('button', { name: 'Vias cicláveis' });
    const pontos = screen.getByRole('button', { name: 'Pontos de interesse' });

    fireEvent.click(cicloways);
    // Layer pills appear right away (expanded state), activation is delayed for the animation.
    expect(screen.getByRole('button', { name: 'Ciclovia' })).toBeInTheDocument();
    expect(onLayersChange).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(300));
    expect(onLayersChange).toHaveBeenCalledWith([
      { id: 'ciclovia', isActive: true },
      { id: 'ciclofaixa', isActive: true },
      { id: 'ciclorrota', isActive: true },
      { id: 'calçada-compartilhada', isActive: true },
    ]);

    fireEvent.click(pontos);
    act(() => jest.advanceTimersByTime(300));
    expect(onLayersChange).toHaveBeenLastCalledWith([
      { id: 'bicicletários', isActive: true },
      { id: 'estações', isActive: true },
    ]);
    act(() => jest.advanceTimersByTime(500));
    jest.useRealTimers();
  });

  it('collapses the category again after the last layer is turned off', () => {
    jest.useFakeTimers();
    const only = [way('Ciclovia', true), way('Ciclofaixa', false)];
    const { onLayersChange, rerender } = renderBar({ layers: only });

    fireEvent.click(screen.getByRole('button', { name: 'Ciclovia' }));
    expect(onLayersChange).toHaveBeenCalledWith('ciclovia', false);
    // Parent applies the change.
    rerender(
      <LayersBar
        layers={only.map((l) => ({ ...l, isActive: false }))}
        onLayersChange={onLayersChange}
        openLayersLegendModal={() => {}}
      />
    );
    act(() => jest.advanceTimersByTime(10));
    expect(screen.getByRole('button', { name: 'Vias cicláveis' })).toBeInTheDocument();
    act(() => jest.advanceTimersByTime(3500));
    jest.useRealTimers();
  });

  it('toggleCategory flips every layer of a category at once', () => {
    const { onLayersChange } = renderBar();
    const ref = React.createRef();
    render(
      <LayersBar
        ref={ref}
        layers={layers()}
        onLayersChange={onLayersChange}
        openLayersLegendModal={() => {}}
      />
    );
    ref.current.toggleCategory('pontos');
    expect(onLayersChange).toHaveBeenLastCalledWith([
      { id: 'bicicletários', isActive: false },
      { id: 'estações', isActive: false },
    ]);
    expect(ref.current.isCategoryActive('pontos')).toBe(true);
    expect(ref.current.getPOIIcon('poi-bikeshop', true)).toBe('test-file-stub');
    expect(ref.current.getPOIIcon('unknown', true)).toBeNull();
    expect(ref.current.renderLineStyle(null)).toEqual({});
    expect(
      ref.current.renderLineStyle({ lineStyle: 'dashed', lineColor: '#abc' }).background
    ).toContain('repeating-linear-gradient');
  });
});
