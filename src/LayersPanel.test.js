import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';

import LayersPanel from './LayersPanel.js';

const way = (name, isActive, extra = {}) => ({
  id: name.toLowerCase().replace(/\s/g, '-'),
  name,
  type: 'way',
  isActive,
  description: `${name} desc`,
  style: { lineColor: '#0f0', lineStyle: 'solid' },
  ...extra,
});

const layers = [
  way('Ciclovia', true, { protectionLevel: 'Alta' }),
  way('Ciclofaixa', false, {
    displayName: 'Ciclofaixa!',
    style: { lineColor: '#f00', lineStyle: 'dashed' },
  }),
  way('Baixa velocidade', true),
  way('Trilha', true, { isAvailable: false }),
  {
    id: 'bicicletarios',
    name: 'Bicicletários',
    type: 'poi',
    icon: 'poi-bikeparking',
    isActive: true,
    description: 'p',
  },
];

function renderPanel(props = {}) {
  const onLayersChange = jest.fn();
  const openLayersLegendModal = jest.fn();
  const utils = render(
    <LayersPanel
      layers={layers}
      onLayersChange={onLayersChange}
      openLayersLegendModal={openLayersLegendModal}
      {...props}
    />
  );
  return { ...utils, onLayersChange, openLayersLegendModal };
}

describe('LayersPanel (desktop)', () => {
  it('renders nothing without layers', () => {
    const { container } = render(<LayersPanel layers={null} onLayersChange={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('lists every available layer, dimming inactive ones, and hides unavailable ones', () => {
    renderPanel();
    expect(screen.getByText('Ciclovia')).toBeInTheDocument();
    expect(screen.getByText('Ciclofaixa!')).toBeInTheDocument();
    expect(screen.getByText('Baixa velocidade')).toBeInTheDocument();
    expect(screen.getByText('Bicicletários')).toBeInTheDocument();
    expect(screen.queryByText('Trilha')).not.toBeInTheDocument();

    const row = (text) => screen.getByText(text).closest('[style*="opacity"]');
    expect(row('Ciclovia')).toHaveStyle({ opacity: 1 });
    expect(row('Ciclofaixa!')).toHaveStyle({ opacity: 0.5 });
  });

  it('clicking a row toggles it', () => {
    const { onLayersChange } = renderPanel();
    fireEvent.click(screen.getByText('Ciclovia'));
    expect(onLayersChange).toHaveBeenCalledWith('ciclovia', false);
    fireEvent.click(screen.getByText('Ciclofaixa!'));
    expect(onLayersChange).toHaveBeenCalledWith('ciclofaixa', true);
  });

  it('embed mode shows only active layers and blocks interaction', () => {
    renderPanel({ embedMode: true });
    expect(screen.getByText('Ciclovia')).toBeInTheDocument();
    expect(screen.queryByText('Ciclofaixa!')).not.toBeInTheDocument();
    expect(document.getElementById('layersPanel').className).toContain('pointer-events-none');
  });

  it('hover popover shows the description, protection badge and "Leia mais" pointing at the legend section', async () => {
    const { openLayersLegendModal } = renderPanel();
    fireEvent.mouseEnter(screen.getByText('Ciclovia'));
    expect(await screen.findByText('Ciclovia desc')).toBeInTheDocument();
    expect(screen.getByText(/Alta proteção/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('layers-panel-popover-full-legend'));
    expect(openLayersLegendModal).toHaveBeenCalledWith('vias-ciclaveis-section');
  });

  it('maps POI and "outras vias" layers to their legend sections', async () => {
    const { openLayersLegendModal } = renderPanel();
    fireEvent.mouseEnter(screen.getByText('Bicicletários'));
    fireEvent.click(await screen.findByTestId('layers-panel-popover-full-legend'));
    expect(openLayersLegendModal).toHaveBeenLastCalledWith('pontos-section');

    // The popover title repeats the layer name, so target the row span.
    fireEvent.mouseLeave(screen.getByText('Bicicletários', { selector: '.font-semibold' }));
    fireEvent.mouseEnter(screen.getByText('Baixa velocidade', { selector: '.font-semibold' }));
    await screen.findByText('Baixa velocidade desc');
    const buttons = screen.getAllByTestId('layers-panel-popover-full-legend');
    fireEvent.click(buttons[buttons.length - 1]);
    expect(openLayersLegendModal).toHaveBeenLastCalledWith('outras-vias-section');
  });

  it('omits "Leia mais" in embed mode or without a legend handler', async () => {
    renderPanel({ embedMode: true, openLayersLegendModal: undefined });
    fireEvent.mouseEnter(screen.getByText('Ciclovia'));
    await screen.findByText('Ciclovia desc');
    expect(screen.queryByTestId('layers-panel-popover-full-legend')).not.toBeInTheDocument();
  });

  it('toggleMobileCollapse flips collapsed state', () => {
    const ref = React.createRef();
    render(<LayersPanel ref={ref} layers={layers} onLayersChange={() => {}} />);
    expect(ref.current.state.collapsed).toBe(false);
    act(() => ref.current.toggleMobileCollapse());
    expect(ref.current.state.collapsed).toBe(true);
  });
});
