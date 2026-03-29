import { get, set } from 'idb-keyval';

const IDB_WELCOME_BY_CITY_KEY = 'welcomeSeenByCityV2';

export function welcomeLocalStorageKeyForCity(cityKey) {
  return `ciclomapa_welcomeSeen:${encodeURIComponent(cityKey)}`;
}

/**
 * Auto-open welcome About modal once per city (localStorage + idb map, same idea as the old global flag).
 * @param {string} cityKey Stable key from App.getStorageKeyForArea.
 * @param {() => void} openAboutModal
 */
export function runPerCityWelcomeModal(cityKey, openAboutModal) {
  if (!cityKey || typeof cityKey !== 'string') return;

  const lsKey = welcomeLocalStorageKeyForCity(cityKey);
  if (window.localStorage.getItem(lsKey) === '1') return;

  get(IDB_WELCOME_BY_CITY_KEY)
    .then((map) => {
      const m = map && typeof map === 'object' && !Array.isArray(map) ? map : {};
      if (m[cityKey]) {
        try {
          window.localStorage.setItem(lsKey, '1');
        } catch {
          /* ignore */
        }
        return;
      }
      if (window.localStorage.getItem(lsKey) === '1') return;
      try {
        window.localStorage.setItem(lsKey, '1');
      } catch {
        /* ignore */
      }
      openAboutModal();
      return set(IDB_WELCOME_BY_CITY_KEY, { ...m, [cityKey]: true });
    })
    .catch(() => {
      /* idb unavailable: fall back to localStorage only */
      if (window.localStorage.getItem(lsKey) === '1') return;
      try {
        window.localStorage.setItem(lsKey, '1');
      } catch {
        return;
      }
      openAboutModal();
    });
}
