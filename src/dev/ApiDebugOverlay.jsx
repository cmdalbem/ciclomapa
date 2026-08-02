import React, { useEffect, useRef, useState } from 'react';
import { HiOutlineChevronDown as IconChevron } from 'react-icons/hi';
import { HiBugAnt as IconDebug, HiOutlineXMark as IconClose } from 'react-icons/hi2';
import { IS_MOBILE } from '../config/constants.js';
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
import './ApiDebugOverlay.css';

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
        className="api-debug__logo api-debug__logo--svg"
        dangerouslySetInnerHTML={{ __html: BRAND_LOGO_SVG[brand] }}
      />
    );
  }

  if (BRAND_LOGO_URLS[brand]) {
    return (
      <img
        className="api-debug__logo api-debug__logo--img"
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
      <span className="api-debug__log-logo">{brand ? <BrandLogo brand={brand} /> : null}</span>
      <span className="api-debug__log-service-name">{BADGE_SHORT[api] ?? api}</span>
    </>
  );
}

function GroupRow({ group, counts }) {
  const groupTotal = group.types.reduce((sum, t) => sum + (counts[t] || 0), 0);
  const activeTypes = group.types.filter((type) => (counts[type] || 0) > 0);
  const hasBreakdown = group.types.length > 1 && activeTypes.length > 0;

  return (
    <div className="api-debug__group">
      <div className="api-debug__group-header">
        <div className="api-debug__group-label-wrap">
          {group.brand && <BrandLogo brand={group.brand} />}
          <span className="api-debug__group-label">{group.label}</span>
        </div>
        <span
          className={`api-debug__group-total${groupTotal > 0 ? ' api-debug__group-total--active' : ''}`}
          style={{ '--api-debug-color': group.color }}
        >
          {groupTotal}
        </span>
      </div>

      {hasBreakdown && (
        <div className="api-debug__breakdown">
          {activeTypes.map((type) => (
            <div key={type} className="api-debug__breakdown-row">
              <span className="api-debug__breakdown-label">{API_LABELS[type]}</span>
              <span className="api-debug__breakdown-count api-debug__breakdown-count--active">
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
      <span key="features" className="api-debug__mono">
        {meta.features} features
      </span>
    );
  }
  if (meta.file) {
    metaNodes.push(
      <span key="file" className="api-debug__mono">
        {meta.file}
      </span>
    );
  }
  if (!isLoading && typeof durationMs === 'number') {
    metaNodes.push(
      <span key="dur" className="api-debug__mono">
        {durationMs}ms
      </span>
    );
  }

  return (
    <div className="api-debug__data-row">
      <div className="api-debug__data-info">
        <div className="api-debug__data-label-row">
          <span className="api-debug__data-label">{label}</span>
          <span
            className={`api-debug__data-status${isError ? ' api-debug__data-status--error' : ''}${isLoading ? ' api-debug__data-status--loading' : ''}`}
          >
            {DATA_STATUS_TEXT[status] ?? status}
          </span>
        </div>
        {(metaNodes.length > 0 || error) && (
          <div className="api-debug__data-meta">
            {error ? (
              <span className="api-debug__mono">{error}</span>
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
        <div key={item.key} className="api-debug__summary-item" title={item.title}>
          {/* <span className="api-debug__summary-label">{item.label}</span> */}
          <span
            className={`api-debug__summary-value${item.isError ? ' api-debug__summary-value--error' : ''}`}
          >
            {item.value}
          </span>
        </div>
      ))}
      <span className="api-debug__summary-divider" />
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
    <div className="api-debug__summary">
      <CollapsedDataSources sources={dataSources} />
      {items.length === 0 ? (
        <span className="api-debug__summary-empty">No API calls yet</span>
      ) : (
        items.map((item) => (
          <div key={item.key} className="api-debug__summary-item" title={item.label}>
            {item.brand ? (
              <BrandLogo brand={item.brand} />
            ) : item.short ? (
              <span
                className="api-debug__summary-short"
                style={{ '--api-debug-color': item.color }}
              >
                {item.short}
              </span>
            ) : (
              <span
                className="api-debug__dot api-debug__dot--sm"
                style={{ '--api-debug-color': item.color }}
              />
            )}
            <span className="api-debug__summary-count" style={{ '--api-debug-color': item.color }}>
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

  const totalCalls = Object.values(snapshot.counts).reduce((s, n) => s + n, 0);
  const activeGroups = API_GROUPS.filter(
    (group) => group.types.reduce((sum, t) => sum + (snapshot.counts[t] || 0), 0) > 0
  );

  if (!open) {
    return (
      <button
        type="button"
        className="api-debug-trigger"
        onClick={() => setOpen(true)}
        title="Open debug panel"
        aria-label="Open debug panel"
      >
        <IconDebug className="api-debug-trigger__icon" />
      </button>
    );
  }

  return (
    <div className={`api-debug api-debug--${IS_MOBILE ? 'mobile' : 'desktop'}`}>
      <div className="api-debug__header" onClick={() => setCollapsed((c) => !c)}>
        {IS_MOBILE ? (
          <CollapsedSummary counts={snapshot.counts} dataSources={dataSnapshot.sources} />
        ) : (
          <>
            <span className="api-debug__header-icon">📡</span>
            <span className="api-debug__header-title">Debug</span>
            <span
              className={`api-debug__total${totalCalls > 0 ? ' api-debug__total--active' : ''}`}
            >
              {totalCalls}
            </span>
          </>
        )}
        <IconChevron
          className={`api-debug__chevron${!collapsed ? ' api-debug__chevron--open' : ''}`}
        />
        <button
          type="button"
          className="api-debug__close"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(false);
            setCollapsed(IS_MOBILE);
          }}
          title="Hide debug panel"
          aria-label="Hide debug panel"
        >
          <IconClose />
        </button>
      </div>

      <div className={`api-debug__body-wrap${!collapsed ? ' api-debug__body-wrap--open' : ''}`}>
        <div className="api-debug__body-inner">
          <div className="api-debug__body">
            <div className="api-debug__section-title">Data Sources</div>
            {Object.values(dataSnapshot.sources).map((source) => (
              <DataSourceRow key={source.key} source={source} />
            ))}

            <div className="api-debug__section-title">API Calls</div>
            {activeGroups.length === 0 ? (
              <div className="api-debug__log-empty">No calls yet</div>
            ) : (
              activeGroups.map((group) => (
                <GroupRow key={group.id} group={group} counts={snapshot.counts} />
              ))
            )}

            <div className="api-debug__log">
              {snapshot.entries.length === 0 ? (
                <div className="api-debug__log-empty">No calls yet</div>
              ) : (
                snapshot.entries.map((entry) => (
                  <div
                    key={entry.id}
                    className={`api-debug__log-entry${flashIds.has(entry.id) ? ' api-debug__log-entry--flash' : ''}`}
                  >
                    <LogService api={entry.api} />
                    <span className="api-debug__log-details">{entry.details}</span>
                    <span className="api-debug__log-time">{formatTime(entry.timestamp)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
