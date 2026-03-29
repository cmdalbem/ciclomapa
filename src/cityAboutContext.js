import { getPredefinedCityStaticLocation } from './config/citySlugCatalog.js';

export const CITY_ABOUT_OSM_URL = 'https://www.openstreetmap.org/';
export const CITY_ABOUT_OSM_CONTRIBUTE_URL = 'https://www.openstreetmap.org/fixthemap';

export function primaryPlaceName(areaLabel) {
  if (!areaLabel || typeof areaLabel !== 'string') return '';
  return areaLabel.split(',')[0].trim();
}

/**
 * @param {string | undefined} canonicalSlug
 * @returns {{ canonicalSlug: string; primary: string; fullLabel: string } | null}
 */
export function getCityAboutContext(canonicalSlug) {
  if (!canonicalSlug) return null;
  const staticLocation = getPredefinedCityStaticLocation(canonicalSlug);
  if (!staticLocation?.areaLabel) return null;
  return {
    canonicalSlug,
    primary: primaryPlaceName(staticLocation.areaLabel),
    fullLabel: staticLocation.areaLabel,
  };
}
