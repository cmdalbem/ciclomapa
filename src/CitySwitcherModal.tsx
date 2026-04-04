import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useParams } from 'react-router-dom';
import { HiMiniClock, HiOutlineXMark, HiOutlineHeart, HiHeart } from 'react-icons/hi2';
import { HiSearch as IconSearch } from 'react-icons/hi';
import { Button, Input } from 'antd';
import Storage from './Storage.js';
import { slugify } from './utils/utils.js';
import { getCanonicalCitySlug, getPredefinedCitySlugDefinition } from './config/citySlugCatalog.js';
import { TOP_CITY_SLUGS } from './config/topCitiesCatalog.js';
import {
  CITY_SWITCHER_MINI_CHART_LAYER_IDS,
  ENABLE_CITY_SWITCHER_STATS_CACHE,
  IS_PROD,
  LENGTH_COUNTED_LAYER_IDS,
  MAX_RECENT_CITIES,
  MAX_RECENT_ITEMS_DISPLAY,
  SUPPORTED_COUNTRIES,
  SUPPORTED_COUNTRY_CODES,
  SUPPORTED_COUNTRY_LABEL_PT_BY_CODE,
} from './config/constants.js';
import { appendKmUnit } from './utils/routeUtils.js';
import { getAreaStringFromResultLike } from './googlePlacesClient.js';
import { PlacesAutocompleteOptionLabel } from './GooglePlacesGeocoder.js';
import {
  geocodePlacesSuggestionToResult,
  getCitySwitcherPlacesSearchOptions,
  PLACES_AUTOCOMPLETE_MIN_QUERY_LENGTH,
  searchPlacesForAutocomplete,
} from './placesAutocomplete.js';
import OSMController from './OSMController.js';
import {
  readFavorites,
  toggleFavorite,
  readRecentItems,
  addRecentCity,
  addRecentPlace,
  type FavoriteItem,
  type RecentItem,
} from './favoritesStore';

import './CitySwitcherModal.css';

// `react-icons` exports icons typed as returning `ReactNode` (see `IconType`),
// but React 19's JSX typings require a component return type that is a JSX element.
// Cast here to keep the rest of the file type-safe without changing runtime behavior.
const HiOutlineXMarkIcon = HiOutlineXMark as unknown as React.FC<React.SVGProps<SVGElement>>;
const HiMiniClockIcon = HiMiniClock as unknown as React.FC<React.SVGProps<SVGElement>>;
const IconSearchTyped = IconSearch as unknown as React.FC<React.SVGProps<SVGElement>>;
const HiOutlineHeartIcon = HiOutlineHeart as unknown as React.FC<React.SVGProps<SVGElement>>;
const HiHeartIcon = HiHeart as unknown as React.FC<React.SVGProps<SVGElement>>;

const CITY_SWITCHER_LOG_PREFIX = '[city-switcher]';

const RECENT_CITIES_STORAGE_KEY = 'ciclomapa_recent_cities_v1';

/** Persisted map: canonical city slug → summed km for that city only (layers in LENGTH_COUNTED_LAYER_IDS). */
const CITY_SWITCHER_STATS_KM_CACHE_KEY = 'ciclomapa_city_switcher_stats_km_v2';

const CITY_PICKER_INPUT_SELECTOR =
  '.city-switcher-modal__geocoderMount .city-switcher-global-search input';

/** Responsive columns for catalog cities, favorites, and recents (mobile: single column via CSS). */
const CITY_SWITCHER_CARD_GRID_CLASS =
  'city-switcher-modal__citiesGrid grid grid-cols-2 gap-2.5 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-3';

type StatsTotalsCacheEntry = {
  value: number | null;
  fetchedAt: number;
  /** Per-layer km from Firestore `lengths` (only keys absent in older cache entries). */
  lengthsKmByLayer?: Record<string, number> | null;
};

const statsTotalsByCanonicalSlugCache = new Map<string, StatsTotalsCacheEntry>();

function parseStoredLengthsKmByLayer(raw: unknown): Record<string, number> | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const layerId of LENGTH_COUNTED_LAYER_IDS) {
    const v = Number(o[layerId]);
    if (Number.isFinite(v) && v >= 0) out[layerId] = v;
  }
  const sum = Object.values(out).reduce((a, b) => a + b, 0);
  return sum > 0 ? out : null;
}

if (typeof window !== 'undefined' && ENABLE_CITY_SWITCHER_STATS_CACHE) {
  try {
    const raw = window.localStorage.getItem(CITY_SWITCHER_STATS_KM_CACHE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      Object.entries(parsed as Record<string, unknown>).forEach(([slug, row]) => {
        if (!slug || !row || typeof row !== 'object' || Array.isArray(row)) return;
        const r = row as { value?: unknown; fetchedAt?: unknown; lengthsKmByLayer?: unknown };
        const fetchedAt = typeof r.fetchedAt === 'number' ? r.fetchedAt : 0;
        const value =
          typeof r.value === 'number' && Number.isFinite(r.value)
            ? r.value
            : r.value === null
              ? null
              : null;
        const lengthsKmByLayer = parseStoredLengthsKmByLayer(r.lengthsKmByLayer);
        const entry: StatsTotalsCacheEntry = { value, fetchedAt };
        if (lengthsKmByLayer !== undefined) {
          entry.lengthsKmByLayer = lengthsKmByLayer;
        }
        statsTotalsByCanonicalSlugCache.set(slug, entry);
      });
    }
  } catch {}
}

let statsTotalsLoadPromise: Promise<void> | null = null;

/** Browser timer id; avoid `ReturnType<typeof setTimeout>` (conflicts with Node typings in some setups). */
let persistStatsKmCacheDebounceTimer: number | null = null;
const PERSIST_STATS_KM_CACHE_DEBOUNCE_MS = 300;

/** How long we trust a cached “no stats” result before retrying (5 minutes). */
const STATS_TOTALS_MISS_TTL_MS = 5 * 60 * 1000;
/**
 * After this age, a cached non-null km total is refreshed in the background (stale-while-revalidate:
 * UI keeps showing the old number until the new fetch finishes). 1 week.
 */
export const STATS_TOTALS_SUCCESS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Max cities resolved in parallel; each city tries Firestore doc ids in order until one hits. */
const STATS_FETCH_CONCURRENCY = 10;

function persistStatsKmCache(): void {
  if (typeof window === 'undefined' || !ENABLE_CITY_SWITCHER_STATS_CACHE) return;
  try {
    const out: Record<
      string,
      { value: number | null; fetchedAt: number; lengthsKmByLayer?: Record<string, number> | null }
    > = {};
    statsTotalsByCanonicalSlugCache.forEach((entry, slug) => {
      out[slug] = {
        value: entry.value,
        fetchedAt: entry.fetchedAt,
        ...(entry.lengthsKmByLayer !== undefined
          ? { lengthsKmByLayer: entry.lengthsKmByLayer }
          : {}),
      };
    });
    window.localStorage.setItem(CITY_SWITCHER_STATS_KM_CACHE_KEY, JSON.stringify(out));
  } catch {
    // Quota or private mode
  }
}

function flushPersistStatsKmCache(): void {
  if (persistStatsKmCacheDebounceTimer !== null) {
    clearTimeout(persistStatsKmCacheDebounceTimer);
    persistStatsKmCacheDebounceTimer = null;
  }
  persistStatsKmCache();
}

function schedulePersistStatsKmCache(): void {
  if (typeof window === 'undefined' || !ENABLE_CITY_SWITCHER_STATS_CACHE) return;
  if (persistStatsKmCacheDebounceTimer !== null) {
    clearTimeout(persistStatsKmCacheDebounceTimer);
  }
  persistStatsKmCacheDebounceTimer = window.setTimeout(() => {
    persistStatsKmCacheDebounceTimer = null;
    persistStatsKmCache();
  }, PERSIST_STATS_KM_CACHE_DEBOUNCE_MS);
}

type RecentCityEntry = {
  canonicalSlug: string;
  areaLabel: string;
  visitedAt: number;
};

type TopCityBase = {
  canonicalSlug: string;
  name: string;
  meta: string;
  areaLabel: string;
  countryCode: string | null;
};

type CityWithStats = TopCityBase & {
  totalLength: number | null;
  isLoadingTotal: boolean;
  lengthsKmByLayer: Record<string, number> | null;
};

type RecentCityWithStats = RecentCityEntry & {
  name: string;
  meta: string;
  areaLabel: string;
  countryCode: string | null;
  totalLength: number | null;
  isLoadingTotal: boolean;
  lengthsKmByLayer: Record<string, number> | null;
};

type CountryGroup = {
  countryCode: string;
  countryLabel: string;
  cities: CityWithStats[];
};

type StatsCityLike = {
  canonicalSlug?: string;
  slug?: string;
  areaLabel?: string;
  name?: string;
  meta?: string | null;
};

function readRecentCitiesFromStorage(): RecentCityEntry[] {
  try {
    const raw = window.localStorage.getItem(RECENT_CITIES_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    const items = Array.isArray(parsed) ? parsed : [];

    const uniqueBySlug = new Map<string, RecentCityEntry>();
    items.forEach((item: unknown) => {
      if (!item || typeof item !== 'object' || !('slug' in item)) return;
      const rec = item as { slug?: string; areaLabel?: string; visitedAt?: number };
      if (!rec.slug) return;
      const canonicalSlug = getCanonicalCitySlug(rec.slug) || rec.slug;
      if (uniqueBySlug.has(canonicalSlug)) return;
      uniqueBySlug.set(canonicalSlug, {
        canonicalSlug,
        areaLabel: rec.areaLabel || canonicalSlug,
        visitedAt: rec.visitedAt || 0,
      });
    });

    return Array.from(uniqueBySlug.values()).slice(0, MAX_RECENT_CITIES);
  } catch {
    return [];
  }
}

function recentCityEntriesEqual(a: RecentCityEntry[], b: RecentCityEntry[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (
      x.canonicalSlug !== y.canonicalSlug ||
      x.visitedAt !== y.visitedAt ||
      x.areaLabel !== y.areaLabel
    ) {
      return false;
    }
  }
  return true;
}

function writeRecentCitiesToStorage(
  items: Array<{ slug: string; areaLabel: string; visitedAt: number }>
) {
  try {
    window.localStorage.setItem(RECENT_CITIES_STORAGE_KEY, JSON.stringify(items));
  } catch {}
}

/** Same canonical dedupe rules as `readRecentCitiesFromStorage`, for rows we just wrote to storage. */
function recentCityEntriesFromStorageWriteShape(
  items: Array<{ slug: string; areaLabel: string; visitedAt: number }>
): RecentCityEntry[] {
  const uniqueBySlug = new Map<string, RecentCityEntry>();
  for (const item of items) {
    if (!item.slug) continue;
    const canonicalSlug = getCanonicalCitySlug(item.slug) || item.slug;
    if (uniqueBySlug.has(canonicalSlug)) continue;
    uniqueBySlug.set(canonicalSlug, {
      canonicalSlug,
      areaLabel: item.areaLabel || canonicalSlug,
      visitedAt: item.visitedAt || 0,
    });
  }
  return Array.from(uniqueBySlug.values()).slice(0, MAX_RECENT_CITIES);
}

function getFocusableElements(container: Element | null): HTMLElement[] {
  if (!container) return [];
  const nodes = Array.from(
    container.querySelectorAll<HTMLElement>(
      [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
        '[contenteditable="true"]',
      ].join(',')
    )
  );

  return nodes.filter((el) => {
    if (!el || typeof el.focus !== 'function') return false;
    const style = window.getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none') return false;
    if (el.closest('[aria-hidden="true"]')) return false;
    return true;
  });
}

function isElementConnected(el: Element | null): el is Element {
  return !!(el && (el.isConnected || document.contains(el)));
}

/**
 * Mapbox geocoder mounts into the modal asynchronously; the modal root must also be
 * visibility:visible (see CitySwitcherModal.css) or focus will not stick.
 */
function focusCityPickerSearchInput(attempt = 0): void {
  if (attempt > 80) return;
  if (!document.body.classList.contains('show-city-picker')) return;

  const modalRoot = document.querySelector('.city-switcher-modal');
  if (modalRoot && getComputedStyle(modalRoot).visibility === 'hidden') {
    window.setTimeout(() => focusCityPickerSearchInput(attempt + 1), 16);
    return;
  }

  const input = document.querySelector(CITY_PICKER_INPUT_SELECTOR);
  if (input instanceof HTMLElement && typeof input.focus === 'function') {
    try {
      input.focus({ preventScroll: true });
    } catch {
      input.focus();
    }
    if (document.activeElement === input) {
      return;
    }
  }

  window.setTimeout(() => focusCityPickerSearchInput(attempt + 1), 50);
}

function getCountryLabelPt(countryCode: string | null | undefined): string {
  if (!countryCode) return 'Outros';
  return SUPPORTED_COUNTRY_LABEL_PT_BY_CODE[countryCode] || 'Outros';
}

function getPrimaryAreaMeta(restParts: string[]): string {
  const parts = Array.isArray(restParts)
    ? restParts.map((s) => String(s || '').trim()).filter(Boolean)
    : [];
  if (parts.length === 0) return '';
  return parts[0];
}

function sumLengthsToKm(lengths: unknown): number | null {
  const obj = lengths && typeof lengths === 'object' ? (lengths as Record<string, unknown>) : {};
  const total = LENGTH_COUNTED_LAYER_IDS.reduce((sum, layerId) => {
    const value = Number(obj[layerId]);
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);
  return Number.isFinite(total) && total > 0 ? total : null;
}

/** Positive per-layer km for charting (same layers as `sumLengthsToKm`). */
function lengthsKmByLayerFromFirestoreLengths(lengths: unknown): Record<string, number> | null {
  const obj = lengths && typeof lengths === 'object' ? (lengths as Record<string, unknown>) : {};
  const out: Record<string, number> = {};
  for (const layerId of LENGTH_COUNTED_LAYER_IDS) {
    const v = Number(obj[layerId]);
    if (Number.isFinite(v) && v >= 0) out[layerId] = v;
  }
  const sum = Object.values(out).reduce((a, b) => a + b, 0);
  return sum > 0 ? out : null;
}

/**
 * Firestore `stats` doc ids to try for this city, in order. Canonical slug first (matches `saveStatsToFirestore`).
 */
function getStatsDocIdTryOrder(cityObj: StatsCityLike | null | undefined): string[] {
  const ordered: string[] = [];
  const seen = new Set<string>();

  const push = (value: string | undefined) => {
    if (!value) return;
    const s = slugify(String(value));
    if (!s || seen.has(s)) return;
    seen.add(s);
    ordered.push(s);
  };

  if (!cityObj) return ordered;

  const canonicalSlug = getCanonicalCitySlug(cityObj.canonicalSlug || cityObj.slug || '');
  const def = canonicalSlug ? getPredefinedCitySlugDefinition(canonicalSlug) : null;

  push(canonicalSlug);
  push(cityObj.areaLabel);
  push(cityObj.name);
  push(cityObj.meta ? `${cityObj.name}, ${cityObj.meta}` : '');
  push(def?.query);
  push(def?.staticLocation?.areaLabel);

  return ordered;
}

function statsCacheEntryFromDoc(docData: unknown, fetchedAt: number): StatsTotalsCacheEntry {
  const lengths =
    docData && typeof docData === 'object' && 'lengths' in docData
      ? (docData as { lengths?: unknown }).lengths
      : undefined;
  const value = sumLengthsToKm(lengths);
  const lengthsKmByLayer = value !== null ? lengthsKmByLayerFromFirestoreLengths(lengths) : null;
  return { value, fetchedAt, lengthsKmByLayer };
}

type CityStatsPreloadTask = {
  canonicalSlug: string;
  cityObj: StatsCityLike;
  tryOrder: string[];
};

function buildUniqueCityStatsPreloadTasks(cityObjs: StatsCityLike[]): CityStatsPreloadTask[] {
  const seen = new Set<string>();
  const tasks: CityStatsPreloadTask[] = [];
  for (const c of Array.isArray(cityObjs) ? cityObjs : []) {
    const canonicalSlug = getCanonicalCitySlug(c.canonicalSlug || c.slug || '') || '';
    if (!canonicalSlug || seen.has(canonicalSlug)) continue;
    const tryOrder = getStatsDocIdTryOrder(c);
    if (tryOrder.length === 0) continue;
    seen.add(canonicalSlug);
    tasks.push({ canonicalSlug, cityObj: c, tryOrder });
  }
  return tasks;
}

function cityStatsCacheNeedsFetch(canonicalSlug: string, tryOrder: string[], now: number): boolean {
  if (tryOrder.length === 0) return false;
  const cached = statsTotalsByCanonicalSlugCache.get(canonicalSlug);
  if (!cached) return true;
  const age = now - cached.fetchedAt;
  if (cached.value !== null) {
    return age > STATS_TOTALS_SUCCESS_TTL_MS;
  }
  return age > STATS_TOTALS_MISS_TTL_MS;
}

async function resolveCityStatsKmForSlug(
  storage: Storage,
  canonicalSlug: string,
  tryOrder: string[],
  now: number
): Promise<void> {
  if (tryOrder.length === 0) return;

  const previous = statsTotalsByCanonicalSlugCache.get(canonicalSlug);

  for (const docId of tryOrder) {
    const docData = await storage.getCityStatsDoc(docId);
    const entry = statsCacheEntryFromDoc(docData, now);
    if (typeof entry.value === 'number') {
      statsTotalsByCanonicalSlugCache.set(canonicalSlug, entry);
      schedulePersistStatsKmCache();
      return;
    }
  }

  if (typeof previous?.value === 'number') {
    // Revalidation found no usable doc (offline / doc removed). Keep the last km; bump fetchedAt so we
    // do not hammer Firestore on every picker open while still older than SUCCESS_TTL.
    statsTotalsByCanonicalSlugCache.set(canonicalSlug, {
      value: previous.value,
      fetchedAt: now,
      lengthsKmByLayer:
        previous.lengthsKmByLayer !== undefined ? previous.lengthsKmByLayer : undefined,
    });
    schedulePersistStatsKmCache();
    return;
  }

  statsTotalsByCanonicalSlugCache.set(canonicalSlug, {
    value: null,
    fetchedAt: now,
    lengthsKmByLayer: null,
  });
  schedulePersistStatsKmCache();
}

async function preloadStatsTotalsForCities(
  cityObjs: StatsCityLike[],
  options?: { onCacheUpdate?: () => void }
): Promise<void> {
  const now = Date.now();
  const tasks = buildUniqueCityStatsPreloadTasks(cityObjs).filter((t) =>
    cityStatsCacheNeedsFetch(t.canonicalSlug, t.tryOrder, now)
  );

  if (tasks.length === 0) return;

  const storage = new Storage();
  const concurrency = Math.min(STATS_FETCH_CONCURRENCY, tasks.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const i = nextIndex++;
      if (i >= tasks.length) return;
      const { canonicalSlug, tryOrder } = tasks[i];
      await resolveCityStatsKmForSlug(storage, canonicalSlug, tryOrder, now);
      options?.onCacheUpdate?.();
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  flushPersistStatsKmCache();
}

function getRealCityTotalLength(
  cityObj: StatsCityLike | null | undefined,
  totalsByCanonicalSlug: Map<string, StatsTotalsCacheEntry>
): number | null {
  if (!cityObj || !totalsByCanonicalSlug) return null;
  const canonicalSlug = getCanonicalCitySlug(cityObj.canonicalSlug || cityObj.slug || '');
  if (!canonicalSlug) return null;
  const entry = totalsByCanonicalSlug.get(canonicalSlug);
  return entry && typeof entry.value === 'number' ? entry.value : null;
}

function getRealCityLengthsKmByLayer(
  cityObj: StatsCityLike | null | undefined,
  totalsByCanonicalSlug: Map<string, StatsTotalsCacheEntry>
): Record<string, number> | null {
  if (!cityObj || !totalsByCanonicalSlug) return null;
  const canonicalSlug = getCanonicalCitySlug(cityObj.canonicalSlug || cityObj.slug || '');
  if (!canonicalSlug) return null;
  const entry = totalsByCanonicalSlug.get(canonicalSlug);
  const raw = entry?.lengthsKmByLayer;
  if (!raw || typeof raw !== 'object') return null;
  return raw;
}

function shouldShowTotalSkeleton(
  cityObj: StatsCityLike | null | undefined,
  totalsByCanonicalSlug: Map<string, StatsTotalsCacheEntry>,
  isLoadingTotals: boolean
): boolean {
  if (!isLoadingTotals) return false;
  const canonicalSlug = getCanonicalCitySlug(cityObj?.canonicalSlug || cityObj?.slug || '');
  if (!canonicalSlug) return false;
  return !totalsByCanonicalSlug.has(canonicalSlug);
}

function attachCityStatsTotals(
  cityObj: StatsCityLike,
  totalsByCanonicalSlug: Map<string, StatsTotalsCacheEntry>,
  isLoadingTotals: boolean
): {
  totalLength: number | null;
  isLoadingTotal: boolean;
  lengthsKmByLayer: Record<string, number> | null;
} {
  const totalLength = getRealCityTotalLength(cityObj, totalsByCanonicalSlug);
  const isLoadingTotal =
    typeof totalLength !== 'number' &&
    shouldShowTotalSkeleton(cityObj, totalsByCanonicalSlug, isLoadingTotals);
  const lengthsKmByLayer = getRealCityLengthsKmByLayer(cityObj, totalsByCanonicalSlug);
  return { totalLength, isLoadingTotal, lengthsKmByLayer };
}

function usePreloadedStatsTotalsByCanonicalSlug(cityObjs: StatsCityLike[], isPickerOpen: boolean) {
  const [statsTotalsByCanonicalSlug, setStatsTotalsByCanonicalSlug] = useState(
    () => new Map(statsTotalsByCanonicalSlugCache)
  );
  const [isLoadingTotals, setIsLoadingTotals] = useState(false);
  const effectGenerationRef = useRef(0);

  useEffect(() => {
    if (!isPickerOpen) {
      setIsLoadingTotals(false);
      return;
    }

    effectGenerationRef.current += 1;
    const myGeneration = effectGenerationRef.current;
    const list = Array.isArray(cityObjs) ? cityObjs : [];

    setIsLoadingTotals(true);
    const applyCacheToState = () => {
      if (effectGenerationRef.current !== myGeneration) return;
      setStatsTotalsByCanonicalSlug(new Map(statsTotalsByCanonicalSlugCache));
    };
    if (!statsTotalsLoadPromise) {
      statsTotalsLoadPromise = preloadStatsTotalsForCities(list, {
        onCacheUpdate: applyCacheToState,
      }).finally(() => {
        statsTotalsLoadPromise = null;
      });
    } else {
      statsTotalsLoadPromise = statsTotalsLoadPromise.then(() =>
        preloadStatsTotalsForCities(list, { onCacheUpdate: applyCacheToState })
      );
    }

    void Promise.resolve(statsTotalsLoadPromise)
      .then(() => {
        if (effectGenerationRef.current !== myGeneration) return;
        setStatsTotalsByCanonicalSlug(new Map(statsTotalsByCanonicalSlugCache));
        setIsLoadingTotals(false);
      })
      .catch((err: unknown) => {
        if (effectGenerationRef.current !== myGeneration) return;
        console.warn(CITY_SWITCHER_LOG_PREFIX, 'stats preload failed', err);
        setIsLoadingTotals(false);
      });

    return () => {
      if (effectGenerationRef.current === myGeneration) {
        effectGenerationRef.current += 1;
      }
    };
  }, [cityObjs, isPickerOpen]);

  return { statsTotalsByCanonicalSlug, isLoadingTotals };
}

type PlacesAutocompleteSearchOptions = NonNullable<
  Parameters<typeof searchPlacesForAutocomplete>[1]
>;

/** Debounced Google Places predictions for the city picker search field (single consumer). */
function usePlacesAutocompleteSearch({
  debounceMs = 280,
  getAutocompleteOptions,
}: {
  debounceMs?: number;
  getAutocompleteOptions: () => PlacesAutocompleteSearchOptions;
}) {
  const [suggestions, setSuggestions] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceTimerRef = useRef<number | null>(null);
  const getOptionsRef = useRef(getAutocompleteOptions);
  getOptionsRef.current = getAutocompleteOptions;

  const clearResults = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    setSuggestions([]);
    setLoading(false);
  }, []);

  const scheduleSearch = useCallback(
    (q: string) => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      const trimmed = q.trim();
      if (trimmed.length < PLACES_AUTOCOMPLETE_MIN_QUERY_LENGTH) {
        setSuggestions([]);
        setLoading(false);
        return;
      }
      debounceTimerRef.current = window.setTimeout(async () => {
        debounceTimerRef.current = null;
        setLoading(true);
        try {
          const results = await searchPlacesForAutocomplete(trimmed, getOptionsRef.current());
          setSuggestions(Array.isArray(results) ? results : []);
        } catch (e) {
          console.warn(CITY_SWITCHER_LOG_PREFIX, 'places search failed', e);
          setSuggestions([]);
        } finally {
          setLoading(false);
        }
      }, debounceMs);
    },
    [debounceMs]
  );

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return { suggestions, loading, scheduleSearch, clearResults } as const;
}

function useCityPickerFocusAndRestore({
  contentScrollElRef,
}: {
  contentScrollElRef: React.RefObject<HTMLDivElement | null>;
}) {
  const lastFocusedBeforeOpenRef = useRef<Element | null>(null);
  const cityPickerWasOpenRef = useRef(false);

  useLayoutEffect(() => {
    const body = document.body;
    if (!body) return undefined;

    const onBodyClassChange = () => {
      const open = body.classList.contains('show-city-picker');
      if (open && !cityPickerWasOpenRef.current) {
        console.debug(CITY_SWITCHER_LOG_PREFIX, 'opened');
        lastFocusedBeforeOpenRef.current = document.activeElement;
        const el = contentScrollElRef.current;
        if (el) el.scrollTop = 0;
        window.requestAnimationFrame(() => {
          focusCityPickerSearchInput();
        });
      }
      if (!open && cityPickerWasOpenRef.current) {
        console.debug(CITY_SWITCHER_LOG_PREFIX, 'closed');
        const toFocus = lastFocusedBeforeOpenRef.current;
        lastFocusedBeforeOpenRef.current = null;
        if (
          isElementConnected(toFocus) &&
          toFocus instanceof HTMLElement &&
          typeof toFocus.focus === 'function'
        ) {
          try {
            toFocus.focus({ preventScroll: true });
          } catch {
            toFocus.focus();
          }
        }
      }
      cityPickerWasOpenRef.current = open;
    };

    const observer = new MutationObserver(onBodyClassChange);
    observer.observe(body, { attributes: true, attributeFilter: ['class'] });
    onBodyClassChange();

    return () => observer.disconnect();
  }, [contentScrollElRef]);
}

function useCityPickerKeyboardTrap({
  panelRef,
  closeCityPicker,
}: {
  panelRef: React.RefObject<HTMLDivElement | null>;
  closeCityPicker: () => void;
}) {
  useEffect(() => {
    const body = document.body;
    if (!body) return undefined;

    const onKeyDown = (e: KeyboardEvent) => {
      const open = body.classList.contains('show-city-picker');
      if (!open) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeCityPicker();
        return;
      }

      if (e.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusables = getFocusableElements(panel);

      if (focusables.length === 0) {
        e.preventDefault();
        try {
          panel.focus({ preventScroll: true });
        } catch {
          panel.focus();
        }
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (e.shiftKey) {
        if (active === first || !panel.contains(active)) {
          e.preventDefault();
          try {
            last.focus({ preventScroll: true });
          } catch {
            last.focus();
          }
        }
      } else if (active === last) {
        e.preventDefault();
        try {
          first.focus({ preventScroll: true });
        } catch {
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [panelRef, closeCityPicker]);
}

type PickableCity = CityWithStats | RecentCityWithStats;

type CityPickerRowModel = {
  canonicalSlug: string;
  name: string;
  meta: string;
  totalLength: number | null;
  isLoadingTotal: boolean;
  lengthsKmByLayer: Record<string, number> | null;
};

type CitySwitcherInfraLayer = {
  id: string;
  style?: {
    lineStyle?: string;
    lineColor?: string;
  };
};

function useBodyThemeIsDark(): boolean {
  const [isDark, setIsDark] = useState(
    () => typeof document !== 'undefined' && document.body.classList.contains('theme-dark')
  );
  useLayoutEffect(() => {
    const sync = () => setIsDark(document.body.classList.contains('theme-dark'));
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    sync();
    return () => observer.disconnect();
  }, []);
  return isDark;
}

function miniChartSliceTotalKm(lengthsKmByLayer: Record<string, number>): number {
  return CITY_SWITCHER_MINI_CHART_LAYER_IDS.reduce((sum, id) => {
    const v = Number(lengthsKmByLayer[id]);
    return Number.isFinite(v) && v > 0 ? sum + v : sum;
  }, 0);
}

/** Degrees clockwise from top (12 o’clock); 0° = top center. */
function polarOnRing(
  cx: number,
  cy: number,
  r: number,
  degCwFromTop: number
): { x: number; y: number } {
  const rad = ((degCwFromTop - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/**
 * Circular arc along one radius (stroke only). `sweepFlag` 1 = clockwise on screen (SVG y-down).
 */
function ringArcD(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const start = polarOnRing(cx, cy, r, startDeg);
  const end = polarOnRing(cx, cy, r, endDeg);
  const delta = endDeg - startDeg;
  const largeArc = delta > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

const CITY_INFRA_RING_SIZE = 18;
const CITY_INFRA_RING_CX = CITY_INFRA_RING_SIZE / 2;
const CITY_INFRA_RING_CY = CITY_INFRA_RING_SIZE / 2;
const CITY_INFRA_RING_R = CITY_INFRA_RING_SIZE / 2;
const CITY_INFRA_RING_STROKE = 2;
/** Angular gap left empty between coloured segments. */
const CITY_INFRA_RING_GAP_DEG = 32;
/** When only one layer has length, opening (no background ring — just empty space). */
const CITY_INFRA_RING_SINGLE_OPENING_DEG = 32;
/** Trim each arc at both ends (deg) so round stroke caps don’t spill into the gap between segments. */
const CITY_INFRA_RING_CAP_TRIM_DEG = 2;

/**
 * Thin circular chart: ciclovia / ciclofaixa only, rounded stroke arcs, wide gaps, no track/background.
 * testid kept as `city-switcher-mini-pie` for tests.
 */
function CityInfraMiniRing({
  lengthsKmByLayer,
  infraLayers,
}: {
  lengthsKmByLayer: Record<string, number>;
  infraLayers: CitySwitcherInfraLayer[];
}) {
  const byId = Object.fromEntries(infraLayers.map((l) => [l.id, l]));
  const segments = CITY_SWITCHER_MINI_CHART_LAYER_IDS.map((id) => {
    const raw = Number(lengthsKmByLayer[id]);
    const km = Number.isFinite(raw) && raw > 0 ? raw : 0;
    const layer = byId[id];
    const color = layer?.style?.lineColor || (id === 'ciclovia' ? '#386641' : '#A7C957');
    return { id, km, color };
  }).filter((s) => s.km > 0);

  const totalKm = segments.reduce((sum, s) => sum + s.km, 0);
  if (totalKm <= 0) return null;

  const n = segments.length;
  const gapTotalDeg = n === 1 ? CITY_INFRA_RING_SINGLE_OPENING_DEG : n * CITY_INFRA_RING_GAP_DEG;
  const availDeg = 360 - gapTotalDeg;
  const trimBase = n > 1 ? CITY_INFRA_RING_CAP_TRIM_DEG : CITY_INFRA_RING_CAP_TRIM_DEG * 0.75;

  let cursor = 0;
  const arcs: { id: string; d: string; color: string }[] = [];
  for (let i = 0; i < n; i++) {
    const seg = segments[i];
    const span = (seg.km / totalKm) * availDeg;
    const trim = Math.min(trimBase, Math.max(0, span / 2 - 0.75));
    const arcStart = cursor + trim;
    const arcEnd = cursor + span - trim;
    if (arcEnd > arcStart) {
      arcs.push({
        id: seg.id,
        d: ringArcD(CITY_INFRA_RING_CX, CITY_INFRA_RING_CY, CITY_INFRA_RING_R, arcStart, arcEnd),
        color: seg.color,
      });
    }
    const gapAfter = n === 1 ? CITY_INFRA_RING_SINGLE_OPENING_DEG : CITY_INFRA_RING_GAP_DEG;
    cursor += span + gapAfter;
  }

  return (
    <div
      className="city-switcher-modal__cityInfraRing"
      data-testid="city-switcher-mini-pie"
      aria-hidden
    >
      <svg
        width={CITY_INFRA_RING_SIZE}
        height={CITY_INFRA_RING_SIZE}
        viewBox={`0 0 ${CITY_INFRA_RING_SIZE} ${CITY_INFRA_RING_SIZE}`}
        className="city-switcher-modal__cityInfraRingSvg"
      >
        {/* Horizontal mirror so segments grow counter‑clockwise from the chart’s start (toward the left). */}
        <g
          transform={`translate(${CITY_INFRA_RING_CX} ${CITY_INFRA_RING_CY}) scale(-1, 1) translate(${-CITY_INFRA_RING_CX} ${-CITY_INFRA_RING_CY})`}
        >
          {arcs.map((a) => (
            <path
              key={a.id}
              d={a.d}
              fill="none"
              stroke={a.color}
              strokeWidth={CITY_INFRA_RING_STROKE}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </g>
      </svg>
    </div>
  );
}

/** Same ring geometry as `CityInfraMiniRing` (radius, stroke width, caps); neutral stroke only = “empty” chart. */
function CityInfraMiniRingPlaceholder() {
  const s = CITY_INFRA_RING_SIZE;
  const c = CITY_INFRA_RING_CX;
  const r = CITY_INFRA_RING_R;
  return (
    <div
      className="city-switcher-modal__cityInfraRing city-switcher-modal__cityInfraRing--placeholder"
      data-testid="city-switcher-ring-placeholder"
      aria-hidden
    >
      <svg
        width={s}
        height={s}
        viewBox={`0 0 ${s} ${s}`}
        className="city-switcher-modal__cityInfraRingSvg"
      >
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          strokeWidth={CITY_INFRA_RING_STROKE}
          strokeLinecap="round"
          className="city-switcher-modal__cityInfraRingPlaceholderStroke"
        />
      </svg>
    </div>
  );
}

function CityPickerCityCard({
  city,
  stagger,
  to,
  onActivate,
  infraLayers,
}: {
  city: CityPickerRowModel;
  stagger: number;
  to: string;
  onActivate: () => void;
  infraLayers: CitySwitcherInfraLayer[];
}) {
  const hasRingData =
    typeof city.totalLength === 'number' &&
    city.lengthsKmByLayer &&
    miniChartSliceTotalKm(city.lengthsKmByLayer) > 0;

  return (
    <div
      className="city-switcher-modal__cityCardWrap city-switcher-modal__staggerEnter"
      style={{ '--city-content-stagger': stagger } as React.CSSProperties}
      role="listitem"
    >
      <Link
        to={to}
        className="city-switcher-modal__cityBtn"
        data-city-slug={city.canonicalSlug}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          onActivate();
        }}
      >
        <div className="city-switcher-modal__cityTopRow">
          {hasRingData && city.lengthsKmByLayer ? (
            <CityInfraMiniRing lengthsKmByLayer={city.lengthsKmByLayer} infraLayers={infraLayers} />
          ) : (
            <CityInfraMiniRingPlaceholder />
          )}
          <div className="city-switcher-modal__cityNameWrap">
            <div className="city-switcher-modal__cityName">{city.name}</div>
            {city.meta ? <div className="city-switcher-modal__cityMeta">{city.meta}</div> : null}
          </div>
          {typeof city.totalLength === 'number' || city.isLoadingTotal ? (
            <div className="city-switcher-modal__cityMetrics">
              {typeof city.totalLength === 'number' ? (
                <div
                  className="city-switcher-modal__cityTotal"
                  data-city-total-km={city.totalLength.toFixed(0)}
                >
                  {appendKmUnit(city.totalLength.toFixed(0))}
                </div>
              ) : city.isLoadingTotal ? (
                <div className="city-switcher-modal__cityTotal" aria-hidden="true">
                  <span className="city-switcher-modal__cityTotalSkeleton" />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </Link>
    </div>
  );
}

/** Options forwarded to {@link searchPlacesForAutocomplete} (proximity and limit are set by the modal). */
export type CitySwitcherPlacesAutocompleteOptions = {
  types?: string[];
  exclude?: {
    adminRegions?: boolean | string[] | null;
    bareCity?: boolean;
  };
  countryCodes?: string[];
  radius?: number;
  language?: string;
  region?: string;
};

export type CitySwitcherModalProps = {
  mapCenter?: { lat: number; lng: number } | null;
  /** e.g. `types`, `exclude`; modal defaults to `exclude: { bareCity: false }` so cities stay visible */
  placesAutocompleteOptions?: CitySwitcherPlacesAutocompleteOptions;
  onPlacesResultSelected?: (payload: {
    lng: number;
    lat: number;
    /**
     * City + state + country for app `state.area` (`getAreaStringFromResultLike` shape),
     * never a street-only line.
     */
    areaContext: string;
    title: string;
    address: string;
    /** Google Places `types` from resolved details (drives the same icon as the dropdown). */
    placeTypes?: string[];
    /** Google `place_id` or suggestion id when available (favorites + global search pin). */
    placeId?: string;
  }) => void;
  onCatalogCityPicked?: () => void;
  onFavoritesChanged?: (favorites: FavoriteItem[]) => void;
};

type PlacesSuggestionRow = {
  id: string;
  place_name: string;
  properties?: {
    place_id?: string;
    types?: string[];
    structured_formatting?: { main_text?: string; secondary_text?: string };
    formatted_address?: string;
    name?: string;
    address_components?: unknown[];
  };
};

/** Shape after {@link geocodePlacesSuggestionToResult} (shared with DirectionsPanel). */
type GeocodedPlaceResult = PlacesSuggestionRow & {
  center?: [number, number];
};

function placeSearchRowKey(s: PlacesSuggestionRow): string | undefined {
  return s.properties?.place_id || s.id || undefined;
}

function isPlaceSearchRowFavorited(s: PlacesSuggestionRow, favorites: FavoriteItem[]): boolean {
  const key = placeSearchRowKey(s);
  if (!key) return false;
  return favorites.some((f) => f.placeId === key);
}

function CitySwitcherModal({
  mapCenter = null,
  placesAutocompleteOptions,
  onPlacesResultSelected,
  onCatalogCityPicked,
  onFavoritesChanged,
}: CitySwitcherModalProps = {}) {
  const { city } = useParams();

  const topCityBase = useMemo<TopCityBase[]>(() => {
    return TOP_CITY_SLUGS.map((slug) => {
      const canonicalSlug = getCanonicalCitySlug(slug);
      const def =
        getPredefinedCitySlugDefinition(slug) || getPredefinedCitySlugDefinition(canonicalSlug);

      const areaLabel = def?.staticLocation?.areaLabel || def?.query || canonicalSlug;
      const [name, ...rest] = String(areaLabel)
        .split(',')
        .map((s) => s.trim());
      const meta = getPrimaryAreaMeta(rest);
      const countryCode = Array.isArray(def?.countrycodes) ? def.countrycodes[0] : null;

      return { canonicalSlug, name, meta, areaLabel, countryCode };
    });
  }, []);

  const countryOrder = useMemo(() => {
    const seen = new Set<string>();
    const order: string[] = [];
    topCityBase.forEach((c) => {
      if (!c.countryCode) return;
      if (seen.has(c.countryCode)) return;
      seen.add(c.countryCode);
      order.push(c.countryCode);
    });
    const priority = new Map(SUPPORTED_COUNTRY_CODES.map((code, i) => [code, i]));
    order.sort((a, b) => (priority.get(a) ?? 999) - (priority.get(b) ?? 999));
    return order;
  }, [topCityBase]);

  const [recentCityEntries, setRecentCityEntries] = useState(() => readRecentCitiesFromStorage());
  const [recentItems, setRecentItems] = useState<RecentItem[]>(() => readRecentItems());
  const [favorites, setFavorites] = useState<FavoriteItem[]>(() => readFavorites());

  const recentItemsDisplayed = useMemo(
    () => recentItems.slice(0, MAX_RECENT_ITEMS_DISPLAY),
    [recentItems]
  );

  const [globalSearchValue, setGlobalSearchValue] = useState('');

  const getCitySwitcherAutocompleteOptions = useCallback(
    () => getCitySwitcherPlacesSearchOptions(mapCenter, placesAutocompleteOptions),
    [mapCenter, placesAutocompleteOptions]
  );

  const {
    suggestions: placesSuggestions,
    loading: placesSearchLoading,
    scheduleSearch: schedulePlacesSearch,
    clearResults: clearPlacesSearch,
  } = usePlacesAutocompleteSearch({
    getAutocompleteOptions: getCitySwitcherAutocompleteOptions,
  });

  const [isCityPickerOpen, setIsCityPickerOpen] = useState(
    () => typeof document !== 'undefined' && document.body.classList.contains('show-city-picker')
  );

  useLayoutEffect(() => {
    const body = document.body;
    if (!body) return undefined;
    const sync = () => {
      setIsCityPickerOpen(body.classList.contains('show-city-picker'));
    };
    const observer = new MutationObserver(sync);
    observer.observe(body, { attributes: true, attributeFilter: ['class'] });
    sync();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isCityPickerOpen) {
      setGlobalSearchValue('');
      clearPlacesSearch();
    } else {
      setRecentItems(readRecentItems());
      setFavorites(readFavorites());
    }
  }, [isCityPickerOpen, clearPlacesSearch]);

  useEffect(() => {
    console.debug(CITY_SWITCHER_LOG_PREFIX, 'reload recent cities from storage', {
      routeCity: city,
    });
    const next = readRecentCitiesFromStorage();
    setRecentCityEntries((prev) => (recentCityEntriesEqual(prev, next) ? prev : next));
  }, [city]);

  const statsCityCandidates = useMemo((): StatsCityLike[] => {
    return [...topCityBase, ...recentCityEntries];
  }, [topCityBase, recentCityEntries]);

  const { statsTotalsByCanonicalSlug, isLoadingTotals } = usePreloadedStatsTotalsByCanonicalSlug(
    statsCityCandidates,
    isCityPickerOpen
  );

  const topCities = useMemo<CityWithStats[]>(() => {
    return topCityBase.map((c) => {
      const cityObj: StatsCityLike = {
        canonicalSlug: c.canonicalSlug,
        areaLabel: c.areaLabel,
        name: c.name,
        meta: c.meta,
      };
      const { totalLength, isLoadingTotal, lengthsKmByLayer } = attachCityStatsTotals(
        cityObj,
        statsTotalsByCanonicalSlug,
        isLoadingTotals
      );
      return { ...c, totalLength, isLoadingTotal, lengthsKmByLayer };
    });
  }, [topCityBase, statsTotalsByCanonicalSlug, isLoadingTotals]);

  const topCitiesByCountry = useMemo<CountryGroup[]>(() => {
    const map = new Map<string, CountryGroup>();
    topCities.forEach((cityRow) => {
      const code = cityRow.countryCode || 'other';
      if (!map.has(code)) {
        map.set(code, {
          countryCode: code,
          countryLabel: getCountryLabelPt(code === 'other' ? null : code),
          cities: [],
        });
      }
      map.get(code)!.cities.push(cityRow);
    });

    return countryOrder
      .map((code) => map.get(code))
      .filter((g): g is CountryGroup => Boolean(g))
      .concat(map.has('other') ? [map.get('other')!] : []);
  }, [topCities, countryOrder]);

  const themeIsDark = useBodyThemeIsDark();
  const infraLayersForMiniPie = useMemo((): CitySwitcherInfraLayer[] => {
    const layers = OSMController.getLayers(themeIsDark, false) as CitySwitcherInfraLayer[];
    const byId = Object.fromEntries(layers.map((l) => [l.id, l]));
    return CITY_SWITCHER_MINI_CHART_LAYER_IDS.map((id) => byId[id]).filter(Boolean);
  }, [themeIsDark]);

  const closeCityPicker = useCallback(() => {
    const body = document.querySelector('body');
    if (body) body.classList.remove('show-city-picker');
  }, []);

  const recordRecentlyVisitedCity = useCallback(
    (nextSlug: string, areaLabel: string | undefined) => {
      setRecentCityEntries((prev) => {
        const now = Date.now();
        const nextItems = [
          { slug: nextSlug, areaLabel: areaLabel || nextSlug, visitedAt: now },
          ...prev
            .filter((item) => item?.canonicalSlug && item.canonicalSlug !== nextSlug)
            .map((item) => ({
              slug: item.canonicalSlug,
              areaLabel: item.areaLabel,
              visitedAt: item.visitedAt,
            })),
        ].slice(0, MAX_RECENT_CITIES);

        writeRecentCitiesToStorage(nextItems);
        return recentCityEntriesFromStorageWriteShape(nextItems);
      });

      setRecentItems(addRecentCity(nextSlug, areaLabel || nextSlug));
    },
    []
  );

  const recordRecentPlace = useCallback(
    (place: {
      lng: number;
      lat: number;
      title: string;
      subtitle: string;
      placeTypes?: string[];
      areaContext?: string;
    }) => {
      setRecentItems(addRecentPlace(place));
    },
    []
  );

  const handleToggleFavorite = useCallback(
    (fav: Omit<FavoriteItem, 'id' | 'addedAt'>) => {
      const { favorites: next } = toggleFavorite(fav);
      setFavorites(next);
      onFavoritesChanged?.(next);
    },
    [onFavoritesChanged]
  );

  const globalSearchPlaceholder = useMemo(() => {
    const labelsPt = SUPPORTED_COUNTRIES.map((c) => c.labelPt);
    const suffix =
      labelsPt.length === 0
        ? 'no mundo'
        : labelsPt.length === 1
          ? `em ${labelsPt[0]}`
          : `em ${labelsPt.slice(0, -1).join(', ')} e ${labelsPt[labelsPt.length - 1]}`;
    return IS_PROD ? `Buscar endereço ou local ${suffix}` : 'Buscar endereço ou local no mundo';
  }, []);

  const handlePlaceSuggestionPick = useCallback(
    async (sug: PlacesSuggestionRow) => {
      try {
        const { result: resolvedRaw } = await geocodePlacesSuggestionToResult(sug);
        const resolved = resolvedRaw as GeocodedPlaceResult;
        if (!resolved.center) {
          console.error(CITY_SWITCHER_LOG_PREFIX, 'place resolve missing center', resolved);
          return;
        }
        const [lng, lat] = resolved.center;
        const { formatted_address: formattedAddress, name: resolvedName } =
          resolved.properties ?? {};
        const areaContext = getAreaStringFromResultLike(resolved) || '';
        const title = resolvedName || resolved.place_name || '';
        const addressLine = formattedAddress || '';
        onPlacesResultSelected?.({
          lng,
          lat,
          areaContext,
          title,
          address: addressLine,
          placeTypes: resolved.properties?.types,
          placeId: resolved.properties?.place_id || sug.id || '',
        });
        recordRecentPlace({
          lng,
          lat,
          title,
          subtitle: addressLine || areaContext,
          placeTypes: resolved.properties?.types,
          areaContext,
        });
        closeCityPicker();
        setGlobalSearchValue('');
        clearPlacesSearch();
      } catch (e) {
        console.error(CITY_SWITCHER_LOG_PREFIX, 'place details failed', e);
      }
    },
    [clearPlacesSearch, closeCityPicker, onPlacesResultSelected, recordRecentPlace]
  );

  /** Runs when the user follows a city link in this tab (navigation is handled by the link `to`). */
  const onCityLinkActivate = useCallback(
    (cityObj: PickableCity, source: 'recent' | 'top') => {
      const nextSlug = cityObj?.canonicalSlug;
      if (!nextSlug) {
        console.debug(CITY_SWITCHER_LOG_PREFIX, 'pick ignored: missing canonicalSlug', {
          source,
          cityObj,
        });
        return;
      }

      console.debug(CITY_SWITCHER_LOG_PREFIX, 'pick city', {
        source,
        slug: nextSlug,
        areaLabel: cityObj?.areaLabel,
      });

      onCatalogCityPicked?.();
      setGlobalSearchValue('');
      clearPlacesSearch();

      recordRecentlyVisitedCity(nextSlug, cityObj?.areaLabel);

      closeCityPicker();
    },
    [recordRecentlyVisitedCity, closeCityPicker, onCatalogCityPicked, clearPlacesSearch]
  );

  const contentScrollElRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useCityPickerFocusAndRestore({ contentScrollElRef });
  useCityPickerKeyboardTrap({ panelRef, closeCityPicker });

  const trimmedGlobalSearch = globalSearchValue.trim();
  const showPlaceSearchResults = trimmedGlobalSearch.length >= PLACES_AUTOCOMPLETE_MIN_QUERY_LENGTH;
  const placeSuggestionList = placesSuggestions as PlacesSuggestionRow[];

  const placeSearchResultsEnteredRef = useRef(false);
  useEffect(() => {
    if (!showPlaceSearchResults) {
      placeSearchResultsEnteredRef.current = false;
      return;
    }
    if (placeSearchResultsEnteredRef.current) return;
    placeSearchResultsEnteredRef.current = true;
    const el = contentScrollElRef.current;
    if (!el) return;
    el.scrollTo({ top: 0, behavior: 'smooth' });
  }, [showPlaceSearchResults]);

  let contentStaggerIndex = 0;

  /** Portaled to `document.body` so `#ciclomapa { overflow: hidden }` does not clip this overlay. */
  const modalTree = (
    <div
      className="city-switcher-modal fixed inset-0"
      role="dialog"
      aria-modal="true"
      data-testid="city-switcher-dialog"
      aria-label="Selecionar cidade"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeCityPicker();
      }}
    >
      <div
        ref={panelRef}
        className="city-switcher-modal__panel relative z-10 bg-transparent pointer-events-auto"
        tabIndex={-1}
      >
        <div className="city-switcher-modal__topControls">
          <div className="city-switcher-modal__closeSlot">
            <Button
              className="city-switcher-modal__closeBtn"
              onClick={closeCityPicker}
              type="text"
              shape="circle"
              aria-label="Fechar"
              data-testid="city-switcher-close"
            >
              <HiOutlineXMarkIcon className="text-2xl text-white opacity-90" aria-hidden />
            </Button>
          </div>
          <div
            className="city-switcher-modal__geocoderMount relative z-30 px-5"
            aria-label="Buscar endereço ou local"
          >
            <div className="city-switcher-global-search w-full">
              <Input
                variant="borderless"
                size="large"
                allowClear
                value={globalSearchValue}
                onChange={(e) => {
                  const s = e.target.value;
                  setGlobalSearchValue(s);
                  schedulePlacesSearch(s);
                }}
                prefix={<IconSearchTyped className="opacity-60" aria-hidden />}
                placeholder={globalSearchPlaceholder}
                aria-autocomplete="list"
                aria-controls={
                  showPlaceSearchResults ? 'city-switcher-place-results-list' : undefined
                }
                aria-expanded={showPlaceSearchResults}
              />
            </div>
          </div>
        </div>

        <div
          ref={contentScrollElRef}
          className="city-switcher-modal__content relative z-0 px-4 pb-2.5"
          aria-label={showPlaceSearchResults ? 'Resultados da busca' : 'Lista de cidades'}
        >
          {showPlaceSearchResults ? (
            <section
              id="city-switcher-place-results"
              className="city-switcher-modal__section city-switcher-modal__placeSearchSection mt-5"
              aria-label="Locais encontrados"
              data-testid="city-switcher-place-results"
            >
              {placesSearchLoading ? (
                <p className="city-switcher-modal__placeSearchStatus px-3.5 py-4 text-sm opacity-75">
                  Buscando…
                </p>
              ) : placeSuggestionList.length === 0 ? (
                <p className="city-switcher-modal__placeSearchStatus px-3.5 py-4 text-sm opacity-75">
                  Nenhum resultado
                </p>
              ) : (
                <div
                  id="city-switcher-place-results-list"
                  className="city-switcher-modal__placeResultsList"
                  role="list"
                >
                  {placeSuggestionList.map((s, i) => {
                    const sugName =
                      s.properties?.structured_formatting?.main_text ||
                      s.properties?.name ||
                      s.place_name ||
                      '';
                    const sugSecondary =
                      s.properties?.structured_formatting?.secondary_text ||
                      s.properties?.formatted_address ||
                      '';
                    const rowFav = isPlaceSearchRowFavorited(s, favorites);
                    const rowPlaceId = placeSearchRowKey(s);
                    return (
                      <div
                        key={s.id || s.properties?.place_id || `${s.place_name}-${i}`}
                        className="city-switcher-modal__cityCardWrap city-switcher-modal__staggerEnter"
                        style={{ '--city-content-stagger': i } as React.CSSProperties}
                        role="listitem"
                      >
                        <div className="city-switcher-modal__placeSearchResultCard">
                          <button
                            type="button"
                            className="city-switcher-modal__placeSearchCardPick"
                            onClick={() => void handlePlaceSuggestionPick(s)}
                          >
                            <PlacesAutocompleteOptionLabel
                              suggestion={s}
                              rowClassName="city-switcher-modal__placeSearchRow"
                              iconWrapperClassName="city-switcher-modal__placeSearchIconWrap"
                              primaryClassName="city-switcher-modal__cityName city-switcher-modal__placeSearchPrimary"
                              secondaryClassName="city-switcher-modal__cityMeta city-switcher-modal__placeSearchSecondary"
                              iconClassName="city-switcher-modal__placeSearchIcon"
                              iconMatchedClassName="city-switcher-modal__placeSearchIcon city-switcher-modal__placeSearchIcon--matched"
                            />
                          </button>
                          <button
                            type="button"
                            className="city-switcher-modal__favBtn city-switcher-modal__placeSearchCardFav"
                            aria-label={
                              rowFav ? `Remover ${sugName} dos favoritos` : `Favoritar ${sugName}`
                            }
                            aria-pressed={rowFav}
                            onClick={() => {
                              (async () => {
                                try {
                                  const { result: resolvedRaw } =
                                    await geocodePlacesSuggestionToResult(s);
                                  const resolved = resolvedRaw as GeocodedPlaceResult;
                                  if (!resolved.center) return;
                                  const [lng, lat] = resolved.center;
                                  handleToggleFavorite({
                                    lng,
                                    lat,
                                    title:
                                      resolved.properties?.name || resolved.place_name || sugName,
                                    subtitle:
                                      resolved.properties?.formatted_address || sugSecondary,
                                    placeTypes: resolved.properties?.types,
                                    placeId: rowPlaceId,
                                    areaContext: getAreaStringFromResultLike(resolved) || '',
                                  });
                                } catch {}
                              })();
                            }}
                          >
                            {rowFav ? (
                              <HiHeartIcon
                                className="city-switcher-modal__favIcon city-switcher-modal__favIcon--active"
                                aria-hidden
                              />
                            ) : (
                              <HiOutlineHeartIcon
                                className="city-switcher-modal__favIcon"
                                aria-hidden
                              />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          ) : null}

          {!showPlaceSearchResults && favorites.length > 0 && (
            <section
              className="city-switcher-modal__section mt-5"
              aria-label="Favoritos"
              data-testid="city-switcher-favorites"
            >
              <div
                className="city-switcher-modal__staggerEnter"
                style={{ '--city-content-stagger': contentStaggerIndex++ } as React.CSSProperties}
              >
                {/* <div className="city-switcher-modal__sectionTitle flex items-center gap-1 px-3.5 py-4 text-xs tracking-wide text-white opacity-75">
                  <HiHeartIcon
                    className="h-4 w-4 flex-shrink-0 city-switcher-modal__favoriteHeart"
                    aria-hidden="true"
                  />
                  Favoritos
                </div> */}
              </div>
              <div
                className={CITY_SWITCHER_CARD_GRID_CLASS}
                role="list"
                data-testid="city-switcher-favorites-list"
              >
                {favorites.map((fav) => (
                  <div
                    key={fav.id}
                    className="city-switcher-modal__cityCardWrap city-switcher-modal__staggerEnter"
                    style={
                      { '--city-content-stagger': contentStaggerIndex++ } as React.CSSProperties
                    }
                    role="listitem"
                  >
                    <button
                      type="button"
                      className="city-switcher-modal__cityBtn city-switcher-modal__placeSearchBtn"
                      onClick={() => {
                        onPlacesResultSelected?.({
                          lng: fav.lng,
                          lat: fav.lat,
                          areaContext: fav.areaContext || '',
                          title: fav.title,
                          address: fav.subtitle,
                          placeTypes: fav.placeTypes,
                          placeId: fav.placeId || '',
                        });
                        recordRecentPlace({
                          lng: fav.lng,
                          lat: fav.lat,
                          title: fav.title,
                          subtitle: fav.subtitle,
                          placeTypes: fav.placeTypes,
                          areaContext: fav.areaContext,
                        });
                        closeCityPicker();
                      }}
                    >
                      <div className="city-switcher-modal__placeSearchRow">
                        <div
                          className="city-switcher-modal__placeSearchIconWrap"
                          aria-hidden="true"
                        >
                          <HiHeartIcon className="city-switcher-modal__placeSearchIcon city-switcher-modal__placeSearchIcon--matched city-switcher-modal__favoriteHeart h-[1.125rem] w-[1.125rem]" />
                        </div>
                        <div className="city-switcher-modal__cityNameWrap">
                          <div className="city-switcher-modal__cityName city-switcher-modal__placeSearchPrimary">
                            {fav.title}
                          </div>
                          {fav.subtitle ? (
                            <div className="city-switcher-modal__cityMeta city-switcher-modal__placeSearchSecondary">
                              {fav.subtitle}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {!showPlaceSearchResults && recentItemsDisplayed.length > 0 && (
            <section
              className="city-switcher-modal__section mt-5"
              aria-label="Recentes"
              data-testid="city-switcher-recent"
            >
              <div
                className="city-switcher-modal__staggerEnter"
                style={{ '--city-content-stagger': contentStaggerIndex++ } as React.CSSProperties}
              >
                {/* <div className="city-switcher-modal__sectionTitle flex items-center gap-1 px-3.5 py-4 text-xs tracking-wide text-white opacity-75">
                  <HiMiniClockIcon
                    className="h-4 w-4 flex-shrink-0 opacity-75 text-white"
                    aria-hidden="true"
                  />
                  Recentes
                </div> */}
              </div>
              <div
                className={CITY_SWITCHER_CARD_GRID_CLASS}
                role="list"
                data-testid="city-switcher-recent-list"
              >
                {recentItemsDisplayed.map((item) => (
                  <div
                    key={item.id}
                    className="city-switcher-modal__cityCardWrap city-switcher-modal__staggerEnter"
                    style={
                      { '--city-content-stagger': contentStaggerIndex++ } as React.CSSProperties
                    }
                    role="listitem"
                  >
                    {item.type === 'city' && item.citySlug ? (
                      <Link
                        to={`/${encodeURIComponent(item.citySlug)}`}
                        className="city-switcher-modal__cityBtn city-switcher-modal__placeSearchBtn"
                        onClick={() => {
                          if (item.citySlug) {
                            const def = getPredefinedCitySlugDefinition(item.citySlug);
                            const areaLabel =
                              def?.staticLocation?.areaLabel ||
                              `${item.title}${item.subtitle ? `, ${item.subtitle}` : ''}`;
                            recordRecentlyVisitedCity(item.citySlug, areaLabel);
                          }
                          onCatalogCityPicked?.();
                          closeCityPicker();
                        }}
                      >
                        <div className="city-switcher-modal__placeSearchRow">
                          <div
                            className="city-switcher-modal__placeSearchIconWrap"
                            aria-hidden="true"
                          >
                            <HiMiniClockIcon className="city-switcher-modal__placeSearchIcon h-[1.125rem] w-[1.125rem]" />
                          </div>
                          <div className="city-switcher-modal__cityNameWrap">
                            <div className="city-switcher-modal__cityName city-switcher-modal__placeSearchPrimary">
                              {item.title}
                            </div>
                            {item.subtitle ? (
                              <div className="city-switcher-modal__cityMeta city-switcher-modal__placeSearchSecondary">
                                {item.subtitle}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className="city-switcher-modal__cityBtn city-switcher-modal__placeSearchBtn"
                        onClick={() => {
                          if (item.lng != null && item.lat != null) {
                            onPlacesResultSelected?.({
                              lng: item.lng,
                              lat: item.lat,
                              areaContext: item.areaContext || '',
                              title: item.title,
                              address: item.subtitle,
                              placeTypes: item.placeTypes,
                              placeId: '',
                            });
                            recordRecentPlace({
                              lng: item.lng,
                              lat: item.lat,
                              title: item.title,
                              subtitle: item.subtitle,
                              placeTypes: item.placeTypes,
                              areaContext: item.areaContext,
                            });
                          }
                          closeCityPicker();
                        }}
                      >
                        <div className="city-switcher-modal__placeSearchRow">
                          <div
                            className="city-switcher-modal__placeSearchIconWrap"
                            aria-hidden="true"
                          >
                            <HiMiniClockIcon className="city-switcher-modal__placeSearchIcon h-[1.125rem] w-[1.125rem]" />
                          </div>
                          <div className="city-switcher-modal__cityNameWrap">
                            <div className="city-switcher-modal__cityName city-switcher-modal__placeSearchPrimary">
                              {item.title}
                            </div>
                            {item.subtitle ? (
                              <div className="city-switcher-modal__cityMeta city-switcher-modal__placeSearchSecondary">
                                {item.subtitle}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {!showPlaceSearchResults &&
            topCitiesByCountry.map((group) => {
              const cities = group.cities;
              if (cities.length === 0) return null;
              return (
                <section
                  key={group.countryCode}
                  className="city-switcher-modal__section mt-5"
                  aria-label={group.countryLabel}
                  data-country-code={group.countryCode}
                >
                  <div
                    className="city-switcher-modal__staggerEnter"
                    style={
                      { '--city-content-stagger': contentStaggerIndex++ } as React.CSSProperties
                    }
                  >
                    <div className="city-switcher-modal__sectionTitle px-3.5 py-4 text-xs tracking-wide text-white opacity-75">
                      {group.countryLabel}
                    </div>
                  </div>
                  <div className={CITY_SWITCHER_CARD_GRID_CLASS} role="list">
                    {cities.map((c) => (
                      <CityPickerCityCard
                        key={c.canonicalSlug}
                        city={c}
                        stagger={contentStaggerIndex++}
                        to={`/${encodeURIComponent(c.canonicalSlug)}`}
                        onActivate={() => onCityLinkActivate(c, 'top')}
                        infraLayers={infraLayersForMiniPie}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalTree, document.body) : null;
}

/** Clears module-level stats cache and in-flight preload promise (Jest only; no-op in production). */
export function resetCitySwitcherStatsCacheForTest(): void {
  if (process.env.NODE_ENV !== 'test') return;
  statsTotalsByCanonicalSlugCache.clear();
  statsTotalsLoadPromise = null;
  if (persistStatsKmCacheDebounceTimer !== null) {
    clearTimeout(persistStatsKmCacheDebounceTimer);
    persistStatsKmCacheDebounceTimer = null;
  }
  try {
    window.localStorage.removeItem(CITY_SWITCHER_STATS_KM_CACHE_KEY);
  } catch {}
}

/**
 * Replaces module-level stats cache (Jest only). Use to simulate prior loads, TTL, or cold state.
 * Always clears the in-flight preload promise so the next mount runs a fresh preload pass.
 */
export function replaceCitySwitcherStatsCacheForTest(
  entries: Map<string, StatsTotalsCacheEntry>
): void {
  if (process.env.NODE_ENV !== 'test') return;
  statsTotalsByCanonicalSlugCache.clear();
  statsTotalsLoadPromise = null;
  if (persistStatsKmCacheDebounceTimer !== null) {
    clearTimeout(persistStatsKmCacheDebounceTimer);
    persistStatsKmCacheDebounceTimer = null;
  }
  entries.forEach((entry, canonicalSlug) =>
    statsTotalsByCanonicalSlugCache.set(canonicalSlug, entry)
  );
}

export default CitySwitcherModal;
