import { LENGTH_COUNTED_LAYER_IDS } from './config/constants.js';

const STRATEGY_LABELS = {
  random: 'aleatório',
  optimistic: 'otimista',
  pessimistic: 'pessimista',
  average: 'média entre lados da via',
};

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

/** @param {string | undefined} strategy */
export function formatLengthStrategyLabel(strategy) {
  if (!strategy) return null;
  return STRATEGY_LABELS[strategy] || strategy;
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
