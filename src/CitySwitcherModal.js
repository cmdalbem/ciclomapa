import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { HiOutlineClock } from 'react-icons/hi2';
import { getCanonicalCitySlug, getPredefinedCitySlugDefinition } from './config/citySlugCatalog.js';
import { TOP_CITY_SLUGS } from './config/topCitiesCatalog.js';
import {
  MAX_RECENT_CITIES,
  SUPPORTED_COUNTRY_CODES,
  SUPPORTED_COUNTRY_LABEL_PT_BY_CODE,
  getSupportedCountryFlagEmoji,
} from './config/constants.js';

import './CitySwitcherModal.css';

const RECENT_CITIES_STORAGE_KEY = 'ciclomapa_recent_cities_v1';

const CITY_PICKER_INPUT_SELECTOR = '.city-switcher-modal__geocoderMount input';

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

function getFakeCityTotalLength(canonicalSlug) {
  // Stable placeholder numbers for prototyping.
  // Replace this with real data later.
  const s = String(canonicalSlug || '');
  let hash = 2166136261; // FNV-1a seed-ish
  for (let i = 0; i < s.length; i += 1) {
    hash ^= s.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const normalized = Math.abs(hash >>> 0);
  return 100 + (normalized % 900); // 100..9999
}

function CitySwitcherModal() {
  const navigate = useNavigate();
  const { city } = useParams();

  const topCities = useMemo(() => {
    return TOP_CITY_SLUGS.map((slug) => {
      const canonicalSlug = getCanonicalCitySlug(slug);
      const def =
        getPredefinedCitySlugDefinition(slug) || getPredefinedCitySlugDefinition(canonicalSlug);

      const areaLabel = def?.staticLocation?.areaLabel || def?.query || canonicalSlug;
      const [name, ...rest] = String(areaLabel)
        .split(',')
        .map((s) => s.trim());
      const meta = rest.join(', ');
      const countryCode = Array.isArray(def?.countrycodes) ? def.countrycodes[0] : null;
      const totalLength = getFakeCityTotalLength(canonicalSlug);

      return { canonicalSlug, name, meta, areaLabel, countryCode, totalLength };
    });
  }, []);

  const countryOrder = useMemo(() => {
    const seen = new Set();
    const order = [];
    topCities.forEach((c) => {
      if (!c.countryCode) return;
      if (seen.has(c.countryCode)) return;
      seen.add(c.countryCode);
      order.push(c.countryCode);
    });
    const priority = new Map(SUPPORTED_COUNTRY_CODES.map((code, i) => [code, i]));
    order.sort((a, b) => (priority.get(a) ?? 999) - (priority.get(b) ?? 999));
    return order;
  }, [topCities]);

  const topCitiesByCountry = useMemo(() => {
    const map = new Map();
    topCities.forEach((city) => {
      const code = city.countryCode || 'other';
      if (!map.has(code)) {
        map.set(code, {
          countryCode: code,
          countryLabel: getCountryLabelPt(code === 'other' ? null : code),
          countryFlag: getSupportedCountryFlagEmoji(code === 'other' ? null : code),
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

  const [recentCities, setRecentCities] = useState([]);

  useEffect(() => {
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

      const ordered = Array.from(uniqueBySlug.values()).slice(0, MAX_RECENT_CITIES);
      const next = ordered
        .map((it) => {
          const def = getPredefinedCitySlugDefinition(it.canonicalSlug);
          if (!def) return null;
          const areaLabel = def?.staticLocation?.areaLabel || it.areaLabel;
          const [name, ...rest] = String(areaLabel)
            .split(',')
            .map((s) => s.trim());
          const meta = rest.join(', ');
          const totalLength = getFakeCityTotalLength(it.canonicalSlug);
          return { ...it, name, meta, countryCode: def?.countrycodes?.[0] || null, totalLength };
        })
        .filter(Boolean);

      setRecentCities(next);
    } catch {
      setRecentCities([]);
    }
  }, [city]);

  const closeCityPicker = useCallback(() => {
    const body = document.querySelector('body');
    if (body) body.classList.remove('show-city-picker');
  }, []);

  const recordRecentlyVisitedCity = useCallback((nextSlug, areaLabel) => {
    try {
      const raw = window.localStorage.getItem(RECENT_CITIES_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      const list = Array.isArray(parsed) ? parsed : [];

      const next = [
        { slug: nextSlug, areaLabel: areaLabel || nextSlug, visitedAt: Date.now() },
        ...list.filter((item) => item?.slug && item.slug !== nextSlug),
      ].slice(0, MAX_RECENT_CITIES);

      window.localStorage.setItem(RECENT_CITIES_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore
    }
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

  const recentCanonicalSlugs = useMemo(() => {
    return new Set(recentCities.map((c) => c.canonicalSlug));
  }, [recentCities]);

  const contentScrollElRef = useRef(null);
  const cityPickerWasOpenRef = useRef(false);

  useLayoutEffect(() => {
    const body = document.body;
    if (!body) return undefined;

    const onBodyClassChange = () => {
      const open = body.classList.contains('show-city-picker');
      if (open && !cityPickerWasOpenRef.current) {
        const el = contentScrollElRef.current;
        if (el) el.scrollTop = 0;
        window.requestAnimationFrame(() => {
          focusCityPickerSearchInput();
        });
      }
      cityPickerWasOpenRef.current = open;
    };

    const observer = new MutationObserver(onBodyClassChange);
    observer.observe(body, { attributes: true, attributeFilter: ['class'] });
    onBodyClassChange();

    return () => observer.disconnect();
  }, []);

  let contentStaggerIndex = 0;

  return (
    <div
      className="city-switcher-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Selecionar cidade"
    >
      <div className="city-switcher-modal__backdrop" onClick={closeCityPicker} aria-hidden="true" />
      <div className="city-switcher-modal__panel glass-bg">
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
                          <div className="city-switcher-modal__cityTotal">
                            {(typeof c.totalLength === 'number' ? c.totalLength : 0) + ' km'}
                          </div>
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
            const cities = group.cities.filter((c) => !recentCanonicalSlugs.has(c.canonicalSlug));
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
                  <div className="city-switcher-modal__sectionTitle">
                    {/* <span className="city-switcher-modal__flag" aria-hidden="true">
                      {group.countryFlag}
                    </span> */}
                    {group.countryLabel}
                  </div>
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
                            <div className="city-switcher-modal__cityTotal">
                              {(typeof c.totalLength === 'number' ? c.totalLength : 0) + ' km'}
                            </div>
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
