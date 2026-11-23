// v1 = production / PR filters. v2 = OSM wiki 2026 (shared paths, cycleway:both, buffered_lane).
// Debug/POI layers are duplicated in both JSON files; copy them into both when you add one.
// The v1↔v2 diff overlay is injected in OSMController.getLayers (mapper/debug), not in JSON.
import layersV1 from './layers.v1.json';
import layersV2 from './layers.v2.json';
import { HALL_GIS_DEBUG_SOURCE, isHallMapperGroup } from './hallOverlays.js';

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
  sections: [
    { id: 'sides', label: 'Pareados' },
    { id: 'confidence', label: 'Confiança' },
  ],
};

export const PAIRING_LAYER_SECTIONS = PAIRING_LAYER_GROUP.sections;

export const CUIABA_HALL_LAYER_GROUP = {
  id: 'cuiaba-hall',
  label: 'Cuiabá 2024',
  description:
    'OSM vs a lista da Semob de abril/2024. Match por nome, não geometria oficial. Temporário.',
  sections: [{ id: 'views', label: 'Visualização' }],
};

export const SALVADOR_HALL_LAYER_GROUP = {
  id: 'salvador-hall',
  label: 'Salvador 2025',
  description:
    'OSM vs a lista nomeada da Transalvador (Aliança 2025, 308,6 km). Match por nome, não geometria oficial. Temporário.',
  sections: [{ id: 'views', label: 'Visualização' }],
};

export const RIO_HALL_LAYER_GROUP = {
  id: 'rio-hall',
  label: 'Rio 2026',
  description:
    'OSM ciclovia/ciclofaixa vs CET-Rio exclusiva (~30 m). Oficial bruto continua nos tipos, desligado por padrão. Temporário.',
  sections: [
    { id: 'diff', label: 'Diferenças' },
    { id: 'official', label: 'Oficial' },
  ],
};

export const CURITIBA_HALL_LAYER_GROUP = {
  id: 'curitiba-hall',
  label: 'Curitiba 2026',
  description:
    'OSM ciclovia/ciclofaixa vs IPPUC exclusiva (~30 m). Oficial bruto continua nos tipos, desligado por padrão. Temporário.',
  sections: [
    { id: 'diff', label: 'Diferenças' },
    { id: 'official', label: 'Oficial' },
  ],
};

export const FORTALEZA_HALL_LAYER_GROUP = {
  id: 'fortaleza-hall',
  label: 'Fortaleza 2026',
  description:
    'OSM ciclovia/ciclofaixa vs SCSP 2026 exclusiva (~30 m). Oficial bruto continua nos tipos, desligado por padrão. Temporário.',
  sections: [
    { id: 'diff', label: 'Diferenças' },
    { id: 'official', label: 'Oficial' },
  ],
};

export const MAPPER_LAYER_GROUPS = {
  [PAIRING_LAYER_GROUP.id]: PAIRING_LAYER_GROUP,
  [CUIABA_HALL_LAYER_GROUP.id]: CUIABA_HALL_LAYER_GROUP,
  [SALVADOR_HALL_LAYER_GROUP.id]: SALVADOR_HALL_LAYER_GROUP,
  [RIO_HALL_LAYER_GROUP.id]: RIO_HALL_LAYER_GROUP,
  [CURITIBA_HALL_LAYER_GROUP.id]: CURITIBA_HALL_LAYER_GROUP,
  [FORTALEZA_HALL_LAYER_GROUP.id]: FORTALEZA_HALL_LAYER_GROUP,
};

export function splitMapperLayerMenu(mapperLayers) {
  const items = [];
  const inserted = new Set();
  mapperLayers.forEach((layer) => {
    const group = layer.mapperGroup ? MAPPER_LAYER_GROUPS[layer.mapperGroup] : null;
    if (group) {
      if (!inserted.has(group.id)) {
        items.push({
          type: 'group',
          group,
          layers: mapperLayers.filter((l) => l.mapperGroup === group.id),
        });
        inserted.add(group.id);
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

/** Pairing overlays read tags stamped in calculateLayersLengths (Analytics). Diff is PMTiles. Hall overlays tag/load themselves. */
export function mapperLayerNeedsCityGeoJson(layer) {
  return Boolean(
    layer?.onlyDebug &&
    layer.debugSource !== 'pmtiles' &&
    layer.debugSource !== HALL_GIS_DEBUG_SOURCE &&
    !isHallMapperGroup(layer.mapperGroup)
  );
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
