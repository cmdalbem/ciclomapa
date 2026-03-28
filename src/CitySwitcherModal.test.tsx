import React, { useLayoutEffect } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import Storage from './Storage.js';
import { slugify } from './utils/utils.js';
import CitySwitcherModal, {
  replaceCitySwitcherStatsCacheForTest,
  resetCitySwitcherStatsCacheForTest,
} from './CitySwitcherModal';

const RECENT_KEY = 'ciclomapa_recent_cities_v1';

beforeEach(() => {
  resetCitySwitcherStatsCacheForTest();
  jest.spyOn(Storage.prototype, 'getCityStatsDocs').mockResolvedValue(new Map());
});

afterEach(() => {
  jest.restoreAllMocks();
  resetCitySwitcherStatsCacheForTest();
  document.body.classList.remove('show-city-picker');
  window.localStorage.removeItem(RECENT_KEY);
});

/** Injects a dummy geocoder input so focus retries from CitySwitcherModal do not spin for seconds. */
function CitySwitcherWithGeocoderStub() {
  const loc = useLocation();

  useLayoutEffect(() => {
    const mount = document.querySelector('.city-switcher-modal__geocoderMount');
    if (mount && !mount.querySelector('input')) {
      mount.appendChild(document.createElement('input'));
    }
  }, []);

  return (
    <>
      <div data-testid="pathname">{loc.pathname}</div>
      <CitySwitcherModal />
    </>
  );
}

function renderOpenPicker(initialPath = '/curitiba') {
  document.body.classList.add('show-city-picker');
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/:city" element={<CitySwitcherWithGeocoderStub />} />
      </Routes>
    </MemoryRouter>
  );
}

function brasilSection() {
  return screen.getByRole('region', { name: /^brasil$/i });
}

function saoPauloButton() {
  return within(brasilSection()).getByRole('button', { name: /são paulo/i });
}

it('renders city picker dialog with expected regions when open', async () => {
  renderOpenPicker('/curitiba');

  expect(screen.getByRole('dialog', { name: /selecionar cidade/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /fechar/i })).toBeInTheDocument();
  await waitFor(() => {
    expect(screen.getByRole('button', { name: /são paulo/i })).toBeInTheDocument();
  });
});

it('close button removes show-city-picker from body', async () => {
  const user = userEvent.setup();
  renderOpenPicker();

  expect(document.body.classList.contains('show-city-picker')).toBe(true);
  await user.click(screen.getByRole('button', { name: /fechar/i }));
  expect(document.body.classList.contains('show-city-picker')).toBe(false);
});

it('Escape closes the city picker', async () => {
  const user = userEvent.setup();
  renderOpenPicker();

  expect(document.body.classList.contains('show-city-picker')).toBe(true);
  await user.keyboard('{Escape}');
  expect(document.body.classList.contains('show-city-picker')).toBe(false);
});

it('clicking a top city navigates to that slug and closes the picker', async () => {
  const user = userEvent.setup();
  renderOpenPicker('/curitiba');

  await waitFor(() => {
    expect(screen.getByRole('button', { name: /são paulo/i })).toBeInTheDocument();
  });

  await user.click(screen.getByRole('button', { name: /são paulo/i }));

  await waitFor(() => {
    expect(screen.getByTestId('pathname')).toHaveTextContent('/sao-paulo');
  });
  expect(document.body.classList.contains('show-city-picker')).toBe(false);
});

it('shows Recentes when localStorage has recent cities with catalog entries', async () => {
  window.localStorage.setItem(
    RECENT_KEY,
    JSON.stringify([
      {
        slug: 'rio-de-janeiro',
        areaLabel: 'Rio de Janeiro, Rio de Janeiro, Brasil',
        visitedAt: Date.now(),
      },
    ])
  );

  renderOpenPicker('/curitiba');

  const recentSection = await screen.findByRole('region', { name: /recentemente visitadas/i });
  expect(
    within(recentSection).getByRole('button', { name: /rio de janeiro/i })
  ).toBeInTheDocument();
});

describe('city stats totals from Storage', () => {
  it('sums LENGTH_COUNTED_LAYER_IDS from the stats doc into a single km label', async () => {
    (Storage.prototype.getCityStatsDocs as jest.Mock).mockResolvedValue(
      new Map([
        [
          'sao-paulo',
          {
            lengths: {
              ciclovia: 10,
              ciclofaixa: 5,
              ciclorrota: 2,
              'calcada-compartilhada': 1,
            },
          },
        ],
      ])
    );

    renderOpenPicker('/curitiba');

    await waitFor(() => {
      expect(within(saoPauloButton()).getByText('18 km')).toBeInTheDocument();
    });
  });

  it('resolves totals when Firestore id matches a secondary slug candidate (area label), not only canonical slug', async () => {
    const areaDocId = slugify('São Paulo, São Paulo, Brasil');
    expect(areaDocId).not.toBe('sao-paulo');

    (Storage.prototype.getCityStatsDocs as jest.Mock).mockResolvedValue(
      new Map([[areaDocId, { lengths: { ciclovia: 33 } }]])
    );

    renderOpenPicker('/curitiba');

    await waitFor(() => {
      expect(within(saoPauloButton()).getByText('33 km')).toBeInTheDocument();
    });
  });

  it('shows skeleton while preload is pending, then replaces it with km once Storage resolves', async () => {
    let resolveDocs!: (m: Map<string, unknown>) => void;
    const deferred = new Promise<Map<string, unknown>>((res) => {
      resolveDocs = res;
    });
    (Storage.prototype.getCityStatsDocs as jest.Mock).mockImplementation(() => deferred);

    renderOpenPicker('/curitiba');

    await waitFor(() => {
      expect(
        saoPauloButton().querySelector('.city-switcher-modal__cityTotalSkeleton')
      ).not.toBeNull();
    });

    resolveDocs(new Map([['sao-paulo', { lengths: { ciclovia: 44 } }]]));

    await waitFor(() => {
      expect(within(saoPauloButton()).getByText('44 km')).toBeInTheDocument();
    });
    expect(saoPauloButton().querySelector('.city-switcher-modal__cityTotalSkeleton')).toBeNull();
  });

  it('after Storage returns null docs for all requested ids, shows no km and no perpetual skeleton', async () => {
    (Storage.prototype.getCityStatsDocs as jest.Mock).mockImplementation(async (ids: string[]) => {
      const m = new Map();
      ids.forEach((id: string) => m.set(id, null));
      return m;
    });

    renderOpenPicker('/curitiba');

    await waitFor(() => {
      expect(Storage.prototype.getCityStatsDocs).toHaveBeenCalled();
    });

    const btn = saoPauloButton();
    await waitFor(() => {
      expect(btn.querySelector('.city-switcher-modal__cityTotalSkeleton')).toBeNull();
    });
    expect(within(btn).queryByText(/^\d+ km$/)).toBeNull();
  });

  it('does not call Storage on remount when the first preload wrote cache rows for every requested doc id', async () => {
    // preloadStatsTotalsForCities only calls set() for ids present on the returned Map; omitting ids
    // would leave holes and force refetch on the next mount for other cities' candidates.
    (Storage.prototype.getCityStatsDocs as jest.Mock).mockImplementation(async (ids: string[]) => {
      const m = new Map<string, unknown>();
      ids.forEach((id: string) => {
        m.set(id, id === 'sao-paulo' ? { lengths: { ciclovia: 60 } } : null);
      });
      return m;
    });

    const first = renderOpenPicker('/curitiba');
    await waitFor(() => {
      expect(within(saoPauloButton()).getByText('60 km')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(saoPauloButton().querySelector('.city-switcher-modal__cityTotalSkeleton')).toBeNull();
    });

    (Storage.prototype.getCityStatsDocs as jest.Mock).mockClear();

    first.unmount();
    document.body.classList.add('show-city-picker');
    render(
      <MemoryRouter initialEntries={['/curitiba']}>
        <Routes>
          <Route path="/:city" element={<CitySwitcherWithGeocoderStub />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(within(saoPauloButton()).getByText('60 km')).toBeInTheDocument();
    });
    expect(Storage.prototype.getCityStatsDocs).not.toHaveBeenCalled();
  });

  it('refetches when cache has a stale null miss past STATS_TOTALS_MISS_TTL_MS', async () => {
    const staleFetchedAt = Date.now() - 6 * 60 * 1000;
    replaceCitySwitcherStatsCacheForTest(
      new Map([['sao-paulo', { value: null, fetchedAt: staleFetchedAt }]])
    );

    (Storage.prototype.getCityStatsDocs as jest.Mock).mockResolvedValue(
      new Map([['sao-paulo', { lengths: { ciclovia: 12 } }]])
    );

    renderOpenPicker('/curitiba');

    await waitFor(() => {
      expect(within(saoPauloButton()).getByText('12 km')).toBeInTheDocument();
    });
    expect(Storage.prototype.getCityStatsDocs).toHaveBeenCalled();
  });

  it('does not call Storage when replaceCitySwitcherStatsCacheForTest seeds every id the preload would request', async () => {
    const requested = new Set<string>();
    (Storage.prototype.getCityStatsDocs as jest.Mock).mockImplementation(async (ids: string[]) => {
      ids.forEach((id: string) => requested.add(id));
      const m = new Map();
      ids.forEach((id: string) => m.set(id, null));
      return m;
    });

    const first = renderOpenPicker('/curitiba');
    await waitFor(() => {
      expect(Storage.prototype.getCityStatsDocs).toHaveBeenCalled();
    });
    expect(requested.size).toBeGreaterThan(100);

    const warmCache = new Map<string, { value: null; fetchedAt: number }>();
    const now = Date.now();
    requested.forEach((id) => warmCache.set(id, { value: null, fetchedAt: now }));
    replaceCitySwitcherStatsCacheForTest(warmCache);
    (Storage.prototype.getCityStatsDocs as jest.Mock).mockClear();

    first.unmount();
    renderOpenPicker('/porto-alegre');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /porto alegre/i })).toBeInTheDocument();
    });
    expect(Storage.prototype.getCityStatsDocs).not.toHaveBeenCalled();
  });
});
