import { matchPath } from 'react-router-dom';

/** Public privacy notice URL (Play Store, in-app link). Keep in sync with index.js Route. */
export const PRIVACY_POLICY_PATH = '/privacidade';

/** City picker is open when this query param is present (`?buscar` or `?buscar=`). */
export const CITY_PICKER_QUERY_PARAM = 'buscar';

export function searchWithCityPicker(search, open) {
  const params = new URLSearchParams(search || '');
  if (open) {
    if (!params.has(CITY_PICKER_QUERY_PARAM)) params.set(CITY_PICKER_QUERY_PARAM, '');
  } else {
    params.delete(CITY_PICKER_QUERY_PARAM);
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

const privacyPolicyPattern = { path: PRIVACY_POLICY_PATH, end: true };

/** Whether the current URL is the privacy policy route (class components, pre-router init). */
export function isPrivacyPolicyLocation(pathname) {
  if (!pathname || typeof pathname !== 'string') return false;
  const normalized = pathname.replace(/\/$/, '') || '/';
  return Boolean(matchPath(privacyPolicyPattern, normalized));
}
