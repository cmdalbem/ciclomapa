import { LENGTH_COUNTED_LAYER_IDS } from './config/constants.js';

/**
 * Picks a “special metric” to show in the About modal from Airtable row fields.
 *
 * PNB is preferred when present (same priority as AnalyticsSidebar ordering).
 * @param {Record<string, unknown>|null|undefined} fields Airtable Metadata row fields
 * @returns {{ key: string; title: string; valueText: string; year?: unknown; href: string; blurb: string } | null}
 */
export function getAboutModalSpecialMetric(fields) {
  if (!fields || typeof fields !== 'object') return null;

  const pnb = fields.pnb_total;
  if (pnb !== undefined && pnb !== null && pnb !== '') {
    const n = Number(pnb);
    const valueText = Number.isFinite(n)
      ? `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
      : `${pnb}%`;
    return {
      key: 'pnb',
      title: 'PNB',
      valueText,
      year: fields.pnb_year,
      href: 'https://itdpbrasil.org/pnb/',
      blurb: 'Pessoas a até 300 m de ciclovias e ciclofaixas (ITDP Brasil).',
    };
  }

  const ide = fields.ideciclo;
  if (ide !== undefined && ide !== null && ide !== '') {
    const n = Number(ide);
    const valueText = Number.isFinite(n)
      ? n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : String(ide);
    return {
      key: 'ideciclo',
      title: 'IDECiclo',
      valueText,
      year: fields.ideciclo_year,
      href: 'https://www.ideciclo.org/',
      blurb: 'Índice de desenvolvimento cicloviário (escala 0 a 1).',
    };
  }

  return null;
}

/**
 * Same inputs as the analytics sidebar: `lengths` from `calculateLayersLengths` (km for ways, counts for POIs).
 * @param {Record<string, number>|null|undefined} lengths
 * @param {Array<{ id: string; name: string; shortName?: string; displayName?: string; type: string }>|null|undefined} layers
 */
export function getAboutModalMetrics(lengths, layers) {
  if (!Array.isArray(layers)) return null;

  const L = lengths && typeof lengths === 'object' && !Array.isArray(lengths) ? lengths : {};
  const layersById = Object.fromEntries(layers.map((l) => [l.id, l]));

  const infraRows = LENGTH_COUNTED_LAYER_IDS.map((id) => {
    const layer = layersById[id];
    if (!layer) return null;
    const raw = L[id];
    const km = raw != null && !Number.isNaN(Number(raw)) ? Number(raw) : 0;
    return {
      id,
      label: layer.shortName || layer.displayName || layer.name,
      km,
    };
  }).filter(Boolean);

  const infraTotalKm = infraRows.reduce((sum, r) => sum + r.km, 0);

  const kmFor = (id) => {
    const raw = L[id];
    return raw != null && !Number.isNaN(Number(raw)) ? Number(raw) : 0;
  };

  const cicloviaCiclofaixaKm = kmFor('ciclovia') + kmFor('ciclofaixa');

  const poiRows = layers
    .filter((l) => l.type === 'poi' && l.name !== 'Comentários')
    .map((l) => {
      const raw = L[l.id];
      const count = raw != null && !Number.isNaN(Number(raw)) ? Math.round(Number(raw)) : 0;
      return {
        id: l.id,
        label: l.shortName || l.displayName || l.name,
        count,
      };
    });

  const poiTotal = poiRows.reduce((sum, r) => sum + r.count, 0);

  return {
    infraRows,
    infraTotalKm,
    poiRows,
    poiTotal,
    cicloviaCiclofaixaKm,
  };
}

/**
 * @param {Date|string|number|undefined|null} value
 * @returns {string|null}
 */
export function formatMapDataUpdatedAt(value) {
  if (value == null) return null;
  const dt = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}
