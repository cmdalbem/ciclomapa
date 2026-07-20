/**
 * Barcelona Bicing live availability (operator GBFS v2.3).
 * https://barcelona.publicbikesystem.net/customer/gbfs/v2/en/
 */

import { API_TYPES, trackCall } from '../../dev/apiTracker.js';

export const BICING_GBFS_BASE = 'https://barcelona.publicbikesystem.net/customer/gbfs/v2/en';
export const BICING_STATION_INFO_URL = `${BICING_GBFS_BASE}/station_information`;
export const BICING_STATION_STATUS_URL = `${BICING_GBFS_BASE}/station_status`;

export const BICING_INFO_TTL_MS = 60 * 60 * 1000;
export const BICING_STATUS_POLL_MS = 45 * 1000;
export const BICING_REF_MATCH_MAX_M = 80;
export const BICING_GEO_MATCH_MAX_M = 40;

const EBIKE_TYPE_IDS = new Set(['BOOST', 'EFIT', 'ASTRO', 'CHLOE', 'COSMO', 'METRO']);

/** Normalize OSM `ref` / GBFS station_id (strip leading zeros on numeric refs). */
export function normalizeStationRef(ref) {
  if (ref == null) return null;
  const s = String(ref).trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return String(parseInt(s, 10));
  return s;
}

export function distanceMeters(lat1, lon1, lat2, lon2) {
  const dlat = (lat1 - lat2) * 111320;
  const dlon = (lon1 - lon2) * 111320 * Math.cos((lat1 * Math.PI) / 180);
  return Math.hypot(dlat, dlon);
}

export function parseLastReportedMs(lastReported) {
  if (lastReported == null) return null;
  if (typeof lastReported === 'number') {
    return lastReported > 1e12 ? lastReported : lastReported * 1000;
  }
  if (typeof lastReported === 'string') {
    const asNum = Number(lastReported);
    if (Number.isFinite(asNum) && /^\d+(\.\d+)?$/.test(lastReported.trim())) {
      return asNum > 1e12 ? asNum : asNum * 1000;
    }
    const parsed = Date.parse(lastReported);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function splitVehicleTypes(vehicleTypesAvailable) {
  let mechanical = 0;
  let ebike = 0;
  if (!Array.isArray(vehicleTypesAvailable)) return { mechanical, ebike };
  for (const entry of vehicleTypesAvailable) {
    const id = String(entry?.vehicle_type_id || '').toUpperCase();
    const count = Number(entry?.count) || 0;
    if (EBIKE_TYPE_IDS.has(id)) ebike += count;
    else mechanical += count;
  }
  return { mechanical, ebike };
}

export function mergeStation(info, status) {
  if (!info || !status) return null;
  const { mechanical, ebike } = splitVehicleTypes(status.vehicle_types_available);
  return {
    stationId: String(info.station_id),
    name: info.name || '',
    address: info.address || '',
    lat: info.lat,
    lon: info.lon,
    capacity: info.capacity,
    bikes: Number(status.num_bikes_available) || 0,
    docks: Number(status.num_docks_available) || 0,
    mechanical,
    ebike,
    isInstalled: !!status.is_installed,
    isRenting: !!status.is_renting,
    isReturning: !!status.is_returning,
    status: status.status || null,
    lastReportedMs: parseLastReportedMs(status.last_reported),
  };
}

/**
 * Match an OSM Estação click to a Bicing station.
 * Prefer `ref` when within BICING_REF_MATCH_MAX_M; else nearest within BICING_GEO_MATCH_MAX_M.
 */
export function matchStationForOsmPoi(stations, { lat, lng, ref }) {
  if (!Array.isArray(stations) || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const normalizedRef = normalizeStationRef(ref);
  if (normalizedRef) {
    const byRef = stations.find((s) => s.stationId === normalizedRef);
    if (byRef && Number.isFinite(byRef.lat) && Number.isFinite(byRef.lon)) {
      if (distanceMeters(lat, lng, byRef.lat, byRef.lon) <= BICING_REF_MATCH_MAX_M) return byRef;
    }
  }

  let best = null;
  let bestD = Infinity;
  for (const s of stations) {
    if (!Number.isFinite(s.lat) || !Number.isFinite(s.lon)) continue;
    const d = distanceMeters(lat, lng, s.lat, s.lon);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best && bestD <= BICING_GEO_MATCH_MAX_M ? best : null;
}

export function stationsToGeoJSON(stations) {
  return {
    type: 'FeatureCollection',
    features: (stations || [])
      .filter((s) => s?.isInstalled && Number.isFinite(s.lon) && Number.isFinite(s.lat))
      .map((s) => ({
        type: 'Feature',
        properties: {
          stationId: s.stationId,
          name: s.name || '',
          address: s.address || '',
          bikes: s.bikes,
          docks: s.docks,
          mechanical: s.mechanical,
          ebike: s.ebike,
        },
        geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
      })),
  };
}

async function fetchJson(url, details, signal) {
  trackCall({ api: API_TYPES.BICING_GBFS, details });
  const res = await fetch(url, signal ? { signal } : undefined);
  if (!res.ok) throw new Error(`Bicing GBFS ${res.status}: ${url}`);
  return res.json();
}

/** Polls station_information (cached) + station_status. */
export function createBicingLiveFeed({
  onUpdate,
  pollMs = BICING_STATUS_POLL_MS,
  infoTtlMs = BICING_INFO_TTL_MS,
} = {}) {
  let running = false;
  let timer = null;
  let abortController = null;
  let infoCache = null;
  let infoFetchedAt = 0;
  let stations = [];

  async function ensureInfo(signal) {
    const now = Date.now();
    if (infoCache && now - infoFetchedAt < infoTtlMs) return infoCache;
    const json = await fetchJson(BICING_STATION_INFO_URL, 'station_information', signal);
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    infoCache = json?.data?.stations || [];
    infoFetchedAt = now;
    return infoCache;
  }

  async function refresh() {
    if (!running) return;
    abortController?.abort();
    abortController = new AbortController();
    const { signal } = abortController;
    try {
      const [infoList, statusJson] = await Promise.all([
        ensureInfo(signal),
        fetchJson(BICING_STATION_STATUS_URL, 'station_status', signal),
      ]);
      if (signal.aborted || !running) return;

      const statusById = new Map(
        (statusJson?.data?.stations || []).map((s) => [String(s.station_id), s])
      );
      stations = infoList
        .map((info) => mergeStation(info, statusById.get(String(info.station_id))))
        .filter(Boolean);
      onUpdate?.(stations);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      console.debug('Bicing GBFS refresh failed:', err);
    }
  }

  function scheduleNext() {
    clearTimeout(timer);
    if (!running) return;
    timer = setTimeout(async () => {
      await refresh();
      scheduleNext();
    }, pollMs);
  }

  return {
    start() {
      if (running) return;
      running = true;
      refresh().then(scheduleNext);
    },
    stop() {
      running = false;
      clearTimeout(timer);
      timer = null;
      abortController?.abort();
      abortController = null;
    },
    getStations: () => stations,
    isRunning: () => running,
  };
}
