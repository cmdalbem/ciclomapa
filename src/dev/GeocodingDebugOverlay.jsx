import React, { useEffect, useRef, useState } from 'react';
import {
  API_COLORS,
  API_GROUPS,
  API_LABELS,
  API_TYPES,
  reset,
  subscribe,
} from './geocodingTracker.js';

const BADGE_SHORT = {
  [API_TYPES.GOOGLE_GEOCODING]: 'GEO',
  [API_TYPES.GOOGLE_PREDICTIONS]: 'PRED',
  [API_TYPES.GOOGLE_PLACE_DETAILS]: 'DETAIL',
  [API_TYPES.MAPBOX_GEOCODING]: 'MB',
};

function formatAge(timestamp) {
  const secs = Math.floor((Date.now() - timestamp) / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m${secs % 60}s`;
}

function Badge({ api }) {
  return (
    <span
      style={{
        background: API_COLORS[api],
        color: '#fff',
        borderRadius: 3,
        padding: '1px 5px',
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.04em',
        flexShrink: 0,
        fontFamily: 'monospace',
      }}
    >
      {BADGE_SHORT[api] ?? api}
    </span>
  );
}

function GroupRow({ group, counts }) {
  const groupTotal = group.types.reduce((sum, t) => sum + (counts[t] || 0), 0);
  const hasBreakdown = group.types.length > 1;

  return (
    <div style={{ padding: '5px 10px', borderBottom: '1px solid #27272a' }}>
      {/* Group header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span
          style={{
            width: 9,
            height: 9,
            borderRadius: '50%',
            background: group.color,
            flexShrink: 0,
          }}
        />
        <span style={{ flex: 1, color: '#e4e4e7', fontWeight: 600, fontSize: 11 }}>
          {group.label}
        </span>
        <span
          style={{
            fontWeight: 700,
            fontSize: 13,
            color: groupTotal > 0 ? group.color : '#3f3f46',
            minWidth: 20,
            textAlign: 'right',
          }}
        >
          {groupTotal}
        </span>
      </div>

      {/* Breakdown rows — only when the group has more than one type */}
      {hasBreakdown && (
        <div style={{ marginTop: 3, paddingLeft: 16 }}>
          {group.types.map((type) => (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <span style={{ flex: 1, color: '#71717a', fontSize: 10 }}>{API_LABELS[type]}</span>
              <span
                style={{
                  color: (counts[type] || 0) > 0 ? '#a1a1aa' : '#3f3f46',
                  fontSize: 10,
                  minWidth: 20,
                  textAlign: 'right',
                }}
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

export default function GeocodingDebugOverlay() {
  const [collapsed, setCollapsed] = useState(false);
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
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 99999,
        width: 240,
        fontFamily: 'monospace',
        fontSize: 11,
        boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
        borderRadius: 8,
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* Header */}
      <div
        onClick={() => setCollapsed((c) => !c)}
        style={{
          background: '#18181b',
          color: '#f4f4f5',
          padding: '6px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 13 }}>📡</span>
        <span style={{ fontWeight: 700, flex: 1 }}>Geocoding Debug</span>
        <span
          style={{
            background: totalCalls > 0 ? '#ef4444' : '#3f3f46',
            color: '#fff',
            borderRadius: 10,
            padding: '0 7px',
            fontWeight: 700,
            fontSize: 10,
          }}
        >
          {totalCalls}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            reset();
          }}
          title="Reset counters"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#71717a',
            cursor: 'pointer',
            fontSize: 13,
            padding: '0 2px',
            lineHeight: 1,
          }}
        >
          ↺
        </button>
        <span style={{ color: '#71717a', fontSize: 10 }}>{collapsed ? '▲' : '▼'}</span>
      </div>

      {!collapsed && (
        <div style={{ background: '#09090b', color: '#d4d4d8' }}>
          {/* Billing groups */}
          {API_GROUPS.map((group) => (
            <GroupRow key={group.id} group={group} counts={snapshot.counts} />
          ))}

          {/* Call log */}
          <div style={{ maxHeight: 200, overflowY: 'auto', borderTop: '1px solid #27272a' }}>
            {snapshot.entries.length === 0 ? (
              <div style={{ color: '#52525b', padding: '10px 8px', textAlign: 'center' }}>
                No calls yet
              </div>
            ) : (
              snapshot.entries.map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '3px 8px',
                    borderBottom: '1px solid #18181b',
                    background: flashIds.has(entry.id)
                      ? `${API_COLORS[entry.api]}22`
                      : 'transparent',
                    transition: 'background 0.3s',
                  }}
                >
                  <span
                    style={{ color: '#52525b', minWidth: 22, textAlign: 'right', flexShrink: 0 }}
                  >
                    {formatAge(entry.timestamp)}
                  </span>
                  <Badge api={entry.api} />
                  <span
                    style={{
                      color: '#a1a1aa',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                    }}
                  >
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
