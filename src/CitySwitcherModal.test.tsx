import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import Storage from './Storage.js';
import { slugify } from './utils/utils.js';
import { getCanonicalCitySlug } from './config/citySlugCatalog.js';
import { TOP_CITY_SLUGS } from './config/topCitiesCatalog.js';
import CitySwitcherModal, {
  replaceCitySwitcherStatsCacheForTest,
  resetCitySwitcherStatsCacheForTest,
  STATS_TOTALS_SUCCESS_TTL_MS,
} from './CitySwitcherModal';

jest.mock('./googlePlacesClient.js', () => {
  const actual = jest.requireActual('./googlePlacesClient.js');
  return {
    getCityFromResultLike: actual.getCityFromResultLike,
    getAreaStringFromResultLike: actual.getAreaStringFromResultLike,
    ensureGooglePlacesReady: jest.fn().mockResolvedValue(undefined),
    getGooglePlacesGeocoder: jest.fn().mockReturnValue({
      search: jest.fn().mockResolvedValue([]),
      getPlaceDetails: jest.fn().mockResolvedValue({
        coordinates: [-46.6333, -23.5505],
        formatted_address: 'Endereço de teste',
        name: 'Local de teste',
        types: ['establishment'],
        address_components: [],
      }),
    }),
  };
});

const RECENT_CITIES_STATS_KEY = 'ciclomapa_recent_cities_v1';
const RECENT_ITEMS_KEY = 'ciclomapa_recent_items_v1';

function cityLink(slug: string): HTMLElement {
  const el = document.querySelector(`a[data-city-slug="${slug}"]`);
  if (!el || !(el instanceof HTMLElement)) {
    throw new Error(`Expected link[data-city-slug="${slug}"]`);
  }
  return el;
}

function expectCityLinkTotalKm(link: HTMLElement, expectedKm: string) {
  const total = link.querySelector('[data-city-total-km]');
  expect(total).not.toBeNull();
  expect(total).toHaveAttribute('data-city-total-km', expectedKm);
}

beforeEach(() => {
  resetCitySwitcherStatsCacheForTest();
  jest.spyOn(Storage.prototype, 'getCityStatsDoc').mockResolvedValue(null);
});

afterEach(() => {
  jest.restoreAllMocks();
  resetCitySwitcherStatsCacheForTest();
  window.localStorage.removeItem(RECENT_CITIES_STATS_KEY);
  window.localStorage.removeItem(RECENT_ITEMS_KEY);
});

function CitySwitcherTestHost() {
  const loc = useLocation();

  return (
    <>
      <div data-testid="pathname">{loc.pathname}</div>
      <CitySwitcherModal />
    </>
  );
}

function renderOpenPicker(initialPath = '/curitiba') {
  return render(
    <MemoryRouter initialEntries={[initialPath, `${initialPath}?buscar`]}>
      <Routes>
        <Route path="/:city" element={<CitySwitcherTestHost />} />
      </Routes>
    </MemoryRouter>
  );
}

it('renders city picker dialog with expected regions when open', async () => {
  renderOpenPicker('/curitiba');

  expect(screen.getByTestId('city-switcher-dialog')).toBeInTheDocument();
  expect(screen.getByTestId('city-switcher-close')).toBeInTheDocument();
  await waitFor(() => {
    expect(document.querySelector('a[data-city-slug="sao-paulo"]')).toBeInstanceOf(
      HTMLAnchorElement
    );
  });
});

it('close button removes show-city-picker from body', async () => {
  const user = userEvent.setup();
  renderOpenPicker();

  expect(document.querySelector('.city-switcher-modal--open')).not.toBeNull();
  await user.click(screen.getByTestId('city-switcher-close'));
  expect(document.querySelector('.city-switcher-modal--open')).toBeNull();
});

it('Escape closes the city picker', async () => {
  const user = userEvent.setup();
  renderOpenPicker();

  expect(document.querySelector('.city-switcher-modal--open')).not.toBeNull();
  await user.keyboard('{Escape}');
  expect(document.querySelector('.city-switcher-modal--open')).toBeNull();
});

it('clicking a top city navigates to that slug and closes the picker', async () => {
  const user = userEvent.setup();
  renderOpenPicker('/curitiba');

  await waitFor(() => {
    expect(document.querySelector('a[data-city-slug="sao-paulo"]')).toBeInstanceOf(
      HTMLAnchorElement
    );
  });

  await user.click(cityLink('sao-paulo'));

  await waitFor(() => {
    expect(screen.getByTestId('pathname')).toHaveTextContent('/sao-paulo');
  });
  expect(document.querySelector('.city-switcher-modal--open')).toBeNull();
});

it('shows Recentes when localStorage has recent city items (favoritesStore)', async () => {
  window.localStorage.setItem(
    RECENT_ITEMS_KEY,
    JSON.stringify([
      {
        id: 'city:rio-de-janeiro',
        type: 'city',
        title: 'Rio de Janeiro',
        subtitle: 'Rio de Janeiro, Brasil',
        citySlug: 'rio-de-janeiro',
        visitedAt: Date.now(),
      },
    ])
  );

  renderOpenPicker('/curitiba');

  const recentSection = await screen.findByTestId('city-switcher-recent');
  await waitFor(() => {
    const link = recentSection.querySelector('a[href="/rio-de-janeiro"]');
    expect(link).toBeInstanceOf(HTMLAnchorElement);
  });
  expect(recentSection).toHaveTextContent('Rio de Janeiro');
});

describe('city stats totals from Storage', () => {
  it('sums LENGTH_COUNTED_LAYER_IDS from the stats doc into a single km label', async () => {
    (Storage.prototype.getCityStatsDoc as jest.Mock).mockImplementation((id: string) =>
      id === 'sao-paulo'
        ? Promise.resolve({
            lengths: {
              ciclovia: 10,
              ciclofaixa: 5,
              ciclorrota: 2,
              'calcada-compartilhada': 1,
            },
          })
        : Promise.resolve(null)
    );

    renderOpenPicker('/curitiba');

    await waitFor(() => {
      expectCityLinkTotalKm(cityLink('sao-paulo'), '18');
    });
  });

  it('renders a ciclovia/ciclofaixa ring chart next to the km total when those layers have length', async () => {
    (Storage.prototype.getCityStatsDoc as jest.Mock).mockImplementation((id: string) =>
      id === 'sao-paulo'
        ? Promise.resolve({
            lengths: { ciclovia: 10, ciclofaixa: 5, ciclorrota: 3 },
          })
        : Promise.resolve(null)
    );

    renderOpenPicker('/curitiba');

    await waitFor(() => {
      const link = cityLink('sao-paulo');
      expect(link.querySelector('[data-testid="city-switcher-mini-pie"]')).not.toBeNull();
      expectCityLinkTotalKm(link, '18');
    });
  });

  it('shows ring placeholder (not data chart) when only ciclorrota / calçada lengths exist', async () => {
    (Storage.prototype.getCityStatsDoc as jest.Mock).mockImplementation((id: string) =>
      id === 'sao-paulo'
        ? Promise.resolve({
            lengths: { ciclorrota: 10, 'calcada-compartilhada': 4 },
          })
        : Promise.resolve(null)
    );

    renderOpenPicker('/curitiba');

    await waitFor(() => {
      expectCityLinkTotalKm(cityLink('sao-paulo'), '14');
    });
    const link = cityLink('sao-paulo');
    expect(link.querySelector('[data-testid="city-switcher-mini-pie"]')).toBeNull();
    expect(link.querySelector('[data-testid="city-switcher-ring-placeholder"]')).not.toBeNull();
  });

  it('resolves totals when Firestore id matches a secondary slug candidate (area label), not only canonical slug', async () => {
    const areaDocId = slugify('São Paulo, São Paulo, Brasil');
    expect(areaDocId).not.toBe('sao-paulo');

    (Storage.prototype.getCityStatsDoc as jest.Mock).mockImplementation((id: string) =>
      id === areaDocId ? Promise.resolve({ lengths: { ciclovia: 33 } }) : Promise.resolve(null)
    );

    renderOpenPicker('/curitiba');

    await waitFor(() => {
      expectCityLinkTotalKm(cityLink('sao-paulo'), '33');
    });
  });

  it('shows skeleton while preload is pending, then replaces it with km once Storage resolves', async () => {
    let finishSaoPaulo!: () => void;
    const saoPauloReady = new Promise<void>((res) => {
      finishSaoPaulo = res;
    });
    (Storage.prototype.getCityStatsDoc as jest.Mock).mockImplementation((id: string) =>
      id === 'sao-paulo'
        ? saoPauloReady.then(() => ({ lengths: { ciclovia: 44 } }))
        : Promise.resolve(null)
    );

    renderOpenPicker('/curitiba');

    await waitFor(() => {
      expect(
        cityLink('sao-paulo').querySelector('.city-switcher-modal__cityTotalSkeleton')
      ).not.toBeNull();
    });

    finishSaoPaulo();

    await waitFor(() => {
      expectCityLinkTotalKm(cityLink('sao-paulo'), '44');
    });
    expect(
      cityLink('sao-paulo').querySelector('.city-switcher-modal__cityTotalSkeleton')
    ).toBeNull();
  });

  it('after Storage returns null docs for all requested ids, shows no km and no perpetual skeleton', async () => {
    renderOpenPicker('/curitiba');

    await waitFor(() => {
      expect(Storage.prototype.getCityStatsDoc).toHaveBeenCalled();
    });

    const link = cityLink('sao-paulo');
    await waitFor(() => {
      expect(link.querySelector('.city-switcher-modal__cityTotalSkeleton')).toBeNull();
    });
    expect(link.querySelector('.city-switcher-modal__cityTotal')).toBeNull();
  });

  it('does not call Storage on remount when the first preload cached km totals per canonical slug', async () => {
    (Storage.prototype.getCityStatsDoc as jest.Mock).mockImplementation((id: string) =>
      id === 'sao-paulo' ? Promise.resolve({ lengths: { ciclovia: 60 } }) : Promise.resolve(null)
    );

    const first = renderOpenPicker('/curitiba');
    await waitFor(() => {
      expectCityLinkTotalKm(cityLink('sao-paulo'), '60');
    });
    await waitFor(() => {
      expect(
        cityLink('sao-paulo').querySelector('.city-switcher-modal__cityTotalSkeleton')
      ).toBeNull();
    });

    (Storage.prototype.getCityStatsDoc as jest.Mock).mockClear();

    first.unmount();
    render(
      <MemoryRouter initialEntries={['/curitiba', '/curitiba?buscar']}>
        <Routes>
          <Route path="/:city" element={<CitySwitcherTestHost />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expectCityLinkTotalKm(cityLink('sao-paulo'), '60');
    });
    expect(Storage.prototype.getCityStatsDoc).not.toHaveBeenCalled();
  });

  it('keeps showing cached km while revalidating a stale success (no skeleton)', async () => {
    let finishSp!: () => void;
    const saoPauloReady = new Promise<void>((res) => {
      finishSp = res;
    });
    const staleFetchedAt = Date.now() - STATS_TOTALS_SUCCESS_TTL_MS - 60 * 1000;
    replaceCitySwitcherStatsCacheForTest(
      new Map([['sao-paulo', { value: 41, fetchedAt: staleFetchedAt }]])
    );

    (Storage.prototype.getCityStatsDoc as jest.Mock).mockImplementation((id: string) =>
      id === 'sao-paulo'
        ? saoPauloReady.then(() => ({ lengths: { ciclovia: 42 } }))
        : Promise.resolve(null)
    );

    renderOpenPicker('/curitiba');

    await waitFor(() => {
      expectCityLinkTotalKm(cityLink('sao-paulo'), '41');
    });
    expect(
      cityLink('sao-paulo').querySelector('.city-switcher-modal__cityTotalSkeleton')
    ).toBeNull();

    finishSp();

    await waitFor(() => {
      expectCityLinkTotalKm(cityLink('sao-paulo'), '42');
    });
  });

  it('refetches when cache has a stale success past STATS_TOTALS_SUCCESS_TTL_MS', async () => {
    const staleFetchedAt = Date.now() - STATS_TOTALS_SUCCESS_TTL_MS - 60 * 1000;
    replaceCitySwitcherStatsCacheForTest(
      new Map([['sao-paulo', { value: 77, fetchedAt: staleFetchedAt }]])
    );

    (Storage.prototype.getCityStatsDoc as jest.Mock).mockImplementation((id: string) =>
      id === 'sao-paulo' ? Promise.resolve({ lengths: { ciclovia: 88 } }) : Promise.resolve(null)
    );

    renderOpenPicker('/curitiba');

    await waitFor(() => {
      expectCityLinkTotalKm(cityLink('sao-paulo'), '88');
    });
    expect(Storage.prototype.getCityStatsDoc).toHaveBeenCalled();
  });

  it('refetches when cache has a stale null miss past STATS_TOTALS_MISS_TTL_MS', async () => {
    const staleFetchedAt = Date.now() - 6 * 60 * 1000;
    replaceCitySwitcherStatsCacheForTest(
      new Map([['sao-paulo', { value: null, fetchedAt: staleFetchedAt }]])
    );

    (Storage.prototype.getCityStatsDoc as jest.Mock).mockImplementation((id: string) =>
      id === 'sao-paulo' ? Promise.resolve({ lengths: { ciclovia: 12 } }) : Promise.resolve(null)
    );

    renderOpenPicker('/curitiba');

    await waitFor(() => {
      expectCityLinkTotalKm(cityLink('sao-paulo'), '12');
    });
    expect(Storage.prototype.getCityStatsDoc).toHaveBeenCalled();
  });

  it('does not call Storage when replaceCitySwitcherStatsCacheForTest seeds every canonical slug', async () => {
    const requested = new Set<string>();
    (Storage.prototype.getCityStatsDoc as jest.Mock).mockImplementation((id: string) => {
      requested.add(id);
      return Promise.resolve(null);
    });

    const first = renderOpenPicker('/curitiba');
    await waitFor(() => {
      expect(Storage.prototype.getCityStatsDoc).toHaveBeenCalled();
    });
    const uniqueTopSlugs = new Set(
      TOP_CITY_SLUGS.map((slug) => getCanonicalCitySlug(slug) || slug)
    );
    expect(requested.size).toBeLessThanOrEqual(uniqueTopSlugs.size * 8);

    const warmCache = new Map<string, { value: null; fetchedAt: number }>();
    const now = Date.now();
    uniqueTopSlugs.forEach((canonical) =>
      warmCache.set(canonical, { value: null, fetchedAt: now })
    );
    replaceCitySwitcherStatsCacheForTest(warmCache);
    (Storage.prototype.getCityStatsDoc as jest.Mock).mockClear();

    first.unmount();
    renderOpenPicker('/porto-alegre');

    await waitFor(() => {
      expect(document.querySelector('a[data-city-slug="porto-alegre"]')).toBeInstanceOf(
        HTMLAnchorElement
      );
    });
    expect(Storage.prototype.getCityStatsDoc).not.toHaveBeenCalled();
  });
});
