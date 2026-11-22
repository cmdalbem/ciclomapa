import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

import AnalyticsSidebar, { officialKmMatch } from './AnalyticsSidebar.js';
import { appModal } from './antdModal.js';

jest.mock('./antdModal.js', () => ({
  appModal: { confirm: jest.fn(), info: jest.fn(), error: jest.fn() },
}));

jest.mock('./Storage.js', () => {
  class Storage {
    getCityStatsDoc(id) {
      return Promise.resolve(
        id === 'curitiba' || id === 'curitiba-parana-brasil'
          ? { lengths: { ciclovia: 8, ciclofaixa: 4 } }
          : null
      );
    }
  }
  return { __esModule: true, default: Storage };
});

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
  onFollowViewportCityChange: jest.fn(),
};

async function openMetricInfo(name) {
  fireEvent.mouseEnter(screen.getByRole('button', { name: new RegExp(`Informações: ${name}`) }));
}

function renderSidebar(props = {}) {
  Object.values(handlers).forEach((fn) => fn.mockClear?.());
  return render(
    <MemoryRouter>
      <AnalyticsSidebar
        open
        toggle={handlers.toggle}
        downloadData={handlers.downloadData}
        forceUpdate={handlers.forceUpdate}
        cancelDataLoad={handlers.cancelDataLoad}
        openCityPicker={handlers.openCityPicker}
        onChangeStrategy={handlers.onChangeStrategy}
        onFollowViewportCityChange={handlers.onFollowViewportCityChange}
        location="Porto Alegre, Rio Grande do Sul, Brasil"
        layers={[...infra, poi]}
        lengths={lengths}
        lastUpdate={new Date(Date.now() - 60 * 60 * 1000)}
        {...props}
      />
    </MemoryRouter>
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

  it('toggles cidade-segue-o-mapa from the mapper box', () => {
    renderSidebar({ followViewportCity: false, mapperMode: true });
    const followSwitch = screen.getByRole('switch', {
      name: 'Mudar de cidade automaticamente com o mapa',
    });
    expect(followSwitch.closest('[data-mapper-follow]')).toBeTruthy();
    expect(
      screen.getByLabelText('Estratégia de cálculo de extensão').closest('[data-mapper-box]')
    ).not.toContainElement(followSwitch);
    fireEvent.click(followSwitch);
    expect(handlers.onFollowViewportCityChange.mock.calls[0][0]).toBe(true);
  });

  it('hides cidade-segue-o-mapa outside mapper mode', () => {
    renderSidebar({ followViewportCity: false });
    expect(
      screen.queryByRole('switch', { name: 'Mudar de cidade automaticamente com o mapa' })
    ).not.toBeInTheDocument();
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

  it('shows skeletons instead of Sem dados while city lengths are loading', () => {
    renderSidebar({ loading: true, lengths: {}, lastUpdate: null });
    expect(screen.queryByText('Sem dados')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('analytics-skel-md').length).toBeGreaterThan(0);
    expect(screen.getByTestId('analytics-skel-lg')).toBeInTheDocument();
    expect(screen.getByText('Ciclovia')).toBeInTheDocument();
    expect(screen.getByText('Bicicletários')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Alternar inclusão/ })).not.toBeInTheDocument();
  });

  it('keeps zero km and POI counts while refreshing instead of swapping them for skeletons', () => {
    renderSidebar({
      loading: true,
      lengths: { ciclovia: 0, ciclofaixa: 0, bicicletarios: 12 },
    });
    expect(screen.queryByTestId('analytics-skel-lg')).toBeNull();
    expect(screen.getByText('TOTAL')).toBeInTheDocument();
    expect(screen.getByText('Bicicletários')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('keeps real totals while refreshing a city that already has lengths', () => {
    renderSidebar({ loading: true });
    expect(screen.getByText('TOTAL')).toBeInTheDocument();
    expect(screen.getByText(/17\.0/)).toBeInTheDocument();
    expect(screen.queryByText('Sem dados')).not.toBeInTheDocument();
    expect(screen.queryByTestId('analytics-skel-lg')).toBeNull();
  });

  it('opens a cities ranking modal from PNB with links to each city', async () => {
    renderSidebar({
      cityMetadata: { pnb_total: 22, pnb_year: 2024 },
      cityMetadataRecords: [
        { fields: { location: 'Porto Alegre', pnb_total: 22 } },
        { fields: { location: 'São Paulo', pnb_total: 10 } },
        { fields: { location: 'Curitiba', pnb_total: 18 } },
      ],
    });

    await openMetricInfo('PNB');
    fireEvent.click(await screen.findByRole('button', { name: 'Comparar PNB entre cidades' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('PNB');
    expect(dialog).not.toHaveTextContent('OSM');
    const portoAlegre = screen.getByRole('link', { name: /Porto Alegre/ });
    expect(portoAlegre).toHaveAttribute('href', '/porto-alegre');
    expect(portoAlegre).toHaveAttribute('aria-current', 'page');
    expect(portoAlegre).toHaveTextContent('Rio Grande do Sul');
    expect(portoAlegre.querySelector('[data-testid="city-infra-mini-ring"]')).not.toBeNull();
    expect(screen.getByRole('link', { name: /São Paulo/ })).toHaveAttribute('href', '/sao-paulo');
    await waitFor(() => {
      expect(
        screen
          .getByRole('link', { name: /Curitiba/ })
          .querySelector('[data-testid="city-infra-mini-ring"]')
      ).not.toBeNull();
    });

    fireEvent.click(screen.getByRole('link', { name: /Curitiba/ }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('adds historic year columns when cities have them', async () => {
    renderSidebar({
      cityMetadata: { pnb_total: 22, pnb_year: 2024 },
      cityMetadataRecords: [
        {
          fields: {
            location: 'Porto Alegre',
            pnb_total: 22,
            pnb_2022: 14,
            pnb_2024: 22,
          },
        },
        {
          fields: {
            location: 'São Paulo',
            pnb_total: 10,
            pnb_2022: 8,
            pnb_2024: 10,
          },
        },
        {
          fields: {
            location: 'Curitiba',
            pnb_total: 18,
          },
        },
      ],
    });

    await openMetricInfo('PNB');
    fireEvent.click(await screen.findByRole('button', { name: 'Comparar PNB entre cidades' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('2022');
    expect(dialog).toHaveTextContent('2024');
    expect(dialog).toHaveTextContent('PNB');
    expect(dialog).toHaveTextContent('14%');
    expect(dialog).toHaveTextContent('8%');
    expect(screen.getByRole('link', { name: /Curitiba/ })).toHaveTextContent('18%');
  });

  it('hides the ranking button when fewer than two cities have that metric', async () => {
    renderSidebar({
      cityMetadata: { pnb_total: 22, ideciclo: 0.4 },
      cityMetadataRecords: [
        { fields: { location: 'Porto Alegre', pnb_total: 22, ideciclo: 0.4 } },
        { fields: { location: 'São Paulo', pnb_total: 10 } },
      ],
    });
    await openMetricInfo('PNB');
    expect(
      await screen.findByRole('button', { name: 'Comparar PNB entre cidades' })
    ).toBeInTheDocument();
    await openMetricInfo('IDECiclo');
    expect(await screen.findByText(/Índice de Desenvolvimento Cicloviário/)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Comparar IDECiclo entre cidades' })
    ).not.toBeInTheDocument();
  });

  it('colors official km green / yellow / red by how close OSM ciclovia+ciclofaixa is', async () => {
    expect(officialKmMatch(15, 15).grade).toBe('close');
    expect(officialKmMatch(15, 22).grade).toBe('mid');
    expect(officialKmMatch(15, 120).grade).toBe('far');

    renderSidebar({ cityMetadata: { alianca_2026: 15 } });
    const closeBtn = screen.getByRole('button', {
      name: /Informações: Dado oficial da Prefeitura/,
    });
    expect(closeBtn).toHaveAttribute('data-km-grade', 'close');
    expect(closeBtn).toHaveAccessibleName(/OSM em 100% desse valor/);
  });

  it('keeps the current city OSM lengths even when ciclovia+ciclofaixa is zero', async () => {
    localStorage.setItem(
      'ciclomapa_city_switcher_stats_km_v3',
      JSON.stringify({
        'porto-alegre': { lengthsKmByLayer: { ciclovia: 15, ciclofaixa: 0 } },
      })
    );
    renderSidebar({
      lengths: { ciclovia: 0, ciclofaixa: 0, ciclorrota: 1 },
      cityMetadata: { alianca_2026: 120 },
      cityMetadataRecords: [
        { fields: { location: 'Porto Alegre', alianca_2026: 120 } },
        { fields: { location: 'Palmas', alianca_2026: 60 } },
      ],
    });

    await openMetricInfo('Dado oficial da Prefeitura');
    fireEvent.click(
      await screen.findByRole('button', { name: 'Comparar dado oficial entre cidades' })
    );
    const portoAlegre = screen.getByRole('link', { name: /Porto Alegre/ });
    expect(portoAlegre).toHaveTextContent('120');
    expect(portoAlegre).not.toHaveTextContent('15.0');
  });

  it('opens official km ranking from the pie', async () => {
    renderSidebar({
      cityMetadata: { alianca_2026: 120 },
      cityMetadataRecords: [
        { fields: { location: 'Porto Alegre', alianca_2026: 120 } },
        { fields: { location: 'Palmas', alianca_2026: 60 } },
      ],
    });

    await openMetricInfo('Dado oficial da Prefeitura');
    fireEvent.click(
      await screen.findByRole('button', { name: 'Comparar dado oficial entre cidades' })
    );
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Dado oficial da Prefeitura');
    expect(dialog).toHaveTextContent('OSM');
    const portoAlegre = screen.getByRole('link', { name: /Porto Alegre/ });
    expect(portoAlegre).toHaveTextContent('15.0');
    expect(portoAlegre).toHaveTextContent('120');
    expect(portoAlegre.querySelector('[data-km-grade="far"]')).not.toBeNull();
    expect(screen.getByRole('link', { name: /Palmas/ })).toHaveAttribute('href', '/palmas');
    expect(screen.getByRole('link', { name: /Palmas/ })).toHaveTextContent('Tocantins');
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
    expect(screen.getByLabelText('Motor de detecção de vias paralelas')).toBeInTheDocument();
    expect(
      screen.getByLabelText('Estratégia de cálculo de extensão').closest('[data-mapper-box]')
    ).toHaveTextContent('Modo mapeador');
    expect(screen.getByText('Extensão')).toBeInTheDocument();
    expect(screen.getByText('Pareamento')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sobre o cálculo da extensão' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sobre o pareamento de vias' })).toBeInTheDocument();
  });

  it('shows length and pairing pickers in mapper mode without debug', () => {
    renderSidebar({
      mapperMode: true,
      lengthCalculationStrategy: 'average',
      parallelDedupeEngine: 'topology_first',
    });
    expect(screen.getByLabelText('Estratégia de cálculo de extensão')).toBeInTheDocument();
    expect(screen.getByLabelText('Motor de detecção de vias paralelas')).toBeInTheDocument();
    expect(
      screen.getByLabelText('Motor de detecção de vias paralelas').closest('[data-mapper-box]')
    ).toBeTruthy();
    expect(screen.getByText('Extensão')).toBeInTheDocument();
    expect(screen.getByText('Pareamento')).toBeInTheDocument();
  });

  it('hides analysis pickers outside mapper and debug', () => {
    renderSidebar();
    expect(screen.queryByLabelText('Estratégia de cálculo de extensão')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Motor de detecção de vias paralelas')).not.toBeInTheDocument();
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
        lastUpdate={new Date(Date.now() - 60 * 60 * 1000)}
        forceUpdate={handlers.forceUpdate}
        cancelDataLoad={handlers.cancelDataLoad}
        loading
      />
    );
    expect(screen.getByText(/Dados obtidos do OpenStreetMap/)).toBeInTheDocument();
    expect(screen.queryByText(/Carregando dados desta cidade/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
    expect(screen.queryByText('Sincronizar')).not.toBeInTheDocument();

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
    fireEvent.click(screen.getByRole('button', { name: 'Mais opções' }));
    fireEvent.click(await screen.findByText('Sincronizar'));
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
