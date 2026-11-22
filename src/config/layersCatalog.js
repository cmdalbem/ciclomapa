// v1 = production / PR filters. v2 = OSM wiki 2026 (shared paths, cycleway:both, buffered_lane).
// Debug/POI layers are duplicated in both JSON files; copy them into both when you add one.
// The v1↔v2 diff overlay is injected in OSMController.getLayers (mapper/debug), not in JSON.
import layersV1 from './layers.v1.json';
import layersV2 from './layers.v2.json';

export const DEFAULT_LAYERS_VERSION = 'v2';

export const LAYERS_VERSIONS = {
  v1: {
    id: 'v1',
    label: 'v1',
    description: 'produção',
    layers: layersV1,
  },
  v2: {
    id: 'v2',
    label: 'v2',
    description: 'OSM 2026',
    layers: layersV2,
  },
};

export const LAYERS_VERSION_LIST = Object.values(LAYERS_VERSIONS);

export function resolveLayersVersion(id) {
  if (id && Object.prototype.hasOwnProperty.call(LAYERS_VERSIONS, id)) return id;
  return DEFAULT_LAYERS_VERSION;
}

export function getLayersDefinition(version) {
  return LAYERS_VERSIONS[resolveLayersVersion(version)].layers;
}

/** Mapbox filter for one layer's OSM tag filters (+ except). Same shape Map used to inline. */
export function layerMatchExpression(layer) {
  const anyMatch = [
    'any',
    ...layer.filters.map((f) =>
      typeof f[0] === 'string'
        ? ['==', ['get', f[0]], f[1]]
        : ['all', ...f.map((f2) => ['==', ['get', f2[0]], f2[1]])]
    ),
  ];
  if (!layer.except?.length) return anyMatch;
  return ['all', anyMatch, ...layer.except.map((pair) => ['!=', ['get', pair[0]], pair[1]])];
}

function wayTypologyLayers(layers) {
  return layers.filter((l) => l.filters && !l.onlyDebug && l.type !== 'poi');
}

/** First-match case of typology names. Proibido is sticky in computeTypologies, so it goes first. */
export function typologyMatchExpression(layers) {
  const wayLayers = wayTypologyLayers(layers);
  const sticky = wayLayers.filter((l) => l.name === 'Proibido');
  const rest = wayLayers.filter((l) => l.name !== 'Proibido');
  const cases = [];
  [...sticky, ...rest].forEach((layer) => {
    cases.push(layerMatchExpression(layer), layer.name);
  });
  return ['case', ...cases, ''];
}

export function layersVersionDiffMapboxFilter() {
  return [
    '!=',
    typologyMatchExpression(getLayersDefinition('v1')),
    typologyMatchExpression(getLayersDefinition('v2')),
  ];
}

export const PAIRING_LAYER_GROUP = {
  id: 'pairing',
  label: 'Pareamento',
  description: 'Vias detectadas como os dois lados da mesma rua, e a confiança desse pareamento.',
};

export const PAIRING_LAYER_SECTIONS = [
  { id: 'sides', label: 'Pareados' },
  { id: 'confidence', label: 'Confiança' },
];

export function splitMapperLayerMenu(mapperLayers) {
  const pairingLayers = mapperLayers.filter((l) => l.mapperGroup === PAIRING_LAYER_GROUP.id);
  const items = [];
  let pairingInserted = pairingLayers.length === 0;
  mapperLayers.forEach((layer) => {
    if (layer.mapperGroup === PAIRING_LAYER_GROUP.id) {
      if (!pairingInserted) {
        items.push({ type: 'pairing', layers: pairingLayers });
        pairingInserted = true;
      }
      return;
    }
    items.push({ type: 'layer', layer });
  });
  return items;
}

export function pairingGroupIsActive(layers) {
  return layers.some((l) => l.isActive);
}

export function pairingGroupToggleChanges(layers) {
  const turnOff = pairingGroupIsActive(layers);
  return layers.map((l) => ({
    id: l.id,
    isActive: turnOff ? false : Boolean(l.mapperGroupDefault),
  }));
}

export function pairingGroupSwatchLayers(layers) {
  const active = layers.filter((l) => l.isActive && l.style?.lineColor);
  if (active.length) return active;
  return layers.filter((l) => l.mapperGroupDefault && l.style?.lineColor);
}

/** Pairing overlays read `ciclomapa:*` from city GeoJSON. Diff paints from PMTiles. */
export function mapperLayerNeedsCityGeoJson(layer) {
  return Boolean(layer?.onlyDebug && layer.debugSource !== 'pmtiles');
}

export const LAYERS_VERSION_DIFF_LAYER = {
  name: 'Diff v1→v2',
  onlyDebug: true,
  isActive: true,
  debugSource: 'pmtiles',
  description:
    'Trechos que mudam de tipo entre v1 (produção) e v2 (OSM 2026). Continua visível quando você troca a versão.',
  mapboxFilter: layersVersionDiffMapboxFilter(),
  style: {
    lineColor: '#FF00AA',
    lineColorDark: '#FFE600',
    lineWidth: 20,
    lineStyle: 'dashed',
  },
};
