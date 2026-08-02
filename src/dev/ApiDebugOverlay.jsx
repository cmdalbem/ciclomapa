import React, { useEffect, useRef, useState } from 'react';
import { HiOutlineChevronDown as IconChevron } from 'react-icons/hi';
import { HiBugAnt as IconDebug, HiOutlineXMark as IconClose } from 'react-icons/hi2';
import { IS_MOBILE, TOPBAR_HEIGHT } from '../config/constants.js';
import {
  API_COLORS,
  API_GROUPS,
  API_LABELS,
  API_TYPES,
  BRAND_LOGO_SVG,
  BRAND_LOGO_URLS,
  subscribe,
} from './apiTracker.js';
import { DATA_SOURCE_STATUS, subscribeDataLoads } from './dataLoadTracker.js';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-500.css';
import '@fontsource/jetbrains-mono/latin-700.css';

const MONO = "font-['JetBrains_Mono',ui-monospace,monospace] tabular-nums tracking-tight";

const DATA_STATUS_TEXT = {
  [DATA_SOURCE_STATUS.IDLE]: 'not loaded yet',
  [DATA_SOURCE_STATUS.LOADING]: 'loading…',
  [DATA_SOURCE_STATUS.SUCCESS]: 'loaded',
  [DATA_SOURCE_STATUS.EMPTY]: 'no cached data',
  [DATA_SOURCE_STATUS.ABORTED]: 'aborted',
  [DATA_SOURCE_STATUS.ERROR]: 'error',
};

const BADGE_SHORT = {
  [API_TYPES.GOOGLE_GEOCODING]: 'Geocode',
  [API_TYPES.GOOGLE_PREDICTIONS]: 'Predictions',
  [API_TYPES.GOOGLE_PLACE_DETAILS]: 'Place Details',
  [API_TYPES.MAPBOX_GEOCODING]: 'Geocoding',
  [API_TYPES.MAPBOX_DIRECTIONS]: 'Directions',
  [API_TYPES.NOMINATIM_SEARCH]: 'Nominatim',
  [API_TYPES.NOMINATIM_REVERSE]: 'Nominatim Rev',
  [API_TYPES.OVERPASS]: 'Overpass',
  [API_TYPES.GRAPHHOPPER]: 'GraphHopper',
  [API_TYPES.VALHALLA]: 'Valhalla',
  [API_TYPES.ORS]: 'OpenRoute',
  [API_TYPES.AIRTABLE_READ]: 'Read',
  [API_TYPES.AIRTABLE_WRITE]: 'Write',
  [API_TYPES.FIREBASE_READ]: 'Read',
  [API_TYPES.FIREBASE_WRITE]: 'Write',
};

const API_BRAND = Object.fromEntries(
  API_GROUPS.flatMap((group) => (group.brand ? group.types.map((type) => [type, group.brand]) : []))
);

function formatTime(timestamp) {
  const d = new Date(timestamp);
  return d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function BrandLogo({ brand }) {
  if (!brand) return null;

  if (BRAND_LOGO_SVG[brand]) {
    return (
      <span
        className="flex h-[11px] w-[11px] shrink-0"
        dangerouslySetInnerHTML={{ __html: BRAND_LOGO_SVG[brand] }}
      />
    );
  }

  if (BRAND_LOGO_URLS[brand]) {
    return (
      <img
        className="h-[11px] w-[11px] shrink-0 object-contain"
        src={BRAND_LOGO_URLS[brand]}
        alt={brand}
      />
    );
  }

  return null;
}

function LogService({ api }) {
  const brand = API_BRAND[api];
  return (
    <>
      <span className="flex h-3 w-3 items-center justify-center">
        {brand ? <BrandLogo brand={brand} /> : null}
      </span>
      <span className={`${MONO} truncate text-gray-200`}>{BADGE_SHORT[api] ?? api}</span>
    </>
  );
}

function GroupRow({ group, counts }) {
  const groupTotal = group.types.reduce((sum, t) => sum + (counts[t] || 0), 0);
  const activeTypes = group.types.filter((type) => (counts[type] || 0) > 0);
  const hasBreakdown = group.types.length > 1 && activeTypes.length > 0;

  return (
    <div className="border-b border-white border-opacity-5 px-2.5 py-[5px] last:border-b-0">
      <div className="flex items-center gap-[7px]">
        <div className="flex min-w-0 flex-1 items-center gap-[5px]">
          {group.brand && <BrandLogo brand={group.brand} />}
          <span className="truncate font-normal text-gray-200">{group.label}</span>
        </div>
        <span
          className={`min-w-[20px] text-right font-bold ${groupTotal > 0 ? '' : 'text-gray-700'}`}
          style={groupTotal > 0 ? { color: group.color } : undefined}
        >
          {groupTotal}
        </span>
      </div>

      {hasBreakdown && (
        <div className="mt-[3px] pl-4">
          {activeTypes.map((type) => (
            <div key={type} className="mt-0.5 flex items-center gap-1.5">
              <span className={`${MONO} flex-1 text-gray-500`}>{API_LABELS[type]}</span>
              <span className="min-w-[20px] text-right font-bold text-gray-400">
                {counts[type]}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DataSourceRow({ source }) {
  const { label, status, durationMs, meta = {}, error } = source;
  const isLoading = status === DATA_SOURCE_STATUS.LOADING;
  const isError = status === DATA_SOURCE_STATUS.ERROR;

  const metaNodes = [];
  if (meta.area) metaNodes.push(<span key="area">{meta.area}</span>);
  if (typeof meta.features === 'number') {
    metaNodes.push(
      <span key="features" className={MONO}>
        {meta.features} features
      </span>
    );
  }
  if (meta.file) {
    metaNodes.push(
      <span key="file" className={MONO}>
        {meta.file}
      </span>
    );
  }
  if (!isLoading && typeof durationMs === 'number') {
    metaNodes.push(
      <span key="dur" className={MONO}>
        {durationMs}ms
      </span>
    );
  }

  return (
    <div className="flex items-start gap-[7px] border-b border-white border-opacity-5 px-2.5 py-1 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="flex-1 truncate font-normal text-gray-200">{label}</span>
          <span
            className={`shrink-0 ${isError ? 'text-red-500' : 'text-gray-500'}${isLoading ? ' animate-pulse' : ''}`}
          >
            {DATA_STATUS_TEXT[status] ?? status}
          </span>
        </div>
        {(metaNodes.length > 0 || error) && (
          <div className="mt-0.5 truncate text-gray-500">
            {error ? (
              <span className={MONO}>{error}</span>
            ) : (
              metaNodes.reduce((acc, node, i) => {
                if (i > 0) acc.push(<span key={`sep-${i}`}> · </span>);
                acc.push(node);
                return acc;
              }, [])
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const COLLAPSED_DATA_SOURCES = [
  { key: 'geojson-cache', label: 'GeoJSON' },
  { key: 'geojson-osm', label: 'GeoJSON' },
  { key: 'pmtiles', label: 'PMTiles' },
];

function collapsedDataSourceValue(source) {
  if (source.status === DATA_SOURCE_STATUS.LOADING) return '…';
  if (source.status === DATA_SOURCE_STATUS.ERROR) return '!';
  if (source.status === DATA_SOURCE_STATUS.ABORTED) return '×';
  if (source.status === DATA_SOURCE_STATUS.EMPTY) return '∅';
  if (source.meta?.file) return source.meta.file.replace(/\.pmtiles$/i, '');
  if (typeof source.meta?.features === 'number') return source.meta.features;
  return '✓';
}

function CollapsedDataSources({ sources }) {
  const items = COLLAPSED_DATA_SOURCES.map(({ key, label }) => {
    const source = sources[key];
    if (!source || source.status === DATA_SOURCE_STATUS.IDLE) return null;
    return {
      key,
      label,
      title: source.label,
      isError: source.status === DATA_SOURCE_STATUS.ERROR,
      value: collapsedDataSourceValue(source),
    };
  }).filter(Boolean);

  if (items.length === 0) return null;

  return (
    <>
      {items.map((item) => (
        <div key={item.key} className="flex shrink-0 items-center gap-1" title={item.title}>
          <span
            className={`${MONO} font-normal ${item.isError ? 'text-red-500' : 'text-gray-400'}`}
          >
            {item.value}
          </span>
        </div>
      ))}
      <span className="w-px shrink-0 self-stretch bg-white bg-opacity-10" />
    </>
  );
}

function CollapsedSummary({ counts, dataSources }) {
  const items = [];
  for (const group of API_GROUPS) {
    if (group.summaryPerType) {
      for (const type of group.types) {
        const total = counts[type] || 0;
        if (total > 0) {
          items.push({
            key: type,
            label: API_LABELS[type],
            short: BADGE_SHORT[type] ?? type,
            color: API_COLORS[type] ?? group.color,
            total,
          });
        }
      }
    } else {
      const total = group.types.reduce((sum, t) => sum + (counts[t] || 0), 0);
      if (total > 0) {
        items.push({
          key: group.id,
          label: group.label,
          brand: group.brand,
          color: group.color,
          total,
        });
      }
    }
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2.5 overflow-x-auto">
      <CollapsedDataSources sources={dataSources} />
      {items.length === 0 ? (
        <span className="text-gray-600">No API calls yet</span>
      ) : (
        items.map((item) => (
          <div key={item.key} className="flex shrink-0 items-center gap-1" title={item.label}>
            {item.brand ? (
              <BrandLogo brand={item.brand} />
            ) : item.short ? (
              <span
                className={`${MONO} rounded-[3px] bg-gray-800 px-1 py-px font-normal leading-tight tracking-[0.03em] text-gray-300`}
                style={item.color ? { backgroundColor: item.color } : undefined}
              >
                {item.short}
              </span>
            ) : (
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-gray-600"
                style={item.color ? { backgroundColor: item.color } : undefined}
              />
            )}
            <span
              className="font-bold text-gray-400"
              style={item.color ? { color: item.color } : undefined}
            >
              {item.total}
            </span>
          </div>
        ))
      )}
    </div>
  );
}

const OPEN_STORAGE_KEY = 'ciclomapa-debug-panel-open';

function readStoredOpen(fallback) {
  try {
    const raw = window.localStorage.getItem(OPEN_STORAGE_KEY);
    if (raw === '1') return true;
    if (raw === '0') return false;
  } catch {
    // ignore quota / private mode
  }
  return fallback;
}

function writeStoredOpen(open) {
  try {
    window.localStorage.setItem(OPEN_STORAGE_KEY, open ? '1' : '0');
  } catch {
    // ignore
  }
}

export default function ApiDebugOverlay({ initiallyOpen = false }) {
  const [open, setOpen] = useState(() => readStoredOpen(initiallyOpen));
  const [collapsed, setCollapsed] = useState(IS_MOBILE);
  const [snapshot, setSnapshot] = useState({ entries: [], counts: {} });
  const [dataSnapshot, setDataSnapshot] = useState({ sources: {} });
  const [flashIds, setFlashIds] = useState(new Set());
  const prevEntriesRef = useRef([]);

  useEffect(() => {
    writeStoredOpen(open);
  }, [open]);

  useEffect(() => subscribeDataLoads(setDataSnapshot), []);

  useEffect(() => {
    return subscribe((snap) => {
      setSnapshot(snap);
      const prevIds = new Set(prevEntriesRef.current.map((e) => e.id));
      const newIds = snap.entries.filter((e) => !prevIds.has(e.id)).map((e) => e.id);
      if (newIds.length > 0) {
        setFlashIds((prev) => new Set([...prev, ...newIds]));
        setTimeout(() => {
          setFlashIds((prev) => {
            const next = new Set(prev);
            newIds.forEach((id) => next.delete(id));
            return next;
          });
        }, 600);
      }
      prevEntriesRef.current = snap.entries;
    });
  }, []);

  const activeGroups = API_GROUPS.filter(
    (group) => group.types.reduce((sum, t) => sum + (snapshot.counts[t] || 0), 0) > 0
  );

  const desktopTop = TOPBAR_HEIGHT + 8;

  if (!open) {
    return (
      <button
        type="button"
        className={`fixed z-[99999] flex h-4 w-4 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-gray-500 opacity-40 hover:opacity-90 focus-visible:opacity-90 ${
          IS_MOBILE ? 'right-0.5 bottom-[calc(2px+env(safe-area-inset-bottom,0px))]' : 'right-4'
        }`}
        style={IS_MOBILE ? undefined : { top: desktopTop }}
        onClick={() => setOpen(true)}
        title="Open debug panel"
        aria-label="Open debug panel"
      >
        <IconDebug className="h-3 w-3" />
      </button>
    );
  }

  return (
    <div
      className={`fixed z-[99999] overflow-hidden bg-gray-800 font-['Inter',system-ui,sans-serif] text-[10px] ${
        IS_MOBILE
          ? 'inset-x-0 bottom-0 w-full pb-[env(safe-area-inset-bottom,0px)]'
          : 'right-4 w-60 rounded-lg shadow-lg'
      }`}
      style={IS_MOBILE ? undefined : { top: desktopTop }}
    >
      <div
        className="flex cursor-pointer select-none items-center gap-1.5 bg-gray-800 px-2 py-0.5 text-gray-100"
        onClick={() => setCollapsed((c) => !c)}
      >
        <CollapsedSummary counts={snapshot.counts} dataSources={dataSnapshot.sources} />
        <IconChevron
          className={`h-[13px] w-[13px] shrink-0 text-gray-500 transition-transform duration-200 ${!collapsed ? 'rotate-180' : ''}`}
        />
        <button
          type="button"
          className="m-0 flex h-[18px] w-[18px] shrink-0 cursor-pointer items-center justify-center rounded-[3px] border-0 bg-transparent p-0 text-gray-500 hover:bg-gray-800 hover:text-gray-100"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(false);
            setCollapsed(IS_MOBILE);
          }}
          title="Hide debug panel"
          aria-label="Hide debug panel"
        >
          <IconClose className="h-3 w-3" />
        </button>
      </div>

      <div
        className={`grid transition-[grid-template-rows] duration-[240ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${collapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'}`}
      >
        <div className="overflow-hidden">
          <div
            className={`space-y-2 bg-gray-800 px-2 pb-2 pt-1 text-gray-300 transition duration-200 ${collapsed ? 'opacity-0 -translate-y-1' : 'opacity-100 translate-y-0 delay-[60ms]'} ${IS_MOBILE ? 'max-h-[55vh] overflow-y-auto' : ''}`}
          >
            <h3 className="pt-1 text-[9px] font-semibold text-gray-400">Data Sources</h3>
            <section className="overflow-hidden rounded-md bg-black">
              {Object.values(dataSnapshot.sources).map((source) => (
                <DataSourceRow key={source.key} source={source} />
              ))}
            </section>

            <h3 className="pt-1 text-[9px] font-semibold text-gray-400">API Calls</h3>
            <section className="overflow-hidden rounded-md bg-black">
              {activeGroups.length === 0 ? (
                <div className="px-2 py-2.5 text-center text-gray-600">No calls yet</div>
              ) : (
                activeGroups.map((group) => (
                  <GroupRow key={group.id} group={group} counts={snapshot.counts} />
                ))
              )}
            </section>

            <h3 className="pt-1 text-[9px] font-semibold text-gray-400">Log</h3>
            <section className="overflow-hidden rounded-md bg-black">
              <div className="max-h-[200px] overflow-y-auto">
                {snapshot.entries.length === 0 ? (
                  <div className="px-2 py-2.5 text-center text-gray-600">No calls yet</div>
                ) : (
                  snapshot.entries.map((entry) => (
                    <div
                      key={entry.id}
                      className={`grid grid-cols-[12px_4rem_minmax(0,1fr)_3rem] items-center gap-x-1.5 border-b border-white border-opacity-5 px-2 py-[3px] last:border-b-0 transition-colors duration-300 ${flashIds.has(entry.id) ? 'bg-gray-800' : ''}`}
                    >
                      <LogService api={entry.api} />
                      <span className="min-w-0 truncate text-gray-400">{entry.details}</span>
                      <span className={`${MONO} text-right text-gray-600`}>
                        {formatTime(entry.timestamp)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
