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

  it('shows the OSM version switch inside the mapper box and reports clicks', () => {
    const onLayersVersionChange = jest.fn();
    renderPanel({
      showLayersVersionSwitch: true,
      layersVersion: 'v2',
      onLayersVersionChange,
    });
    const box = screen.getByText('Modo mapeador').closest('[data-mapper-box]');
    expect(box).toContainElement(screen.getByRole('button', { name: 'v1' }));
    fireEvent.click(screen.getByRole('button', { name: 'v1' }));
    expect(onLayersVersionChange).toHaveBeenCalledWith('v1');
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

  it('groups onlyDebug layers in the mapper box above the regular layers', () => {
    renderPanel({
      layers: [...layers, way('Diff v1→v2', true, { onlyDebug: true, description: 'diff' })],
    });
    expect(screen.getByText('Ciclovia')).toBeInTheDocument();
    const box = screen.getByText('Modo mapeador').closest('[data-mapper-box]');
    expect(box).toBeTruthy();
    expect(box).toHaveTextContent('Diff v1→v2');
    expect(box).not.toHaveTextContent('Ciclovia');
    const panel = document.getElementById('layersPanel');
    expect(panel.firstElementChild).toBe(box);
  });

  it('collapses pairing layers into one Pareamento row with extra views in the hover popover', async () => {
    const pairing = [
      way('Lado A', false, {
        id: 'lado-a',
        onlyDebug: true,
        mapperGroup: 'pairing',
        mapperGroupSection: 'sides',
        mapperGroupDefault: true,
        style: { lineColor: '#0B54FE', lineStyle: 'solid' },
      }),
      way('Lado B', false, {
        id: 'lado-b',
        onlyDebug: true,
        mapperGroup: 'pairing',
        mapperGroupSection: 'sides',
        mapperGroupDefault: true,
        style: { lineColor: '#FC0FC0', lineStyle: 'solid' },
      }),
      way('Não pareados', false, {
        id: 'nao-pareados',
        onlyDebug: true,
      }),
    ];
    const { onLayersChange } = renderPanel({
      layers: [
        ...layers,
        way('Diff v1→v2', true, { id: 'diff-v1v2', onlyDebug: true }),
        ...pairing,
      ],
    });

    const box = screen.getByText('Modo mapeador').closest('[data-mapper-box]');
    expect(box).toHaveTextContent('Pareamento');
    expect(screen.getByRole('button', { name: 'Pareamento' })).toBeInTheDocument();
    expect(box).toHaveTextContent('Diff v1→v2');
    expect(box).toHaveTextContent('Não pareados');
    expect(screen.queryByText('Lado A')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Pareamento'));
    expect(onLayersChange).toHaveBeenCalledWith([
      { id: 'lado-a', isActive: true },
      { id: 'lado-b', isActive: true },
    ]);

    fireEvent.mouseEnter(screen.getByText('Pareamento'));
    expect(await screen.findByText('Lado A')).toBeInTheDocument();
    expect(screen.getByText('Pareados')).toBeInTheDocument();
    expect(screen.queryByText('Outros')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Não pareados', { selector: '.font-semibold' }));
    expect(onLayersChange).toHaveBeenCalledWith('nao-pareados', true);
  });

  it('collapses Cuiabá hall layers into one row with views in the hover popover', async () => {
    renderPanel({
      layers: [
        ...layers,
        way('Prefeitura 2024', true, {
          id: 'prefeitura-2024',
          onlyDebug: true,
          mapperGroup: 'cuiaba-hall',
          mapperGroupSection: 'views',
          mapperGroupDefault: true,
          style: { lineColor: '#16A34A', lineStyle: 'solid' },
        }),
        way('OSM fora da lista', true, {
          id: 'osm-fora-da-lista',
          onlyDebug: true,
          mapperGroup: 'cuiaba-hall',
          mapperGroupSection: 'views',
          mapperGroupDefault: true,
          style: { lineColor: '#E11D48', lineStyle: 'dashed' },
        }),
      ],
    });

    const box = screen.getByText('Modo mapeador').closest('[data-mapper-box]');
    expect(box).toHaveTextContent('Cuiabá 2024');
    expect(screen.getByRole('button', { name: 'Cuiabá 2024' })).toBeInTheDocument();
    expect(screen.queryByText('Prefeitura 2024')).not.toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByText('Cuiabá 2024'));
    expect(await screen.findByText('Prefeitura 2024')).toBeInTheDocument();
    expect(screen.getByText('Visualização')).toBeInTheDocument();
    expect(screen.getByText('OSM fora da lista')).toBeInTheDocument();
  });

  it('toggleMobileCollapse flips collapsed state', () => {
    const ref = React.createRef();
    render(<LayersPanel ref={ref} layers={layers} onLayersChange={() => {}} />);
    expect(ref.current.state.collapsed).toBe(false);
    act(() => ref.current.toggleMobileCollapse());
    expect(ref.current.state.collapsed).toBe(true);
  });
});
