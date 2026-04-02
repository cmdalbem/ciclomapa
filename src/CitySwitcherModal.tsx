import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { HiOutlineClock, HiOutlineXMark } from 'react-icons/hi2';
import { Button } from 'antd';
import Storage from './Storage.js';
import { slugify } from './utils/utils.js';
import { getCanonicalCitySlug, getPredefinedCitySlugDefinition } from './config/citySlugCatalog.js';
import { TOP_CITY_SLUGS } from './config/topCitiesCatalog.js';
import {
  ENABLE_CITY_SWITCHER_STATS_CACHE,
  LENGTH_COUNTED_LAYER_IDS,
  MAX_RECENT_CITIES,
  SUPPORTED_COUNTRY_CODES,
  SUPPORTED_COUNTRY_LABEL_PT_BY_CODE,
} from './config/constants.js';
import { appendKmUnit } from './utils/routeUtils.js';

import './CitySwitcherModal.css';

// `react-icons` exports icons typed as returning `ReactNode` (see `IconType`),
// but React 19's JSX typings require a component return type that is a JSX element.
// Cast here to keep the rest of the file type-safe without changing runtime behavior.
const HiOutlineXMarkIcon = HiOutlineXMark as unknown as React.FC<React.SVGProps<SVGElement>>;
const HiOutlineClockIcon = HiOutlineClock as unknown as React.FC<React.SVGProps<SVGElement>>;

const CITY_SWITCHER_LOG_PREFIX = '[city-switcher]';

const RECENT_CITIES_STORAGE_KEY = 'ciclomapa_recent_cities_v1';

/** Persisted map: canonical city slug → summed km for that city only (layers in LENGTH_COUNTED_LAYER_IDS). */
const CITY_SWITCHER_STATS_KM_CACHE_KEY = 'ciclomapa_city_switcher_stats_km_v2';

const CITY_PICKER_INPUT_SELECTOR = '.city-switcher-modal__geocoderMount input';

type StatsTotalsCacheEntry = {
  value: number | null;
  fetchedAt: number;
};

const statsTotalsByCanonicalSlugCache = new Map<string, StatsTotalsCacheEntry>();

if (typeof window !== 'undefined' && ENABLE_CITY_SWITCHER_STATS_CACHE) {
  try {
    const raw = window.localStorage.getItem(CITY_SWITCHER_STATS_KM_CACHE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      Object.entries(parsed as Record<string, unknown>).forEach(([slug, row]) => {
        if (!slug || !row || typeof row !== 'object' || Array.isArray(row)) return;
        const r = row as { value?: unknown; fetchedAt?: unknown };
        const fetchedAt = typeof r.fetchedAt === 'number' ? r.fetchedAt : 0;
        const value =
          typeof r.value === 'number' && Number.isFinite(r.value)
            ? r.value
            : r.value === null
              ? null
              : null;
        statsTotalsByCanonicalSlugCache.set(slug, { value, fetchedAt });
      });
    }
  } catch {
    // Ignore corrupt cache
  }
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
    const out: Record<string, { value: number | null; fetchedAt: number }> = {};
    statsTotalsByCanonicalSlugCache.forEach((entry, slug) => {
      out[slug] = { value: entry.value, fetchedAt: entry.fetchedAt };
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
};

type RecentCityWithStats = RecentCityEntry & {
  name: string;
  meta: string;
  areaLabel: string;
  countryCode: string | null;
  totalLength: number | null;
  isLoadingTotal: boolean;
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
  } catch {
    // Ignore
  }
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
  return { value: sumLengthsToKm(lengths), fetchedAt };
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
    });
    schedulePersistStatsKmCache();
    return;
  }

  statsTotalsByCanonicalSlugCache.set(canonicalSlug, { value: null, fetchedAt: now });
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
): { totalLength: number | null; isLoadingTotal: boolean } {
  const totalLength = getRealCityTotalLength(cityObj, totalsByCanonicalSlug);
  const isLoadingTotal =
    typeof totalLength !== 'number' &&
    shouldShowTotalSkeleton(cityObj, totalsByCanonicalSlug, isLoadingTotals);
  return { totalLength, isLoadingTotal };
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
};

function CityPickerCityCard({
  city,
  stagger,
  to,
  onActivate,
}: {
  city: CityPickerRowModel;
  stagger: number;
  to: string;
  onActivate: () => void;
}) {
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
          <div className="city-switcher-modal__cityNameWrap">
            <div className="city-switcher-modal__cityName">{city.name}</div>
            {city.meta ? (
              <div className="city-switcher-modal__cityMetaInline">{city.meta}</div>
            ) : null}
          </div>
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
        {city.meta ? <div className="city-switcher-modal__cityMeta">{city.meta}</div> : null}
      </Link>
    </div>
  );
}

function CitySwitcherModal() {
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
      const { totalLength, isLoadingTotal } = attachCityStatsTotals(
        cityObj,
        statsTotalsByCanonicalSlug,
        isLoadingTotals
      );
      return { ...c, totalLength, isLoadingTotal };
    });
  }, [topCityBase, statsTotalsByCanonicalSlug, isLoadingTotals]);

  const recentCities = useMemo<RecentCityWithStats[]>(() => {
    return recentCityEntries
      .map((it): RecentCityWithStats | null => {
        const def = getPredefinedCitySlugDefinition(it.canonicalSlug);
        if (!def) return null;
        const areaLabel = def?.staticLocation?.areaLabel || it.areaLabel;
        const [name, ...rest] = String(areaLabel)
          .split(',')
          .map((s) => s.trim());
        const meta = getPrimaryAreaMeta(rest);
        const cityObj: StatsCityLike = { canonicalSlug: it.canonicalSlug, areaLabel, name, meta };
        const { totalLength, isLoadingTotal } = attachCityStatsTotals(
          cityObj,
          statsTotalsByCanonicalSlug,
          isLoadingTotals
        );
        return {
          ...it,
          areaLabel,
          name,
          meta,
          countryCode: def?.countrycodes?.[0] || null,
          totalLength,
          isLoadingTotal,
        };
      })
      .filter((row): row is RecentCityWithStats => row !== null);
  }, [recentCityEntries, statsTotalsByCanonicalSlug, isLoadingTotals]);

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
    },
    []
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

      recordRecentlyVisitedCity(nextSlug, cityObj?.areaLabel);

      closeCityPicker();

      // Best-effort reset: hide Mapbox's input + suggestions after picking.
      const input = document.querySelector(CITY_PICKER_INPUT_SELECTOR);
      if (input instanceof HTMLInputElement) {
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    },
    [recordRecentlyVisitedCity, closeCityPicker]
  );

  const contentScrollElRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useCityPickerFocusAndRestore({ contentScrollElRef });
  useCityPickerKeyboardTrap({ panelRef, closeCityPicker });

  let contentStaggerIndex = 0;

  return (
    <div
      className="city-switcher-modal"
      role="dialog"
      aria-modal="true"
      data-testid="city-switcher-dialog"
      aria-label="Selecionar cidade"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeCityPicker();
      }}
    >
      <div ref={panelRef} className="city-switcher-modal__panel" tabIndex={-1}>
        <div className="city-switcher-modal__headerRow">
          <div />
          <Button
            onClick={closeCityPicker}
            type="text"
            shape="circle"
            aria-label="Fechar"
            data-testid="city-switcher-close"
          >
            <HiOutlineXMarkIcon className="text-2xl city-switcher-modal__closeIcon" aria-hidden />
          </Button>
        </div>
        <div className="city-switcher-modal__geocoderMount" aria-label="Buscar cidades" />

        <div
          ref={contentScrollElRef}
          className="city-switcher-modal__content"
          aria-label="Lista de cidades"
        >
          {recentCities.length > 0 && (
            <section
              className="city-switcher-modal__section"
              aria-label="Recentemente visitadas"
              data-testid="city-switcher-recent"
            >
              <div
                className="city-switcher-modal__sectionTitleWrap city-switcher-modal__staggerEnter"
                style={{ '--city-content-stagger': contentStaggerIndex++ } as React.CSSProperties}
              >
                <div className="city-switcher-modal__sectionTitle">
                  <HiOutlineClockIcon
                    className="city-switcher-modal__clockIcon"
                    aria-hidden="true"
                  />
                  Recentes
                </div>
              </div>
              <div className="city-switcher-modal__citiesGrid" role="list">
                {recentCities.map((c) => (
                  <CityPickerCityCard
                    key={c.canonicalSlug}
                    city={c}
                    stagger={contentStaggerIndex++}
                    to={`/${encodeURIComponent(c.canonicalSlug)}`}
                    onActivate={() => onCityLinkActivate(c, 'recent')}
                  />
                ))}
              </div>
            </section>
          )}

          {topCitiesByCountry.map((group) => {
            const cities = group.cities;
            if (cities.length === 0) return null;
            return (
              <section
                key={group.countryCode}
                className="city-switcher-modal__section city-switcher-modal__section--countryGroup"
                aria-label={group.countryLabel}
                data-country-code={group.countryCode}
              >
                <div
                  className="city-switcher-modal__sectionTitleWrap city-switcher-modal__staggerEnter"
                  style={{ '--city-content-stagger': contentStaggerIndex++ } as React.CSSProperties}
                >
                  <div className="city-switcher-modal__sectionTitle">{group.countryLabel}</div>
                </div>
                <div className="city-switcher-modal__citiesGrid" role="list">
                  {cities.map((c) => (
                    <CityPickerCityCard
                      key={c.canonicalSlug}
                      city={c}
                      stagger={contentStaggerIndex++}
                      to={`/${encodeURIComponent(c.canonicalSlug)}`}
                      onActivate={() => onCityLinkActivate(c, 'top')}
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
  } catch {
    // Ignore
  }
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
