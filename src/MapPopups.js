import mapboxgl from 'mapbox-gl';
import { renderToStaticMarkup } from 'react-dom/server';

import './MapPopups.css';
import { osmi18n as i18n } from './osmi18n';
import Analytics from './Analytics.js';
import { formatDistance, formatDuration } from './utils/routeUtils.js';
import { formatTimeAgo } from './utils/utils.js';

import { ENABLE_COMMENTS, IS_MOBILE } from './config/constants.js';
import { getPlaceTypeIconElement } from './GooglePlacesGeocoder.js';
import { isFavorite, isFavoriteById } from './favoritesStore';

/** POI address line from Overpass tags; Nominatim fallback (https://operations.osmfoundation.org/policies/nominatim/). */

export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const POPUP_PLACE_TYPE_ICON_CLASS =
  'search-result-popup-place-icon w-4 h-4 flex-shrink-0 mt-1 opacity-70';

/** SVG string for the same place-type icon as the city search dropdown (Google `types`). */
function renderPlaceTypeIconHtml(types) {
  const el = getPlaceTypeIconElement(types, {
    className: POPUP_PLACE_TYPE_ICON_CLASS,
    matchedClassName: POPUP_PLACE_TYPE_ICON_CLASS,
  });
  return renderToStaticMarkup(el);
}

const FAV_HEART_OUTLINE_SVG = `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" class="react-icon mb-0.5 mr-1" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"/></svg>`;
const FAV_HEART_FILLED_SVG = `<svg fill="currentColor" stroke="currentColor" stroke-width="0" viewBox="0 0 24 24" class="react-icon mb-0.5 mr-1" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17l-.022.012-.007.004-.002.001h-.002L12 21.12l-1.645-.211z" clip-rule="evenodd"/></svg>`;

/** `favMeta` mirrors `favoritesStore` fields when favoriting from the search-result popup. */
function buildFavBtnHtml(lng, lat, title, color, favoriteId = null, favMeta = null) {
  const active =
    favoriteId != null && favoriteId !== ''
      ? isFavoriteById(favoriteId)
      : isFavorite(lng, lat, title, favMeta?.placeId);
  const activeClass = active ? ' popup-fav-btn--active' : '';
  const icon = active ? FAV_HEART_FILLED_SVG : FAV_HEART_OUTLINE_SVG;
  const label = active ? 'Favoritado' : 'Favoritar';
  const idAttr =
    favoriteId != null && favoriteId !== ''
      ? ` data-fav-id="${escapeHtml(String(favoriteId))}"`
      : '';
  let metaAttrs = '';
  if (favMeta && typeof favMeta === 'object') {
    const typesJson = JSON.stringify(Array.isArray(favMeta.placeTypes) ? favMeta.placeTypes : []);
    metaAttrs = ` data-fav-subtitle="${escapeHtml(favMeta.subtitle || '')}" data-fav-area-context="${escapeHtml(
      favMeta.areaContext || ''
    )}" data-fav-place-id="${escapeHtml(favMeta.placeId || '')}" data-fav-place-types="${escapeHtml(typesJson)}"`;
  }
  return `<button type="button"
      class="popup-fav-btn${activeClass} flex-shrink-0 border border-opacity-25 border-${color} px-3 py-1.5 text-sm rounded-full whitespace-nowrap"
      data-fav-lng="${lng}" data-fav-lat="${lat}" data-fav-title="${escapeHtml(title)}"
      ${idAttr}${metaAttrs}
      onclick="window.toggleFavoriteFromPopup && window.toggleFavoriteFromPopup(this);"
  ><span class="popup-fav-btn__icon">${icon}</span><span class="popup-fav-btn__label">${label}</span></button>`;
}

export function formatAddressLineFromOsmProperties(properties) {
  if (!properties || typeof properties !== 'object') return null;

  const full = properties['addr:full'];
  if (full != null && String(full).trim()) {
    return String(full).trim();
  }

  const contact = properties['contact:address'];
  if (contact != null && String(contact).trim()) {
    return String(contact).trim();
  }

  const street = properties['addr:street'];
  const nbr = properties['addr:housenumber'];
  const housename = properties['addr:housename'];

  const streetParts = [];
  if (housename) streetParts.push(String(housename));
  const roadLine = [street, nbr].filter(Boolean).join(', ');
  if (roadLine) streetParts.push(roadLine);

  const suburb =
    properties['addr:suburb'] ||
    properties['addr:neighbourhood'] ||
    properties['addr:quarter'] ||
    properties['addr:district'];

  const city =
    properties['addr:city'] ||
    properties['addr:town'] ||
    properties['addr:village'] ||
    properties['addr:municipality'];

  const pc = properties['addr:postcode'];

  const cityPart = [pc, city].filter(Boolean).join(' ').trim();
  const regionPart = cityPart || null;

  const segments = [];
  const first = streetParts.join(' — ') || roadLine || null;
  if (first) segments.push(first);
  if (suburb) segments.push(String(suburb));
  if (regionPart) segments.push(regionPart);

  if (segments.length === 0) return null;
  return segments.join(' · ');
}

export function omitAddressTagsForDetailGrid(properties) {
  const out = { ...properties };
  Object.keys(out).forEach((k) => {
    if (k.startsWith('addr:') || k === 'contact:address') {
      delete out[k];
    }
  });
  return out;
}

const NOMINATIM_UA = 'CicloMapa/3.0 (https://ciclomapa.app)';

/** First segment of the app area label (e.g. "Porto Alegre, RS, Brasil" → "Porto Alegre"). */
export function primaryCityFromAreaLabel(areaLabel) {
  if (!areaLabel || typeof areaLabel !== 'string') return '';
  return areaLabel.split(',')[0].trim();
}

/**
 * Short line from Nominatim reverse: street + neighbourhood + city only (no state/country).
 * Omits city when it matches the map's selected area. Never uses display_name (too long).
 */
export function formatNominatimReverseLine(data, opts = {}) {
  if (!data || typeof data !== 'object' || data.error) return null;

  const a = data.address;
  if (!a || typeof a !== 'object') return null;

  const road = a.road || a.pedestrian || a.path || a.footway || a.cycleway;
  const streetPart = [road, a.house_number].filter(Boolean).join(', ');

  const neighbourhoodPart = a.suburb || a.neighbourhood || a.quarter;
  const cityName = (a.city || a.town || a.village || a.municipality || a.hamlet || '').trim();

  const selectedPrimary = primaryCityFromAreaLabel(opts.selectedAreaLabel || '').toLowerCase();
  const cityMatches =
    selectedPrimary.length > 0 && cityName.length > 0 && cityName.toLowerCase() === selectedPrimary;

  const afterStreet = [];
  if (neighbourhoodPart) afterStreet.push(String(neighbourhoodPart));
  if (cityName && !cityMatches) afterStreet.push(cityName);

  const tail = afterStreet.join(', ');
  const line = [streetPart, tail].filter(Boolean).join(' · ');
  return line || null;
}

export async function reverseNominatimAddress(lat, lon, options = {}) {
  const { signal, acceptLanguage = 'pt-BR,pt,en', selectedAreaLabel } = options;

  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lon));
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('zoom', '18');
  url.searchParams.set('accept-language', acceptLanguage);

  const response = await fetch(url.toString(), {
    signal,
    headers: {
      Accept: 'application/json',
      'User-Agent': NOMINATIM_UA,
    },
  });

  if (!response.ok) {
    throw new Error(`Nominatim reverse failed (${response.status})`);
  }

  const data = await response.json();
  return formatNominatimReverseLine(data, { selectedAreaLabel });
}

class MapPopups {
  map;

  popup;
  commentPopup;
  poiPopup;
  routeTooltips;
  previousCyclewayLayerClass;

  constructor(map, debugMode, isDarkMode = false, selectedAreaLabel = '') {
    this.map = map;
    this.debugMode = debugMode;
    this.isDarkMode = isDarkMode;
    this.selectedAreaLabel = selectedAreaLabel || '';

    // "closeOnClick: false" enables chaining clicks continually
    //   from POI to POI, otherwise clicking on another POI would
    //   just close the popup from the previous one.
    this.cyclewayPopup = new mapboxgl.Popup({
      className: 'popup-big',
      closeOnClick: true,
    });
    this.cyclewayPopup.on('close', (e) => {
      if (this.selectedCycleway) {
        try {
          this.map.setFeatureState(
            { source: 'osmdata', id: this.selectedCycleway },
            { selected: false, hover: false }
          );
        } catch (e) {}
        // try { this.map.setFeatureState({ source: 'pmtiles-source', id: this.selectedCycleway }, { selected: false, hover: false }); } catch (e) {}
      }
      this.selectedCycleway = null;
    });

    this.commentPopup = new mapboxgl.Popup({
      className: 'popup-big',
      closeOnClick: true,
      offset: 25,
    });

    this.poiPopup = new mapboxgl.Popup({
      className: 'popup-big',
      closeOnClick: true,
      offset: 25,
    });
    this.poiPopup.on('close', () => {
      this.poiAddressAbortController?.abort();
      this.poiAddressAbortController = null;
    });

    this.searchResultPopup = new mapboxgl.Popup({
      className: 'popup-big',
      closeOnClick: true,
      offset: 25,
    });

    this.routeTooltips = [];
    this.poiAddressAbortController = null;
    this.poiAddressRequestId = 0;
  }

  setSelectedAreaLabel(label) {
    this.selectedAreaLabel = label || '';
  }

  attachMobileActiveHandler(popupInstance) {
    if (!IS_MOBILE || !popupInstance) return;

    const el = popupInstance.getElement();
    el.addEventListener(
      'touchstart',
      (e) => {
        console.debug('touchstart', e.target);
        if (e.target.closest('button, a, [role="button"], .no-toggle')) return;
        // Prevent map drag/reposition from interfering with first toggle
        try {
          e.preventDefault();
        } catch (_) {}
        e.stopPropagation();
        const toggleResult = el.classList.toggle('active');
        console.debug('toggleResult', toggleResult);
      },
      { passive: false }
    );
  }

  renderProperties(properties) {
    const propertiesHtml = Object.keys(properties)
      .filter((key) => (this.debugMode ? true : !key.startsWith('ciclomapa:')))
      .map((key) => {
        const untranslatedValue = properties[key];
        const translatedName = i18n[key];
        const translatedValue = i18n[untranslatedValue];

        let content = '';
        let isTranslated = true;

        switch (key) {
          case 'website':
          case 'email':
          case 'facebook':
            // Sometimes people will not put the http part of the link on OSM,
            // making the browser think the link is a subpage of CicloMapa and
            // adding our domain to the beggining of it.
            let link = untranslatedValue.includes('http')
              ? untranslatedValue
              : 'http://' + untranslatedValue;
            content = `<a target="_blank" rel="noopener" class="underline" href=${link}>${link}</a>`;
            break;

          default:
            if (translatedName) {
              content = translatedValue || untranslatedValue;
            } else {
              if (this.debugMode) {
                // In debug mode, show untranslated properties
                content = untranslatedValue;
                isTranslated = false;
              } else {
                console.debug('Map tooltip: ignored OSM tag:', key, untranslatedValue);
                return '';
              }
            }
            break;
        }

        const labelColor = this.debugMode && !isTranslated ? 'text-red-500' : 'opacity-50';
        const displayName = translatedName || key;

        return `
                    <div>
                        <div class="${labelColor}">
                            ${displayName}
                        </div>
                        <div class="overflow-ellipsis overflow-hidden">
                            ${content}
                        </div>
                    </div>`;
      })
      .join('');

    if (!propertiesHtml || propertiesHtml.length === 0) {
      return '';
    }

    return `
            <div class="mt-4 md:text-sm text-xs grid grid-cols-2 gap-3">
                ${propertiesHtml}
            </div>`;
  }

  getSearchResultFooter(
    color = 'white',
    coordinates = null,
    title = '',
    favoriteId = null,
    favMeta = null
  ) {
    if (!coordinates || coordinates.length !== 2) return '';
    const [lng, lat] = coordinates;
    return `
            <div class="popup-footer-outer -mb-6 md:mt-8 mt-5 pt-4 pb-4 rounded-bl-lg rounded-br-lg" >
                <div class="popup-footer-actions flex flex-nowrap gap-1.5 overflow-x-auto pb-0.5 px-4">
                    <button type="button" class="flex-shrink-0 border border-opacity-25 border-${color} px-3 py-1.5 text-sm rounded-full whitespace-nowrap"
                        onclick="window.setDestinationFromPopup && window.setDestinationFromPopup(${JSON.stringify(
                          coordinates
                        )})" style="background-color: var(--popup-text-color); color: var(--popup-text-color-on-primary);"
                    >
                        <svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 12 12" class="react-icon mb-0.5 mr-1" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M4.62515 0.569498C5.38448 -0.189833 6.61582 -0.189833 7.37515 0.569498L11.4308 4.62516C12.19 5.38451 12.1901 6.61589 11.4308 7.37516L7.37515 11.4308C6.61588 12.1901 5.38449 12.19 4.62515 11.4308L0.569489 7.37516C-0.189836 6.61584 -0.189824 5.38449 0.569489 4.62516L4.62515 0.569498ZM7.00015 5.00016H4.50015C3.67173 5.00016 3.00015 5.67173 3.00015 6.50016V8.00016H4.00015V6.50016C4.00015 6.22402 4.22401 6.00016 4.50015 6.00016H7.00015V8.65153L9.10074 5.50016L7.00015 2.34879V5.00016Z"/></svg>
                        Como chegar
                    </button>
                    ${buildFavBtnHtml(lng, lat, title, color, favoriteId, favMeta)}
                    ${
                      ENABLE_COMMENTS
                        ? `
                    <button type="button"
                        class="flex-shrink-0 border border-opacity-25 border-${color} px-3 py-1.5 text-sm rounded-full whitespace-nowrap"
                        onclick="document.dispatchEvent(new CustomEvent('ciclomapa-comment-at', { detail: { lng: ${lng}, lat: ${lat} } }));"
                    >
                        <svg fill="currentColor" viewBox="0 0 12 12" class="react-icon mb-0.5 mr-1">
                          <path fill-rule="evenodd" clip-rule="evenodd" d="M5.5 1.28953e-06C6.7728 1.28953e-06 8.02305 0.101033 9.24609 0.293947C10.2822 0.458667 11 1.43545 11 2.5332V5.92969C10.9998 7.02731 10.2821 8.00424 9.24609 8.16895C8.23004 8.32913 7.19514 8.42589 6.14453 8.4541C6.09235 8.4552 6.0421 8.47721 6.00488 8.5166L3.81348 10.877C3.75856 10.936 3.6884 10.9759 3.6123 10.9922C3.53618 11.0085 3.45745 10.9997 3.38574 10.9678C3.314 10.9358 3.25216 10.882 3.20898 10.8125C3.16593 10.7431 3.14273 10.6615 3.14258 10.5781V8.34668C2.67824 8.30092 2.21523 8.24099 1.75391 8.16797C0.717811 8.00437 0 7.02649 0 5.92871V2.53418C0 1.4364 0.717811 0.457542 1.75391 0.293947C2.99428 0.0978829 4.24634 -0.00041067 5.5 1.28953e-06ZM4.75 4H2.75V5L4.75 5.01465V7H5.75V5.01465L7.75 5V4H5.75V2H4.75V4Z"/>
                        </svg>
                        Comentar
                    </button>`
                        : ''
                    }
                </div>
            </div>
        `;
  }

  showSearchResultPopup({
    lng,
    lat,
    title,
    address,
    placeTypes,
    favoriteId,
    placeId,
    areaContext,
  }) {
    const titleHtml = title
      ? escapeHtml(title)
      : '<span class="font-medium italic opacity-50">Local</span>';
    const addressLine = address ? escapeHtml(address) : '';
    const addressBlock = addressLine
      ? `<div class="text-xs md:text-sm break-words opacity-60 leading-snug">${addressLine}</div>`
      : '';

    const iconHtml = renderPlaceTypeIconHtml(placeTypes);

    const favMeta = {
      subtitle: address || '',
      placeTypes: Array.isArray(placeTypes) ? placeTypes : [],
      placeId: placeId || '',
      areaContext: areaContext || '',
    };

    const html = `
            <div class="flex items-start gap-3 mt-2 mb-3">
                <div class="flex-shrink-0 flex items-start justify-center pt-0.5" aria-hidden="true">${iconHtml}</div>
                <div class="flex-1 min-w-0">
                    <div class="text-base md:text-lg font-semibold leading-tight tracking-tight break-words">${titleHtml}</div>
                    ${addressBlock}
                </div>
            </div>
            ${this.getSearchResultFooter('white', [lng, lat], title || '', favoriteId ?? null, favMeta)}
        `;

    this.searchResultPopup.setLngLat([lng, lat]).setHTML(html).addTo(this.map);
  }

  hideSearchResultPopup() {
    try {
      this.searchResultPopup.remove();
    } catch (e) {
      /* already removed */
    }
  }

  /** Footer for map feature popups (POI, cycleway, …). Favorite control lives only in {@link getSearchResultFooter}. */
  getFooter(osmUrl, color = 'black', coordinates = null) {
    return `
            <div class="popup-footer-outer -mb-6 md:mt-8 mt-5 pt-4 pb-4 rounded-bl-lg rounded-br-lg" >
                <div class="popup-footer-actions flex flex-nowrap gap-1.5 overflow-x-auto pb-0.5 px-4">
                ${
                  (coordinates &&
                    `
                    <button type="button" class="flex-shrink-0 px-3 py-1.5 text-sm rounded-full whitespace-nowrap"
                        onclick="window.setDestinationFromPopup && window.setDestinationFromPopup(${JSON.stringify(coordinates)})" style="background-color: var(--popup-text-color); color: var(--popup-text-color-on-primary);"
                    >
                        <svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 12 12" class="react-icon mb-0.5 mr-1" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M4.62515 0.569498C5.38448 -0.189833 6.61582 -0.189833 7.37515 0.569498L11.4308 4.62516C12.19 5.38451 12.1901 6.61589 11.4308 7.37516L7.37515 11.4308C6.61588 12.1901 5.38449 12.19 4.62515 11.4308L0.569489 7.37516C-0.189836 6.61584 -0.189824 5.38449 0.569489 4.62516L4.62515 0.569498ZM7.00015 5.00016H4.50015C3.67173 5.00016 3.00015 5.67173 3.00015 6.50016V8.00016H4.00015V6.50016C4.00015 6.22402 4.22401 6.00016 4.50015 6.00016H7.00015V8.65153L9.10074 5.50016L7.00015 2.34879V5.00016Z"/></svg>
                        Como chegar
                    </button>
                `) ||
                  ''
                }

                <a class="flex-shrink-0 border border-opacity-25 border-${color} px-3 py-1.5 text-sm rounded-full whitespace-nowrap"
                    target="_blank" rel="noopener"
                    href="${osmUrl}"
                >
                    <svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 12 12" class="react-icon mb-0.5 mr-1" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M1 8.91695V11H3.08304L8.91638 5.16667L6.83333 3.08362L1 8.91695ZM10.8375 3.24552C11.0542 3.02888 11.0542 2.67893 10.8375 2.4623L9.5377 1.16248C9.32107 0.945841 8.97111 0.945841 8.75448 1.16248L7.73795 2.179L9.821 4.26205L10.8375 3.24552Z"/></svg>    
                    Editar
                </a>

                <a  href="#"
                    class="flex-shrink-0 border border-opacity-25 border-${color} px-3 py-1.5 text-sm rounded-full whitespace-nowrap"
                    onClick="document.dispatchEvent(new Event('newComment'));"
                >
                    <svg fill="currentColor" viewBox="0 0 12 12" class="react-icon mb-0.5 mr-1">
                      <path fill-rule="evenodd" clip-rule="evenodd" d="M5.5 1.28953e-06C6.7728 1.28953e-06 8.02305 0.101033 9.24609 0.293947C10.2822 0.458667 11 1.43545 11 2.5332V5.92969C10.9998 7.02731 10.2821 8.00424 9.24609 8.16895C8.23004 8.32913 7.19514 8.42589 6.14453 8.4541C6.09235 8.4552 6.0421 8.47721 6.00488 8.5166L3.81348 10.877C3.75856 10.936 3.6884 10.9759 3.6123 10.9922C3.53618 11.0085 3.45745 10.9997 3.38574 10.9678C3.314 10.9358 3.25216 10.882 3.20898 10.8125C3.16593 10.7431 3.14273 10.6615 3.14258 10.5781V8.34668C2.67824 8.30092 2.21523 8.24099 1.75391 8.16797C0.717811 8.00437 0 7.02649 0 5.92871V2.53418C0 1.4364 0.717811 0.457542 1.75391 0.293947C2.99428 0.0978829 4.24634 -0.00041067 5.5 1.28953e-06ZM4.75 4H2.75V5L4.75 5.01465V7H5.75V5.01465L7.75 5V4H5.75V2H4.75V4Z"/>
                    </svg>
                    Comentar
                </a>
                </div>
            </div>
        `;
  }

  showCommentPopup(e) {
    const coords = e.features[0].geometry.coordinates.slice();
    const properties = e.features[0].properties;

    let html = `
            <div style="color: gray;">
                ${formatTimeAgo(properties.createdAt, { capitalizeFirstLetter: true })}
            </div>

            <div style="
                margin-top: .5em;
                font-size: 18px;">
                ${properties.text}
            </div>
        `;

    if (properties.tags) {
      // Arrays and objects get serialized by Mapbox system
      properties.tags = JSON.parse(properties.tags);

      html += `
                <div style="
                    margin-top: 2em;
                    font-size: 14px;
                    font
                ">
            `;

      properties.tags.forEach((t) => {
        html += `
                    <div class="inline-block py-1 px-3 rounded-full bg-gray-800 text-gray-300 mt-2 text-xs">
                        ${t}
                    </div>
                `;
      });

      html += `</div>`;
    }

    this.commentPopup.setLngLat(coords).setHTML(html).addTo(this.map);
    // Disabled while we probably don't really need it
    // this.attachMobileActiveHandler(this.commentPopup);
  }

  showPOIPopup(e, iconSrc, poiType) {
    const coords = e.lngLat;
    const properties = e.features[0].properties;
    const osmUrl = `https://www.openstreetmap.org/${properties['@id'] || properties.id}`;

    if (this.debugMode) {
      console.debug('POI popup properties:', properties);
    }

    if (this.poiAddressAbortController) {
      this.poiAddressAbortController.abort();
    }
    this.poiAddressAbortController = new AbortController();
    const addressSignal = this.poiAddressAbortController.signal;
    const addressRequestId = ++this.poiAddressRequestId;

    const addressFromOsm = formatAddressLineFromOsmProperties(properties);
    const propertiesForGrid = omitAddressTagsForDetailGrid(properties);

    const poiTypeMapFallback = {
      'poi-bikeshop': 'Oficina/loja (sem nome)',
      'poi-rental': 'Estação de bicicleta (sem nome)',
    };

    const titleHtml = properties.name
      ? escapeHtml(properties.name)
      : poiType === 'poi-bikeparking'
        ? '<span>Bicicletário/paraciclo</span>'
        : `<span class="font-medium italic opacity-50">${poiTypeMapFallback[poiType]}</span>`;

    const addressClassesBase = 'text-xs md:text-sm break-words opacity-60 leading-snug';
    const addressAttrs = addressFromOsm
      ? 'data-poi-address-slot'
      : 'data-poi-address-slot data-poi-address-pending aria-busy="true" aria-label="Carregando endereço"';
    const addressInner = addressFromOsm
      ? escapeHtml(addressFromOsm)
      : `<span class="poi-popup-address-skeleton" aria-hidden="true">
              <span class="poi-popup-address-skeleton__line poi-popup-address-skeleton__line--a"></span>
              <span class="poi-popup-address-skeleton__line poi-popup-address-skeleton__line--b"></span>
            </span>`;

    let html = `
            <div class="flex items-start space-x-3 mt-2 mb-3">
                <img src="${iconSrc}" class="w-9 h-9 md:w-10 md:h-10 flex-shrink-0 mt-0.5 md:mt-1 object-contain" alt="" />
                <div class="flex-1 min-w-0">
                    <div class="text-base md:text-lg font-semibold leading-tight tracking-tight break-words">${titleHtml}</div>
                    <div class="${addressClassesBase}" ${addressAttrs}>${addressInner}</div>
                </div>
            </div>

            ${this.renderProperties(propertiesForGrid)}

            ${this.getFooter(osmUrl, 'white', [coords.lng, coords.lat])}
        `;

    this.poiPopup.setLngLat(coords).setHTML(html).addTo(this.map);

    if (!addressFromOsm) {
      reverseNominatimAddress(coords.lat, coords.lng, {
        signal: addressSignal,
        selectedAreaLabel: this.selectedAreaLabel,
      })
        .then((line) => {
          if (addressRequestId !== this.poiAddressRequestId) return;
          const el = this.poiPopup.getElement()?.querySelector('[data-poi-address-slot]');
          if (!el) return;
          if (line) {
            el.textContent = line;
            el.classList.remove('poi-popup-header__address--pending');
            el.removeAttribute('data-poi-address-pending');
            el.removeAttribute('aria-busy');
            el.removeAttribute('aria-label');
          } else {
            el.remove();
          }
        })
        .catch((err) => {
          if (err.name === 'AbortError') return;
          console.debug('POI address (Nominatim) failed:', err);
          if (addressRequestId !== this.poiAddressRequestId) return;
          this.poiPopup.getElement()?.querySelector('[data-poi-address-pending]')?.remove();
        });
    }
    // Disabeld while we probably don't really need it
    // this.attachMobileActiveHandler(this.poiPopup);

    Analytics.event('view_item', {
      items: [
        {
          item_name: `${poiType} - ${properties.name}`,
          item_variant: poiType,
          item_category: 'map data',
        },
      ],
    });
  }

  showCyclewayPopup(e, layer) {
    const coords = e.lngLat;
    const properties = e.features[0].properties;
    const osmUrl = `https://www.openstreetmap.org/${properties.id}`;
    const bgClass = layer.id;
    this.selectedCycleway = e.features[0].id;

    if (this.previousCyclewayLayerClass) {
      this.cyclewayPopup.removeClassName(this.previousCyclewayLayerClass);
    }
    this.previousCyclewayLayerClass = bgClass;

    let html = `
            <div>
                
                <div class="relative inline-block mt-3 group">
                    <div
                        class="inline-flex items-center py-0 px-2 rounded-full font-semibold tracking-wide cursor-pointer"
                        style="background-color: var(--popup-text-color); color: var(--popup-bg-color);"
                    >
                        ${layer.name}
                    </div>
                    ${
                      layer.description
                        ? `
                        <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs font-normal rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none w-64 z-10">
                            ${layer.description}
                            <div class="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                        </div>
                    `
                        : ''
                    }
                </div>

                <div class="md:text-2xl text-lg mt-2 md:mb-5 mb-3 tracking-tight">
                    ${
                      properties.name
                        ? properties.name
                        : '<span class="italic opacity-50">Via sem nome</span>'
                    }
                </div>

                ${this.renderProperties(properties)}

                ${this.getFooter(osmUrl, 'black', [coords.lng, coords.lat])}
            </div>
        `;

    this.cyclewayPopup.setLngLat(coords).setHTML(html).addTo(this.map);
    this.cyclewayPopup.addClassName(bgClass);
    // Disabeld while we probably don't really need it
    // this.attachMobileActiveHandler(this.cyclewayPopup);

    document
      .querySelector('.popup-big.mapboxgl-popup')
      .style.setProperty('--popup-bg-color', layer.style.lineColor);
    document
      .querySelector('.popup-big.mapboxgl-popup')
      .style.setProperty('--popup-text-color-on-primary', layer.style.lineColor);
    document
      .querySelector('.popup-big.mapboxgl-popup')
      .style.setProperty('--popup-text-color', layer.style.textColor);

    // document.querySelector('.mapboxgl-popup-content').style.backgroundColor = layer.style.lineColor;
    // document.querySelector('.mapboxgl-popup-tip').style.borderTopColor = layer.style.lineColor;
    // document.querySelector('.mapboxgl-popup-tip').style.borderBottomColor = layer.style.lineColor;
    // document.querySelector('.mapboxgl-popup-content').style.color = layer.style.textColor;
    // document.querySelector('.mapboxgl-popup-close-button').style.color = layer.style.textColor;

    Analytics.event('view_item', {
      items: [
        {
          item_name: `${layer.name} - ${properties.name}`,
          item_variant: layer.name,
          item_category: 'map data',
        },
      ],
    });
  }

  hidePopup() {
    this.cyclewayPopup.removeClassName(this.previousCyclewayLayerClass);
    this.previousCyclewayLayerClass = null;

    this.cyclewayPopup.remove();
  }

  // Route tooltip methods
  createRouteTooltipHTML(route, routeIndex, selectedRouteIndex = null) {
    const routeScore = route.score || null;
    const routeScoreClass = route.scoreClass || null;

    // const stateClass = this.getTooltipStateClass(routeIndex, selectedRouteIndex);
    const stateVariables = this.getTooltipStateVariables(routeIndex, selectedRouteIndex);

    const baseClasses =
      'px-2 py-1 text-sm text-xs font-medium shadow-lg cursor-pointer transition-all duration-200 max-w-[200px]';

    return `
            <div class="route-tooltip-content" style="--popup-bg-color: ${stateVariables.bgColor}; --popup-text-color: ${stateVariables.textColor}">
                <div class="${baseClasses}" data-route-index="${routeIndex}">
                    <div class="flex items-center space-x-2">
                        ${
                          routeScore !== null
                            ? `
                            <div class="${routeScoreClass} px-1 py-0.5 text-xs font-mono rounded" style="color: white">
                                ${routeScore}
                            </div>
                        `
                            : ''
                        }
                        ${
                          IS_MOBILE
                            ? ''
                            : `
                            <div class="flex flex-col">
                                <span class="font-semibold">${formatDistance(route.distance)}</span>
                                <span class="text-gray-500">${formatDuration(route.duration)}</span>
                            </div>
                        `
                        }
                    </div>
                </div>
            </div>
        `;
  }

  getTooltipStateVariables(routeIndex, selectedRouteIndex) {
    // Selected route
    if (selectedRouteIndex === routeIndex) {
      return {
        bgColor: this.isDarkMode ? '#ffffff' : '#000000',
        textColor: this.isDarkMode ? '#000000' : '#ffffff',
      };
    }

    // Unselected route
    if (selectedRouteIndex !== null) {
      return {
        bgColor: this.isDarkMode ? '#000000' : '#f5f5f5',
        textColor: this.isDarkMode ? '#d1d1d1' : '#525252',
      };
    }
    return { bgColor: 'inherit', textColor: 'inherit' };
  }

  updateRouteTooltips(directions, onRouteSelected, selectedRouteIndex = null) {
    // Clear existing route tooltips
    this.clearRouteTooltips();

    if (directions && directions.routes && directions.routes.length > 0) {
      directions.routes.forEach((route) => {
        if (!route.geometry || route.geometry.type !== 'LineString') {
          return;
        }

        console.debug('updateRouteTooltips - route', route, route.sortedIndex);

        // Calculate midpoint of the route
        const coordinates = route.geometry.coordinates;
        const percentageSlot = (route.sortedIndex + 1) / (directions.routes.length + 1);
        const midPoint = coordinates[Math.floor(coordinates.length * percentageSlot)];

        // Create popup for this route
        const popup = new mapboxgl.Popup({
          closeButton: false,
          closeOnClick: false,
          closeOnMove: false,
          className: 'route-tooltip-popup',
        })
          .setLngLat(midPoint)
          .setHTML(this.createRouteTooltipHTML(route, route.sortedIndex, selectedRouteIndex))
          .addTo(this.map);

        // Add click handler to the popup content
        popup.getElement().addEventListener('click', (e) => {
          e.stopPropagation();
          if (onRouteSelected) {
            onRouteSelected(route.sortedIndex);
          }
        });

        // Store popup reference for cleanup
        this.routeTooltips.push(popup);
      });

      // Update tooltip states after creation
      this.updateTooltipStates(selectedRouteIndex);
    }
  }

  updateTooltipStates(selectedRouteIndex) {
    if (!this.routeTooltips) return;

    this.routeTooltips.forEach((popup, index) => {
      const contentDiv = popup.getElement();
      if (contentDiv) {
        const stateVariables = this.getTooltipStateVariables(index, selectedRouteIndex);
        contentDiv.style.setProperty('--popup-bg-color', stateVariables.bgColor);
        contentDiv.style.setProperty('--popup-text-color-on-primary', stateVariables.bgColor);
        contentDiv.style.setProperty('--popup-text-color', stateVariables.textColor);
      }
    });
  }

  updateTooltipSelectedState(selectedRouteIndex) {
    this.updateTooltipStates(selectedRouteIndex);
  }

  clearRouteTooltips() {
    this.routeTooltips.forEach((popup) => popup.remove());
    this.routeTooltips = [];
  }

  closeAllPopups() {
    this.poiAddressAbortController?.abort();
    this.poiAddressAbortController = null;
    this.cyclewayPopup.remove();
    this.commentPopup.remove();
    this.poiPopup.remove();
    this.hideSearchResultPopup();
  }
}

export default MapPopups;
