import { getCanonicalCitySlug } from './config/citySlugCatalog.js';
import { removeAccents, slugify } from './utils/utils.js';

/**
 * URL slug for an Airtable `location` (or a full area label). Unknown cities still get a slug;
 * the catalog is only used to canonicalize aliases, not to gate anything.
 * @param {string|null|undefined} location
 * @returns {string|null}
 */
export function citySlugFromLocationLabel(location) {
  if (!location || typeof location !== 'string') return null;
  const cityName = location.split(',')[0]?.trim();
  if (!cityName) return null;
  const slug = slugify(cityName);
  return slug ? getCanonicalCitySlug(slug) : null;
}

function numericField(fields, key) {
  const raw = fields?.[key];
  if (raw === undefined || raw === null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function historyFromFields(fields, yearPrefix) {
  const history = {};
  if (!yearPrefix || !fields) return history;
  for (const key of Object.keys(fields)) {
    if (!key.startsWith(yearPrefix)) continue;
    const rest = key.slice(yearPrefix.length);
    if (!/^\d{4}$/.test(rest)) continue;
    const n = numericField(fields, key);
    if (n === null) continue;
    history[Number(rest)] = n;
  }
  return history;
}

function mergeHistory(loser, winner) {
  if (!loser && !winner) return undefined;
  return { ...(loser || {}), ...(winner || {}) };
}

/**
 * Year keys present on at least one ranking row, oldest first.
 * @param {Array<{ history?: Record<number, number> }>|null|undefined} rows
 * @returns {number[]}
 */
export function metricHistoryYears(rows) {
  const years = new Set();
  for (const row of rows || []) {
    if (!row?.history) continue;
    for (const key of Object.keys(row.history)) {
      const year = Number(key);
      if (Number.isFinite(year)) years.add(year);
    }
  }
  return [...years].sort((a, b) => a - b);
}

/**
 * Cities that have a numeric value for `field`, highest first.
 * @param {Array<{ fields?: Record<string, unknown> }>|null|undefined} records
 * @param {string} field
 * @param {{ yearPrefix?: string }} [options]
 * @returns {Array<{ cityName: string, slug: string, value: number, history?: Record<number, number> }>}
 */
export function listCitiesWithMetric(records, field, options = {}) {
  if (!Array.isArray(records) || !field) return [];

  const yearPrefix = options.yearPrefix;
  const rows = [];
  const indexBySlug = new Map();

  for (const rec of records) {
    const fields = rec?.fields;
    if (!fields || typeof fields !== 'object') continue;
    const location = fields.location;
    if (!location || typeof location !== 'string') continue;
    const value = numericField(fields, field);
    if (value === null) continue;
    const cityName = location.split(',')[0].trim();
    const slug = citySlugFromLocationLabel(cityName);
    if (!cityName || !slug) continue;

    const history = yearPrefix ? historyFromFields(fields, yearPrefix) : undefined;
    const row = history ? { cityName, slug, value, history } : { cityName, slug, value };

    const existingIndex = indexBySlug.get(slug);
    if (existingIndex !== undefined) {
      const existing = rows[existingIndex];
      if (value > existing.value) {
        const history = yearPrefix ? mergeHistory(existing.history, row.history) : undefined;
        rows[existingIndex] = history ? { ...row, history } : row;
      } else if (yearPrefix) {
        existing.history = mergeHistory(row.history, existing.history);
      }
      continue;
    }
    indexBySlug.set(slug, rows.length);
    rows.push(row);
  }

  rows.sort((a, b) => b.value - a.value || a.cityName.localeCompare(b.cityName, 'pt-BR'));
  return rows;
}

class AirtableDatabase {
  /**
   * Find the Metadata row whose `location` is contained in the current area label.
   * @param {Array<{ fields?: { location?: string } }>|null|undefined} records
   * @param {string|null|undefined} areaLabel
   * @returns {Record<string, unknown>|null}
   */
  matchCityMetadataFields(records, areaLabel) {
    if (
      !Array.isArray(records) ||
      records.length === 0 ||
      !areaLabel ||
      typeof areaLabel !== 'string'
    ) {
      return null;
    }
    const normalizedArea = removeAccents(areaLabel.toLowerCase());
    const hit = records.find((row) => {
      const loc = row?.fields?.location;
      if (!loc || typeof loc !== 'string') return false;
      return normalizedArea.includes(removeAccents(loc.toLowerCase()));
    });
    return hit?.fields ?? null;
  }

  async request(path, options) {
    const response = await fetch(path, options);
    if (!response.ok) {
      let message = 'Airtable request failed';
      try {
        const body = await response.json();
        if (body && typeof body.error === 'string' && body.error.trim()) {
          message = body.error;
        }
      } catch {
        // keep generic message
      }
      const err = new Error(message);
      err.status = response.status;
      throw err;
    }
    return response.json();
  }

  async getMetadata() {
    return this.request('/api/airtable/metadata');
  }

  async getComments({ fresh = false, all = false } = {}) {
    const params = new URLSearchParams();
    if (fresh) params.set('fresh', '1');
    if (all) params.set('all', '1');
    const query = params.toString();
    const path = query ? `/api/airtable/comments?${query}` : '/api/airtable/comments';
    return this.request(path);
  }

  async create(fields) {
    return this.request('/api/airtable/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
  }
}

export default AirtableDatabase;
