import { MAX_RECENT_ITEMS_STORED } from './config/constants.js';

const FAVORITES_STORAGE_KEY = 'ciclomapa_favorites_v1';
const RECENT_ITEMS_STORAGE_KEY = 'ciclomapa_recent_items_v1';

export type FavoriteItem = {
  id: string;
  title: string;
  subtitle: string;
  lng: number;
  lat: number;
  /**
   * City-level label aligned with `getAreaStringFromResultLike` (e.g. "Porto Alegre, RS, Brasil").
   * Not a street address; used for app `state.area` when opening this place.
   */
  areaContext?: string;
  /** Google `place_id` when the favorite was created from search (used to mark list rows). */
  placeId?: string;
  placeTypes?: string[];
  addedAt: number;
};

export type RecentItem = {
  id: string;
  type: 'city' | 'place';
  title: string;
  subtitle: string;
  /** Same semantics as {@link FavoriteItem.areaContext} for `type === 'place'`. */
  areaContext?: string;
  /** City slug for type=city, place_id or coord-hash for type=place */
  citySlug?: string;
  lng?: number;
  lat?: number;
  placeTypes?: string[];
  visitedAt: number;
};

function makePlaceId(lng: number, lat: number, title: string): string {
  return `place:${lng.toFixed(6)},${lat.toFixed(6)}:${title}`;
}

function makeCityId(slug: string): string {
  return `city:${slug}`;
}

// --- Favorites ---

export function readFavorites(): FavoriteItem[] {
  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item: unknown): item is FavoriteItem =>
        !!item &&
        typeof item === 'object' &&
        typeof (item as FavoriteItem).id === 'string' &&
        typeof (item as FavoriteItem).lng === 'number' &&
        typeof (item as FavoriteItem).lat === 'number'
    );
  } catch {
    return [];
  }
}

export function writeFavorites(items: FavoriteItem[]): void {
  try {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(items));
  } catch {}
}

export function addFavorite(fav: Omit<FavoriteItem, 'id' | 'addedAt'>): FavoriteItem[] {
  const id = makePlaceId(fav.lng, fav.lat, fav.title);
  const items = readFavorites();
  if (items.some((f) => f.id === id)) return items;
  const newItem: FavoriteItem = { ...fav, id, addedAt: Date.now() };
  const next = [newItem, ...items];
  writeFavorites(next);
  return next;
}

export function removeFavorite(id: string): FavoriteItem[] {
  const items = readFavorites().filter((f) => f.id !== id);
  writeFavorites(items);
  return items;
}

export function isFavorite(lng: number, lat: number, title: string): boolean {
  const id = makePlaceId(lng, lat, title);
  return readFavorites().some((f) => f.id === id);
}

/** Reliable match for map markers that carry the persisted `FavoriteItem.id` in GeoJSON props. */
export function isFavoriteById(id: string | undefined | null): boolean {
  if (id == null || id === '') return false;
  return readFavorites().some((f) => f.id === id);
}

export function toggleFavorite(fav: Omit<FavoriteItem, 'id' | 'addedAt'>): {
  favorites: FavoriteItem[];
  added: boolean;
} {
  const id = makePlaceId(fav.lng, fav.lat, fav.title);
  const items = readFavorites();
  const exists = items.some((f) => f.id === id);
  if (exists) {
    return { favorites: removeFavorite(id), added: false };
  }
  return { favorites: addFavorite(fav), added: true };
}

export function getFavoriteId(lng: number, lat: number, title: string): string {
  return makePlaceId(lng, lat, title);
}

// --- Recent items (unified: cities + places) ---

export function readRecentItems(): RecentItem[] {
  try {
    const raw = window.localStorage.getItem(RECENT_ITEMS_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item: unknown): item is RecentItem =>
        !!item &&
        typeof item === 'object' &&
        typeof (item as RecentItem).id === 'string' &&
        typeof (item as RecentItem).title === 'string'
    );
  } catch {
    return [];
  }
}

function writeRecentItems(items: RecentItem[]): void {
  try {
    window.localStorage.setItem(
      RECENT_ITEMS_STORAGE_KEY,
      JSON.stringify(items.slice(0, MAX_RECENT_ITEMS_STORED))
    );
  } catch {}
}

export function addRecentCity(slug: string, areaLabel: string): RecentItem[] {
  const id = makeCityId(slug);
  const items = readRecentItems().filter((r) => r.id !== id);
  const [title, ...rest] = areaLabel.split(',').map((s) => s.trim());
  const newItem: RecentItem = {
    id,
    type: 'city',
    title: title || slug,
    subtitle: rest.join(', '),
    citySlug: slug,
    visitedAt: Date.now(),
  };
  const next = [newItem, ...items].slice(0, MAX_RECENT_ITEMS_STORED);
  writeRecentItems(next);
  return next;
}

export function addRecentPlace(place: {
  lng: number;
  lat: number;
  title: string;
  subtitle: string;
  placeTypes?: string[];
  areaContext?: string;
}): RecentItem[] {
  const id = makePlaceId(place.lng, place.lat, place.title);
  const items = readRecentItems().filter((r) => r.id !== id);
  const newItem: RecentItem = {
    id,
    type: 'place',
    title: place.title,
    subtitle: place.subtitle,
    lng: place.lng,
    lat: place.lat,
    placeTypes: place.placeTypes,
    areaContext: place.areaContext,
    visitedAt: Date.now(),
  };
  const next = [newItem, ...items].slice(0, MAX_RECENT_ITEMS_STORED);
  writeRecentItems(next);
  return next;
}
