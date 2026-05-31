import { matchPath } from 'react-router-dom';

/** Public privacy notice URL (Play Store, in-app link). Keep in sync with index.js Route. */
export const PRIVACY_POLICY_PATH = '/privacidade';

const privacyPolicyPattern = { path: PRIVACY_POLICY_PATH, end: true };

/** Whether the current URL is the privacy policy route (class components, pre-router init). */
export function isPrivacyPolicyLocation(pathname) {
  if (!pathname || typeof pathname !== 'string') return false;
  const normalized = pathname.replace(/\/$/, '') || '/';
  return Boolean(matchPath(privacyPolicyPattern, normalized));
}
