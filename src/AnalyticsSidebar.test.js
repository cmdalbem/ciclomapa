import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

import AnalyticsSidebar from './AnalyticsSidebar.js';
import { appModal } from './antdModal.js';

jest.mock('./antdModal.js', () => ({
  appModal: { confirm: jest.fn(), info: jest.fn(), error: jest.fn() },
}));

const infra = [
  {
    id: 'ciclovia',
    name: 'Ciclovia',
    shortName: 'Ciclovia',
    type: 'way',
    style: { lineStyle: 'solid', lineColor: '#0f0' },
  },
  {
    id: 'ciclofaixa',
    name: 'Ciclofaixa',
    shortName: 'Faixa',
    type: 'way',
    style: { lineStyle: 'dashed', lineColor: '#00f' },
  },
  {
    id: 'ciclorrota',
    name: 'Ciclorrota',
    shortName: 'Rota',
    type: 'way',
    style: { lineStyle: 'solid', lineColor: '#f00' },
  },
  {
    id: 'calcada-compartilhada',
    name: 'Calçada compartilhada',
    shortName: 'Calçada',
    type: 'way',
    style: { lineStyle: 'solid', lineColor: '#aaa' },
  },
];

const poi = {
  id: 'bicicletarios',
  name: 'Bicicletários',
  type: 'poi',
  style: {},
};

const lengths = {
  ciclovia: 10,
  ciclofaixa: 5,
  ciclorrota: 0,
  'calcada-compartilhada': 2,
  bicicletarios: 12,
};

const handlers = {
  toggle: jest.fn(),
  downloadData: jest.fn(),
  forceUpdate: jest.fn(),
  cancelDataLoad: jest.fn(),
  openCityPicker: jest.fn(),
  onChangeStrategy: jest.fn(),
};

function renderSidebar(props = {}) {
  Object.values(handlers).forEach((fn) => fn.mockClear?.());
  return render(
    <AnalyticsSidebar
      open
      toggle={handlers.toggle}
      downloadData={handlers.downloadData}
      forceUpdate={handlers.forceUpdate}
      cancelDataLoad={handlers.cancelDataLoad}
      openCityPicker={handlers.openCityPicker}
      onChangeStrategy={handlers.onChangeStrategy}
      location="Porto Alegre, Rio Grande do Sul, Brasil"
      layers={[...infra, poi]}
      lengths={lengths}
      lastUpdate={new Date(Date.now() - 60 * 60 * 1000)}
      {...props}
    />
  );
}

beforeEach(() => {
  localStorage.clear();
  appModal.confirm.mockReset();
});

describe('AnalyticsSidebar', () => {
  it('renders nothing without layers', () => {
    const { container } = render(<AnalyticsSidebar toggle={() => {}} layers={null} open />);
    expect(container).toBeEmptyDOMElement();
  });

  it('closes, switches city and downloads GeoJSON', async () => {
    renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar painel de métricas' }));
    expect(handlers.toggle).toHaveBeenCalledWith(false);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Trocar cidade. Cidade atual: Porto Alegre, Rio Grande do Sul, Brasil',
      })
    );
    expect(handlers.openCityPicker).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Mais opções' }));
    fireEvent.click(await screen.findByText('Baixar GeoJSON'));
    expect(handlers.downloadData).toHaveBeenCalledTimes(1);
  });

  it('shows km totals, POI counts and "Sem dados" when lengths are missing', () => {
    renderSidebar();
    expect(screen.getByText('TOTAL')).toBeInTheDocument();
    expect(screen.getByText(/17\.0/)).toBeInTheDocument();
    expect(screen.getByText('Bicicletários')).toBeInTheDocument();

    const { rerender } = renderSidebar({ lengths: null });
    rerender(
      <AnalyticsSidebar open toggle={handlers.toggle} layers={infra} lengths={null} location="X" />
    );
    expect(screen.getByText('Sem dados')).toBeInTheDocument();
  });

  it('PNB, IDECiclo and debug strategy select show when the data is there', async () => {
    renderSidebar({
      debugMode: true,
      lengthCalculationStrategy: 'average',
      cityMetadata: {
        pnb_total: 22,
        pnb_year: 2024,
        pnb_black_women: 10,
        pnb_women_less_one_salary: 8,
        pnb_2022: 18,
        pnb_2024: 22,
        ideciclo: 0.42,
        ideciclo_year: 2023,
      },
    });
    expect(screen.getByText('PNB')).toBeInTheDocument();
    expect(screen.getByText('22%')).toBeInTheDocument();
    expect(screen.getByText('Mulheres negras')).toBeInTheDocument();
    expect(screen.getByText('IDECiclo')).toBeInTheDocument();
    expect(screen.getByText('0.42')).toBeInTheDocument();
    expect(screen.getByLabelText('Estratégia de cálculo de extensão')).toBeInTheDocument();
  });

  it('loading footer can cancel; idle footer confirms a force update', async () => {
    const { rerender } = renderSidebar({ loading: true, lastUpdate: null });
    expect(screen.getByText(/Carregando dados desta cidade/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(handlers.cancelDataLoad).toHaveBeenCalledTimes(1);

    rerender(
      <AnalyticsSidebar
        open
        toggle={handlers.toggle}
        layers={infra}
        lengths={lengths}
        lastUpdate={new Date()}
        forceUpdate={handlers.forceUpdate}
        loading={false}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Atualizar/ }));
    expect(appModal.confirm).toHaveBeenCalledTimes(1);
    appModal.confirm.mock.calls[0][0].onOk();
    expect(handlers.forceUpdate).toHaveBeenCalledTimes(1);
  });

  it('toggling a via off drops it from the total and refuses to turn the last one off', async () => {
    renderSidebar();
    const ciclovia = screen.getByRole('button', {
      name: 'Alternar inclusão de Ciclovia no total de vias',
    });
    fireEvent.click(ciclovia);
    await waitFor(() => expect(screen.getByText(/7\.0/)).toBeInTheDocument());
    expect(JSON.parse(localStorage.getItem('analyticsViasLengthsInclude')).ciclovia).toBe(false);

    // Turn the other three off too — the last remaining must stay on.
    fireEvent.click(
      screen.getByRole('button', { name: 'Alternar inclusão de Ciclofaixa no total de vias' })
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Alternar inclusão de Ciclorrota no total de vias' })
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Alternar inclusão de Calçada compartilhada no total de vias',
      })
    );
    expect(JSON.parse(localStorage.getItem('analyticsViasLengthsInclude'))).toEqual(
      expect.objectContaining({
        ciclovia: false,
        ciclofaixa: false,
        ciclorrota: false,
        'calcada-compartilhada': true,
      })
    );
  });

  it('reads persisted include flags and opens the via popover with percentages', async () => {
    localStorage.setItem(
      'analyticsViasLengthsInclude',
      JSON.stringify({ ciclovia: true, ciclofaixa: false })
    );
    renderSidebar();
    expect(screen.getByText(/12\.0/)).toBeInTheDocument(); // 10 + 0 + 2, ciclofaixa excluded

    fireEvent.mouseEnter(
      screen.getByRole('button', { name: 'Alternar inclusão de Ciclovia no total de vias' })
    );
    expect(await screen.findByText('Incluir no total e no gráfico')).toBeInTheDocument();
    expect(screen.getByText('Pct. do mapeamento completo')).toBeInTheDocument();
  });

  it('ignores junk in localStorage and still renders', () => {
    localStorage.setItem('analyticsViasLengthsInclude', '{not json');
    renderSidebar();
    expect(screen.getByText('TOTAL')).toBeInTheDocument();
  });

  it('applies the open/closed class and dark-mode tooltip path on the PNB chart', () => {
    const { container, rerender } = renderSidebar({ open: false, isDarkMode: true });
    expect(container.querySelector('#analyticsSidebar')).toHaveClass('analytics-sidebar--closed');
    rerender(
      <AnalyticsSidebar
        open
        toggle={handlers.toggle}
        layers={infra}
        lengths={lengths}
        isDarkMode
        cityMetadata={{ pnb_total: 1, pnb_2020: 1, pnb_2024: 2 }}
      />
    );
    expect(container.querySelector('#analyticsSidebar')).toHaveClass('analytics-sidebar--open');
  });
});
