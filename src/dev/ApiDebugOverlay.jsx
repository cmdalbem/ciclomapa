import React, { useEffect, useRef, useState } from 'react';
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
import './ApiDebugOverlay.css';

const BADGE_SHORT = {
  [API_TYPES.GOOGLE_GEOCODING]: 'GEO',
  [API_TYPES.GOOGLE_PREDICTIONS]: 'PRED',
  [API_TYPES.GOOGLE_PLACE_DETAILS]: 'DETAIL',
  [API_TYPES.MAPBOX_GEOCODING]: 'GEO',
  [API_TYPES.MAPBOX_DIRECTIONS]: 'DIR',
  [API_TYPES.NOMINATIM_SEARCH]: 'NOM',
  [API_TYPES.NOMINATIM_REVERSE]: 'REV',
  [API_TYPES.OVERPASS]: 'OVP',
  [API_TYPES.GRAPHHOPPER]: 'GH',
  [API_TYPES.VALHALLA]: 'VAL',
  [API_TYPES.ORS]: 'ORS',
  [API_TYPES.AIRTABLE_READ]: 'AT-R',
  [API_TYPES.AIRTABLE_WRITE]: 'AT-W',
  [API_TYPES.FIREBASE_READ]: 'FB-R',
  [API_TYPES.FIREBASE_WRITE]: 'FB-W',
};

function formatAge(timestamp) {
  const secs = Math.floor((Date.now() - timestamp) / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m${secs % 60}s`;
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

function Badge({ api }) {
  return (
    <span className="api-debug__badge" style={{ '--api-debug-color': API_COLORS[api] }}>
      {BADGE_SHORT[api] ?? api}
    </span>
  );
}

function GroupRow({ group, counts }) {
  const groupTotal = group.types.reduce((sum, t) => sum + (counts[t] || 0), 0);
  const hasBreakdown = group.types.length > 1;

  return (
    <div className="api-debug__group">
      <div className="api-debug__group-header">
        <span
          className="api-debug__dot api-debug__dot--md"
          style={{ '--api-debug-color': group.color }}
        />
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
          {group.types.map((type) => (
            <div key={type} className="api-debug__breakdown-row">
              <span className="api-debug__breakdown-label">{API_LABELS[type]}</span>
              <span
                className={`api-debug__breakdown-count${(counts[type] || 0) > 0 ? ' api-debug__breakdown-count--active' : ''}`}
              >
                {counts[type] || 0}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CollapsedSummary({ counts }) {
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

export default function ApiDebugOverlay() {
  const [collapsed, setCollapsed] = useState(IS_MOBILE);
  const [snapshot, setSnapshot] = useState({ entries: [], counts: {} });
  const [flashIds, setFlashIds] = useState(new Set());
  const prevEntriesRef = useRef([]);

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

  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const totalCalls = Object.values(snapshot.counts).reduce((s, n) => s + n, 0);

  return (
    <div className={`api-debug api-debug--${IS_MOBILE ? 'mobile' : 'desktop'}`}>
      <div className="api-debug__header" onClick={() => setCollapsed((c) => !c)}>
        {IS_MOBILE && collapsed ? (
          <CollapsedSummary counts={snapshot.counts} />
        ) : (
          <>
            <span className="api-debug__header-icon">📡</span>
            <span className="api-debug__header-title">API Debug</span>
            <span
              className={`api-debug__total${totalCalls > 0 ? ' api-debug__total--active' : ''}`}
            >
              {totalCalls}
            </span>
          </>
        )}
        <span className="api-debug__chevron">{collapsed ? '▲' : '▼'}</span>
      </div>

      {!collapsed && (
        <div className="api-debug__body">
          {API_GROUPS.map((group) => (
            <GroupRow key={group.id} group={group} counts={snapshot.counts} />
          ))}

          <div className="api-debug__log">
            {snapshot.entries.length === 0 ? (
              <div className="api-debug__log-empty">No calls yet</div>
            ) : (
              snapshot.entries.map((entry) => (
                <div
                  key={entry.id}
                  className={`api-debug__log-entry${flashIds.has(entry.id) ? ' api-debug__log-entry--flash' : ''}`}
                  style={{ '--api-debug-flash': `${API_COLORS[entry.api]}22` }}
                >
                  <span className="api-debug__log-age">{formatAge(entry.timestamp)}</span>
                  <Badge api={entry.api} />
                  <span className="api-debug__log-details">
                    {entry.details.length > 30 ? entry.details.slice(0, 30) + '…' : entry.details}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
