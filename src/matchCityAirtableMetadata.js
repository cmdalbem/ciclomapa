import { removeAccents } from './utils/utils.js';

/**
 * Find the Airtable Metadata row whose `location` is contained in the current area label
 * (same rule as AnalyticsSidebar).
 * @param {Array<{ fields: { location?: string } }>|null|undefined} records
 * @param {string|null|undefined} areaLabel
 * @returns {Record<string, unknown>|null}
 */
export function matchCityAirtableFields(records, areaLabel) {
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
