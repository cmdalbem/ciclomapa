/* eslint-disable no-loop-func */
import osmtogeojson from 'osmtogeojson';

import { appNotification } from './antdNotification';

import {
  DEFAULT_BORDER_WIDTH,
  OVERPASS_SERVERS,
  AREA_ID_OVERRIDES,
  BLACKLISTED_CITIES_FOR_EXTRA_LAYERS,
  ENABLE_BOUNDARY_LAYER,
  CICLOMAPA_USER_AGENT,
} from './config/constants.js';
import { API_TYPES, trackCall } from './dev/apiTracker.js';
import { slugify } from './utils/utils.js';

import * as layersDefinitions from './config/layers.json';

const OSM_FETCH_HEADERS = {
  Accept: 'application/json',
  'User-Agent': CICLOMAPA_USER_AGENT,
};

class OSMController {
  static async searchNominatim(query, options = {}) {
    const {
      limit = 10,
      addressdetails = 1,
      format = 'json',
      featureType,
      acceptLanguage,
      countrycodes,
      layer,
      bounded,
      viewbox,
      ...extraParams
    } = options;

    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('format', format);
    url.searchParams.set('q', query);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('addressdetails', String(addressdetails));
    if (featureType) {
      url.searchParams.set('featureType', String(featureType));
    }
    if (acceptLanguage) {
      url.searchParams.set('accept-language', String(acceptLanguage));
    }
    if (countrycodes) {
      const value = Array.isArray(countrycodes) ? countrycodes.join(',') : String(countrycodes);
      url.searchParams.set('countrycodes', value);
    }
    if (layer) {
      const value = Array.isArray(layer) ? layer.join(',') : String(layer);
      url.searchParams.set('layer', value);
    }
    if (bounded !== undefined) {
      url.searchParams.set('bounded', String(bounded ? 1 : 0));
    }
    if (viewbox) {
      const value = Array.isArray(viewbox) ? viewbox.join(',') : String(viewbox);
      url.searchParams.set('viewbox', value);
    }
    Object.entries(extraParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });

    trackCall({ api: API_TYPES.NOMINATIM_SEARCH, details: query });

    const response = await fetch(url.toString(), {
      headers: OSM_FETCH_HEADERS,
    });
    if (!response.ok) {
      throw new Error(`Nominatim search failed (${response.status})`);
    }
    return response.json();
  }

  static normalizeAreaNameFromNominatimDisplayName(displayName) {
    if (!displayName) return '';
    const parts = displayName
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length <= 3) return parts.join(', ');
    return parts.slice(0, 3).join(', ');
  }

  static normalizeAreaNameFromNominatimResult(result) {
    if (!result || typeof result !== 'object') return '';

    const address = result.address || {};
    const city =
      address.city ||
      address.municipality ||
      address.town ||
      address.village ||
      address.county ||
      result.name ||
      '';
    const state = address.state || address.state_district || '';
    const country = address.country || '';

    const parts = [city, state, country].map((p) => String(p).trim()).filter(Boolean);
    if (parts.length > 0) return parts.join(', ');

    return OSMController.normalizeAreaNameFromNominatimDisplayName(result.display_name);
  }

  // getQuery() converts our CicloMapa layers filter syntax to the OSM Overpass query syntax
  // Example:
  //      "filters": [
  //          [["highway","track"],["bicycle","designated"]],
  //          [["highway","track"],["bicycle","yes"]],
  //          [["highway","path"],["bicycle","designated"]],
  //          [["highway","path"],["bicycle","yes"]]
  //      ],
  //
  //  ...becomes:
  //
  //      way["highway"="track"]["bicycle"="designated"](area.a);
  //      way["highway"="track"]["bicycle"="yes"](area.a);
  //      way["highway"="path"]["bicycle"="designated"](area.a);
  //      way["highway"="path"]["bicycle"="yes"](area.a);
  static getQuery(constraints) {
    const bbox = constraints.bbox;
    const areaId = constraints.areaId;

    const isBlacklisted = areaId && BLACKLISTED_CITIES_FOR_EXTRA_LAYERS.includes(areaId);
    const extraLayersToExclude = ['Baixa velocidade', 'Trilha', 'Proibido'];

    const filteredLayers = layersDefinitions.default.filter((l) => {
      if (!l.filters) return false;
      if (isBlacklisted && extraLayersToExclude.includes(l.name)) {
        return false;
      }
      return true;
    });

    const body = filteredLayers
      .map((l) =>
        (l.type === 'poi' ? ['node', 'way'] : ['way'])
          .map((element) =>
            l.filters
              .map(
                (f) =>
                  element +
                  (typeof f[0] === 'string'
                    ? `["${f[0]}"="${f[1]}"]`
                    : f.map((f_inner) => `["${f_inner[0]}"="${f_inner[1]}"]`).join('')) +
                  (bbox ? `(${bbox});\n` : `(area.a);\n`)
              )
              .join('')
          )
          .join('')
      )
      .join('');

    const boundaryQuery =
      !bbox && ENABLE_BOUNDARY_LAYER
        ? `
                rel(area.a)["boundary"="administrative"]["admin_level"~"^(6|7|8|9|10)$"];
                out geom;
            `
        : '';

    return `
            [out:json][timeout:500];
            ${!bbox && `area(${areaId})->.a;`}
            ${boundaryQuery}
            (
                ${body}
            );
            out body geom;
        `;
  }

  static getLayers(isDarkMode, isDebugMode) {
    let layers = layersDefinitions.default.map((layer) => ({
      ...layer,
      style: layer.style ? { ...layer.style } : undefined,
    }));

    layers.forEach((l) => {
      // Generate an ID based on name
      l.id = slugify(l.name);

      // Omitted values
      l.isActive = l.isActive !== undefined ? l.isActive : true;
      l.type = l.type || 'way';
      if (l.style) {
        if (isDarkMode) {
          l.style.lineColor = l.style.lineColorDark ? l.style.lineColorDark : l.style.lineColor;
          l.style.textColor = l.style.textColorDark ? l.style.textColorDark : l.style.textColor;
        }

        l.style.lineStyle = l.style.lineStyle || 'solid';

        if (l.style.borderColor) {
          l.style.borderStyle = l.style.borderStyle || 'solid';
          l.style.borderWidth = l.style.borderWidth || DEFAULT_BORDER_WIDTH;
        }
      }
    });

    if (!isDebugMode) {
      layers = layers.filter((l) => !l.onlyDebug || (l.onlyDebug && l.onlyDebug === false));
    }

    return layers;
  }

  static getAreaId(areaName) {
    return new Promise((resolve, reject) => {
      const overriden = AREA_ID_OVERRIDES[areaName];
      if (overriden) {
        resolve(overriden);
      } else {
        OSMController.searchNominatim(areaName, { limit: 10, addressdetails: 0 })
          .then((nominatimData) => {
            console.debug('nominatimData', nominatimData);

            if (nominatimData.length > 0) {
              // This tries to replicate the behavior of the "geocodeArea" filter on Overpass Turbo.
              // Gets the first 'relation' result from Nomatim and extract its corresponding area.
              // Source: https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL#By_area_.28area.29
              let osmId;
              for (let i = 0; i < nominatimData.length && osmId === undefined; i++) {
                console.log('nominatimData[i]', nominatimData[i]);
                if (nominatimData[i].osm_type === 'relation') {
                  osmId = nominatimData[i].osm_id;
                }
              }
              // Fallback if there's no relation in search results. Not sure if it's needed, but just in case.
              if (!osmId) {
                osmId = nominatimData[0].osm_id;
              }

              let areaId = 3600000000 + osmId;

              resolve(areaId);
            } else {
              reject(new Error('Area not found'));
            }
          })
          .catch((e) => {
            console.error('Deu erro! Saca só:', e);
            appNotification.error({
              title: 'Erro',
              description: 'Ops, erro na API do Nominatim. Abra o console para ver mais detalhes.',
            });

            reject(e);
          });
      }
    });
  }

  static getData(constraints) {
    let isAborted = false;
    const serverControllers = [];

    const promise = new Promise((resolve, reject) => {
      this.getAreaId(constraints.area)
        .then((areaId) => {
          if (isAborted) {
            reject(new Error('Request aborted'));
            return;
          }

          const query = OSMController.getQuery({
            areaId,
            areaName: constraints.area,
          });
          console.debug('generated query: ', query);

          const encodedQuery = encodeURI(query);

          trackCall({ api: API_TYPES.OVERPASS, details: constraints.area });

          let pending = OVERPASS_SERVERS.length;
          let resolved = false;

          OVERPASS_SERVERS.forEach((server, i) => {
            const endpoint = server + '?data=' + encodedQuery;
            const controller = new AbortController();
            serverControllers[i] = controller;

            console.debug(`[SERVER #${i}] ${server}`);

            fetch(endpoint, {
              signal: controller.signal,
              headers: OSM_FETCH_HEADERS,
            })
              .then(async (response) => {
                if (!response.ok) {
                  // Overpass often returns HTML error bodies (busy / timeout / rate limit).
                  const body = (await response.text().catch(() => '')).slice(0, 240);
                  throw new Error(
                    `Overpass HTTP ${response.status} ${response.statusText}${body ? `: ${body}` : ''}`
                  );
                }
                return response.json();
              })
              .then((data) => {
                if (isAborted || resolved) {
                  return;
                }

                if (data.elements && data.elements.length > 0) {
                  console.debug(`[SERVER #${i}] Success!`);
                  resolved = true;
                  serverControllers.forEach((c, r) => {
                    if (r !== i) {
                      console.debug(`[SERVER #${r}] Aborting`);
                      c.abort();
                    }
                  });

                  console.debug('osm data: ', data);

                  const geoJson = osmtogeojson(
                    { elements: data.elements },
                    { flatProperties: true }
                  );

                  console.debug('converted to geoJSON: ', geoJson);

                  resolve({
                    geoJson: geoJson,
                  });
                } else {
                  console.debug(`[SERVER #${i}] Empty result`);
                  pending -= 1;
                  if (pending === 0 && !resolved) {
                    console.debug(
                      `[SERVER #${i}] I was the last one, so probably the result is empty.`
                    );
                    resolve({
                      geoJson: null,
                    });
                  }
                }
              })
              .catch((e) => {
                if (e.name === 'AbortError' || isAborted || resolved) {
                  return;
                }
                // Per-server busy/timeouts are expected while we race fallbacks.
                // Don't console.error or Sentry (captureConsole) treats them as app errors.
                console.debug(`[SERVER #${i}] ${e.message || e}`);
                pending -= 1;
                if (pending === 0 && !resolved) {
                  console.warn(
                    `All Overpass servers failed or returned empty for "${constraints.area}"`
                  );
                  resolve({
                    geoJson: null,
                  });
                }
              });
          });
        })
        .catch((e) => {
          if (!isAborted) {
            console.error(e);
            reject(e);
          }
        });
    });

    // Add abort method to the promise
    promise.abort = () => {
      console.debug('OSM request aborted');
      isAborted = true;
      serverControllers.forEach((controller) => controller.abort());
    };

    return promise;
  }
}

export default OSMController;
