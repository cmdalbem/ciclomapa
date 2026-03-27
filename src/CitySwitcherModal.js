import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { HiOutlineClock } from 'react-icons/hi2';
import { Button } from 'antd';
import Storage from './Storage.js';
import { slugify } from './utils/utils.js';
import { getCanonicalCitySlug, getPredefinedCitySlugDefinition } from './config/citySlugCatalog.js';
import { TOP_CITY_SLUGS } from './config/topCitiesCatalog.js';
import {
  LENGTH_COUNTED_LAYER_IDS,
  MAX_RECENT_CITIES,
  SUPPORTED_COUNTRY_CODES,
  SUPPORTED_COUNTRY_LABEL_PT_BY_CODE,
} from './config/constants.js';

import { HiOutlineXMark } from 'react-icons/hi2';

import './CitySwitcherModal.css';

const RECENT_CITIES_STORAGE_KEY = 'ciclomapa_recent_cities_v1';

const CITY_PICKER_INPUT_SELECTOR = '.city-switcher-modal__geocoderMount input';
const statsTotalsByDocIdCache = new Map();
let statsTotalsLoadPromise = null;
const STATS_TOTALS_MISS_TTL_MS = 5 * 60 * 1000;

function readRecentCitiesFromStorage() {
  try {
    const raw = window.localStorage.getItem(RECENT_CITIES_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const items = Array.isArray(parsed) ? parsed : [];

    const uniqueBySlug = new Map();
    items.forEach((item) => {
      if (!item || !item.slug) return;
      const canonicalSlug = getCanonicalCitySlug(item.slug) || item.slug;
      if (uniqueBySlug.has(canonicalSlug)) return;
      uniqueBySlug.set(canonicalSlug, {
        canonicalSlug,
        areaLabel: item.areaLabel || canonicalSlug,
        visitedAt: item.visitedAt || 0,
      });
    });

    return Array.from(uniqueBySlug.values()).slice(0, MAX_RECENT_CITIES);
  } catch {
    return [];
  }
}

function writeRecentCitiesToStorage(items) {
  try {
    window.localStorage.setItem(RECENT_CITIES_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Ignore
  }
}

function getFocusableElements(container) {
  if (!container) return [];
  const nodes = Array.from(
    container.querySelectorAll(
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

function isElementConnected(el) {
  return !!(el && (el.isConnected || document.contains(el)));
}

/**
 * Mapbox geocoder mounts into the modal asynchronously; the modal root must also be
 * visibility:visible (see CitySwitcherModal.css) or focus will not stick.
 */
function focusCityPickerSearchInput(attempt = 0) {
  if (attempt > 80) return;
  if (!document.body.classList.contains('show-city-picker')) return;

  const modalRoot = document.querySelector('.city-switcher-modal');
  if (modalRoot && getComputedStyle(modalRoot).visibility === 'hidden') {
    window.setTimeout(() => focusCityPickerSearchInput(attempt + 1), 16);
    return;
  }

  const input = document.querySelector(CITY_PICKER_INPUT_SELECTOR);
  if (input && typeof input.focus === 'function') {
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

function getCountryLabelPt(countryCode) {
  if (!countryCode) return 'Outros';
  return SUPPORTED_COUNTRY_LABEL_PT_BY_CODE[countryCode] || 'Outros';
}

function getPrimaryAreaMeta(restParts) {
  const parts = Array.isArray(restParts)
    ? restParts.map((s) => String(s || '').trim()).filter(Boolean)
    : [];
  if (parts.length === 0) return '';
  return parts[0];
}

function sumLengthsToKm(lengths) {
  const obj = lengths && typeof lengths === 'object' ? lengths : {};
  const total = LENGTH_COUNTED_LAYER_IDS.reduce((sum, layerId) => {
    const value = Number(obj[layerId]);
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);
  return Number.isFinite(total) && total > 0 ? total : null;
}

function buildStatsDocIdCandidates(cityObj) {
  const candidates = new Set();
  if (!cityObj) return candidates;

  const canonicalSlug = getCanonicalCitySlug(cityObj.canonicalSlug || cityObj.slug || '');
  const def = getPredefinedCitySlugDefinition(canonicalSlug);

  addCandidateSlug(candidates, canonicalSlug);
  addCandidateSlug(candidates, cityObj.areaLabel);
  addCandidateSlug(candidates, cityObj.name);
  addCandidateSlug(candidates, cityObj.meta ? `${cityObj.name}, ${cityObj.meta}` : '');
  addCandidateSlug(candidates, def?.query);
  addCandidateSlug(candidates, def?.staticLocation?.areaLabel);

  return candidates;
}

async function preloadStatsTotalsForCities(cityObjs) {
  const now = Date.now();
  const toFetch = new Set();
  (Array.isArray(cityObjs) ? cityObjs : []).forEach((c) => {
    for (const docId of buildStatsDocIdCandidates(c)) {
      const cached = statsTotalsByDocIdCache.get(docId);
      if (!cached) {
        toFetch.add(docId);
        continue;
      }
      if (cached.value === null && now - cached.fetchedAt > STATS_TOTALS_MISS_TTL_MS) {
        toFetch.add(docId);
      }
    }
  });

  if (toFetch.size === 0) return;

  const storage = new Storage();
  const docsById = await storage.getCityStatsDocs(Array.from(toFetch));
  for (const [id, docData] of docsById.entries()) {
    statsTotalsByDocIdCache.set(id, { value: sumLengthsToKm(docData?.lengths), fetchedAt: now });
  }
}

function addCandidateSlug(next, value) {
  if (!value) return;
  const slug = slugify(String(value));
  if (!slug) return;
  next.add(slug);
}

function getRealCityTotalLength(cityObj, totalsByDocId) {
  if (!totalsByDocId || totalsByDocId.size === 0 || !cityObj) return null;
  for (const docId of buildStatsDocIdCandidates(cityObj)) {
    const entry = totalsByDocId.get(docId);
    if (entry && typeof entry.value === 'number') return entry.value;
  }
  return null;
}

function shouldShowTotalSkeleton(cityObj, totalsByDocId, isLoadingTotals) {
  if (!isLoadingTotals) return false;
  const candidates = buildStatsDocIdCandidates(cityObj);
  if (candidates.size === 0) return false;
  for (const docId of candidates) {
    if (!totalsByDocId.has(docId)) return true;
  }
  return false;
}

function usePreloadedStatsTotalsByDocId(cityObjs) {
  const [statsTotalsByDocId, setStatsTotalsByDocId] = useState(
    () => new Map(statsTotalsByDocIdCache)
  );
  const [isLoadingTotals, setIsLoadingTotals] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const list = Array.isArray(cityObjs) ? cityObjs : [];

    setIsLoadingTotals(true);
    if (!statsTotalsLoadPromise) {
      statsTotalsLoadPromise = preloadStatsTotalsForCities(list).finally(() => {
        statsTotalsLoadPromise = null;
      });
    } else {
      statsTotalsLoadPromise = statsTotalsLoadPromise.then(() => preloadStatsTotalsForCities(list));
    }

    Promise.resolve(statsTotalsLoadPromise).then(() => {
      if (cancelled) return;
      setStatsTotalsByDocId(new Map(statsTotalsByDocIdCache));
      setIsLoadingTotals(false);
    });

    return () => {
      cancelled = true;
    };
  }, [cityObjs]);

  return { statsTotalsByDocId, isLoadingTotals };
}

function useCityPickerFocusAndRestore({ contentScrollElRef }) {
  const lastFocusedBeforeOpenRef = useRef(null);
  const cityPickerWasOpenRef = useRef(false);

  useLayoutEffect(() => {
    const body = document.body;
    if (!body) return undefined;

    const onBodyClassChange = () => {
      const open = body.classList.contains('show-city-picker');
      if (open && !cityPickerWasOpenRef.current) {
        lastFocusedBeforeOpenRef.current = document.activeElement;
        const el = contentScrollElRef.current;
        if (el) el.scrollTop = 0;
        window.requestAnimationFrame(() => {
          focusCityPickerSearchInput();
        });
      }
      if (!open && cityPickerWasOpenRef.current) {
        const toFocus = lastFocusedBeforeOpenRef.current;
        lastFocusedBeforeOpenRef.current = null;
        if (isElementConnected(toFocus) && typeof toFocus.focus === 'function') {
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

function useCityPickerKeyboardTrap({ panelRef, closeCityPicker }) {
  useEffect(() => {
    const body = document.body;
    if (!body) return undefined;

    const onKeyDown = (e) => {
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
      } else {
        if (active === last) {
          e.preventDefault();
          try {
            first.focus({ preventScroll: true });
          } catch {
            first.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [panelRef, closeCityPicker]);
}

function CitySwitcherModal() {
  const navigate = useNavigate();
  const { city } = useParams();

  const topCityBase = useMemo(() => {
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
    const seen = new Set();
    const order = [];
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

  useEffect(() => {
    setRecentCityEntries(readRecentCitiesFromStorage());
  }, [city]);

  const statsCityCandidates = useMemo(() => {
    return topCityBase.concat(recentCityEntries);
  }, [topCityBase, recentCityEntries]);

  const { statsTotalsByDocId, isLoadingTotals } =
    usePreloadedStatsTotalsByDocId(statsCityCandidates);

  const topCities = useMemo(() => {
    return topCityBase.map((c) => {
      const cityObj = {
        canonicalSlug: c.canonicalSlug,
        areaLabel: c.areaLabel,
        name: c.name,
        meta: c.meta,
      };
      const totalLength = getRealCityTotalLength(cityObj, statsTotalsByDocId);
      const isLoadingTotal =
        typeof totalLength !== 'number' &&
        shouldShowTotalSkeleton(cityObj, statsTotalsByDocId, isLoadingTotals);
      return { ...c, totalLength, isLoadingTotal };
    });
  }, [topCityBase, statsTotalsByDocId, isLoadingTotals]);

  const recentCities = useMemo(() => {
    return recentCityEntries
      .map((it) => {
        const def = getPredefinedCitySlugDefinition(it.canonicalSlug);
        if (!def) return null;
        const areaLabel = def?.staticLocation?.areaLabel || it.areaLabel;
        const [name, ...rest] = String(areaLabel)
          .split(',')
          .map((s) => s.trim());
        const meta = getPrimaryAreaMeta(rest);
        const cityObj = { canonicalSlug: it.canonicalSlug, areaLabel, name, meta };
        const totalLength = getRealCityTotalLength(cityObj, statsTotalsByDocId);
        const isLoadingTotal =
          typeof totalLength !== 'number' &&
          shouldShowTotalSkeleton(cityObj, statsTotalsByDocId, isLoadingTotals);
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
      .filter(Boolean);
  }, [recentCityEntries, statsTotalsByDocId, isLoadingTotals]);

  const topCitiesByCountry = useMemo(() => {
    const map = new Map();
    topCities.forEach((city) => {
      const code = city.countryCode || 'other';
      if (!map.has(code)) {
        map.set(code, {
          countryCode: code,
          countryLabel: getCountryLabelPt(code === 'other' ? null : code),
          cities: [],
        });
      }
      map.get(code).cities.push(city);
    });

    return countryOrder
      .map((code) => map.get(code))
      .filter(Boolean)
      .concat(map.has('other') ? [map.get('other')] : []);
  }, [topCities, countryOrder]);

  const closeCityPicker = useCallback(() => {
    const body = document.querySelector('body');
    if (body) body.classList.remove('show-city-picker');
  }, []);

  const recordRecentlyVisitedCity = useCallback((nextSlug, areaLabel) => {
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
      return readRecentCitiesFromStorage();
    });
  }, []);

  const onPickCity = useCallback(
    (cityObj) => {
      const nextSlug = cityObj?.canonicalSlug;
      if (!nextSlug) return;

      recordRecentlyVisitedCity(nextSlug, cityObj?.areaLabel);

      closeCityPicker();

      // Best-effort reset: hide Mapbox's input + suggestions after picking.
      const input = document.querySelector(CITY_PICKER_INPUT_SELECTOR);
      if (input) {
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }

      navigate(`/${encodeURIComponent(nextSlug)}`);
    },
    [navigate, recordRecentlyVisitedCity, closeCityPicker]
  );

  const contentScrollElRef = useRef(null);
  const panelRef = useRef(null);

  useCityPickerFocusAndRestore({ contentScrollElRef });
  useCityPickerKeyboardTrap({ panelRef, closeCityPicker });

  let contentStaggerIndex = 0;

  return (
    <div
      className="city-switcher-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Selecionar cidade"
    >
      <div className="city-switcher-modal__backdrop" onClick={closeCityPicker} aria-hidden="true" />
      <div ref={panelRef} className="city-switcher-modal__panel glass-bg" tabIndex={-1}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            paddingRight: 12,
            marginBottom: 12,
          }}
        >
          <div />
          <Button onClick={closeCityPicker} type="text" aria-label="Fechar">
            <HiOutlineXMark className="text-2xl city-switcher-modal__closeIcon" aria-hidden />
          </Button>
        </div>
        <div className="city-switcher-modal__geocoderMount" aria-label="Buscar cidades" />

        <div
          ref={contentScrollElRef}
          className="city-switcher-modal__content"
          aria-label="Lista de cidades"
        >
          {recentCities.length > 0 && (
            <section className="city-switcher-modal__section" aria-label="Recentemente visitadas">
              <div
                className="city-switcher-modal__sectionTitleWrap city-switcher-modal__staggerEnter"
                style={{ '--city-content-stagger': contentStaggerIndex++ }}
              >
                <div className="city-switcher-modal__sectionTitle">
                  <HiOutlineClock className="city-switcher-modal__clockIcon" aria-hidden="true" />
                  Recentes
                </div>
              </div>
              <div className="city-switcher-modal__citiesGrid" role="list">
                {recentCities.map((c) => {
                  const stagger = contentStaggerIndex++;
                  return (
                    <div
                      key={c.canonicalSlug}
                      className="city-switcher-modal__cityCardWrap city-switcher-modal__staggerEnter"
                      style={{ '--city-content-stagger': stagger }}
                      role="listitem"
                    >
                      <button
                        type="button"
                        className="city-switcher-modal__cityBtn"
                        onClick={() => onPickCity(c)}
                      >
                        <div className="city-switcher-modal__cityTopRow">
                          <div className="city-switcher-modal__cityName">{c.name}</div>
                          {typeof c.totalLength === 'number' ? (
                            <div className="city-switcher-modal__cityTotal">
                              {c.totalLength.toFixed(0) + ' km'}
                            </div>
                          ) : c.isLoadingTotal ? (
                            <div className="city-switcher-modal__cityTotal" aria-hidden="true">
                              <span className="city-switcher-modal__cityTotalSkeleton" />
                            </div>
                          ) : null}
                        </div>
                        {c.meta ? (
                          <div className="city-switcher-modal__cityMeta">{c.meta}</div>
                        ) : null}
                      </button>
                    </div>
                  );
                })}
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
              >
                <div
                  className="city-switcher-modal__sectionTitleWrap city-switcher-modal__staggerEnter"
                  style={{ '--city-content-stagger': contentStaggerIndex++ }}
                >
                  <div className="city-switcher-modal__sectionTitle">{group.countryLabel}</div>
                </div>
                <div className="city-switcher-modal__citiesGrid" role="list">
                  {cities.map((c) => {
                    const stagger = contentStaggerIndex++;
                    return (
                      <div
                        key={c.canonicalSlug}
                        className="city-switcher-modal__cityCardWrap city-switcher-modal__staggerEnter"
                        style={{ '--city-content-stagger': stagger }}
                        role="listitem"
                      >
                        <button
                          type="button"
                          className="city-switcher-modal__cityBtn"
                          onClick={() => onPickCity(c)}
                        >
                          <div className="city-switcher-modal__cityTopRow">
                            <div className="city-switcher-modal__cityName">{c.name}</div>
                            {typeof c.totalLength === 'number' ? (
                              <div className="city-switcher-modal__cityTotal">
                                {c.totalLength.toFixed(0) + ' km'}
                              </div>
                            ) : c.isLoadingTotal ? (
                              <div className="city-switcher-modal__cityTotal" aria-hidden="true">
                                <span className="city-switcher-modal__cityTotalSkeleton" />
                              </div>
                            ) : null}
                          </div>
                          {c.meta ? (
                            <div className="city-switcher-modal__cityMeta">{c.meta}</div>
                          ) : null}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default CitySwitcherModal;
