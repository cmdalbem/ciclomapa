import turfDistance from '@turf/distance';

export const HALL_GIS_SOURCE_ID = 'hall-official';
export const HALL_GIS_DEBUG_SOURCE = 'hall-gis';
export const HALL_DIFF_PROP = 'ciclomapa:hall_diff';

export const HALL_CITY_NEEDLE = {
  'cuiaba-hall': 'cuiaba',
  'salvador-hall': 'salvador',
  'rio-hall': 'rio de janeiro',
  'curitiba-hall': 'curitiba',
  'fortaleza-hall': 'fortaleza',
};

const RIO_GIS_LAYER =
  'https://pgeo3.rio.rj.gov.br/arcgis/rest/services/Hosted/Rede_Ciclovi%C3%A1ria_do_Rio/FeatureServer/0';
const CURITIBA_GIS_LAYER =
  'https://geocuritiba.ippuc.org.br/server/rest/services/GeoCuritiba/CICLOVIA_dashboard/FeatureServer/0';

const SALVADOR_HALL_PROP = 'ciclomapa:salvador_hall';
const SALVADOR_HALL_COUNTED_TYPES = new Set(['Ciclovia', 'Ciclofaixa']);
// Transalvador named list (Wayback 2026-02-22, 308.59 km = Aliança 2025). Street cores + aliases.
const SALVADOR_HALL_LIST_NEEDLES = [
  'loteamento aquarius',
  'shopping bela vista',
  'cabo frio',
  'dilson jatahy fonseca',
  'mar del plata',
  'praia de atalaia',
  'praia de guarapari',
  'praia de potengi',
  '29 de marco',
  'acm brt trecho i',
  'acm via marginal',
  'afranio peixoto',
  'alphaville',
  'amaralina',
  'anita garibaldi',
  'anita garibaldi ii',
  'artenio valente',
  'barros reis sent br 324',
  'barros reis sent rot abacaxi',
  'beira mar',
  'beira mar do lobato',
  'caribe sentido aeroporto',
  'caribe sentido centro',
  'carlos gomes',
  'centenario',
  'cons pedro luiz',
  'da franca',
  'das dunas',
  'dorival caymmi entorno',
  'dorival caymmi',
  'eng oscar pontes',
  'frederico pontes',
  'garibaldi',
  'heitor dias',
  'ibirapitanga trecho i',
  'ipitapitanga trecho ii',
  'jequitaia',
  'jorge amado',
  'juracy magalhaes jr r do canal',
  'luis eduardo magalhaes',
  'luis tarquinio',
  'luis viana via marginal',
  'mae stella de oxossi',
  'magalhaes neto',
  'manoel dias da silva',
  'maria lucia',
  'mario sergio',
  'oceanica barra 2',
  'oceanica',
  'oceanica rio vermelho',
  'octavio mangabeira pituba',
  'octavio mangabeira',
  'orlando gomes',
  'paralela',
  'pinto de aguiar',
  'porto dos mastros',
  'rio trobogy',
  'sao cristovao',
  'sete de setembro',
  'tamburugy',
  'tamburugy sent av paralela',
  'tamburugy sent orla',
  'ten frederico gustavo dos santos',
  'tiradentes',
  'vale dos barris',
  'campo da pronaica',
  'centro administrativo da bahia',
  'largo da calcada',
  'largo da ribeira',
  'largo dos mares',
  'da cidade',
  'pca ana lucia magalhaes',
  'pca loteamanto aquarius',
  'pca stella maris',
  'pca av general graca lessa',
  'pca vale dos barris',
  'pca vinicius de moraes',
  'metropolitano de pituacu',
  'lord cochrane',
  'procurador nelson castro',
  'amazonas',
  'anisio teixeira',
  'baixa de santo antonio',
  'benjoim r timbo',
  'braulio nascimento',
  'clovis spinola',
  'da alfazema',
  'da imperatriz',
  'da paciencia',
  'des manoel de andrade teixeira',
  'desembargador adolfo leitao guerra',
  'direita da piedade',
  'do farol',
  'do imperador',
  'edith menezes gama abreu',
  'fernandes da cunha',
  'fernandes vieira',
  'guedes cabral',
  'henrique dias',
  'ibitiara',
  'jose augusto tourinho dantas',
  'jose martins tourinho',
  'luiz maria',
  'manoel barreto',
  'marques de monte santo',
  'mato grosso',
  'miguel calmon',
  'politeama de baixo',
  'politeama de cima',
  'porto dos taineiros',
  'prof antonio augusto machado',
  'prof souza brito',
  'professor oseas santos',
  'renato berbet de castro',
  'sao paulo',
  'tamarindeiros da penha',
  'thales de azevedo',
  'thomas gonzaga',
  'ver menezes leone',
  'visconde itaboray',
  'sao thome de paripe',
  'regional',
  'suburbana',
  'orla suburbana',
  'luis viana',
  'luiz viana',
  'pituacu',
  'centro administrativo',
];

export function foldHallLocation(location) {
  return String(location || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function isHallMapperGroup(groupId) {
  return Boolean(groupId && HALL_CITY_NEEDLE[groupId]);
}

export function hallGroupIsAvailable(groupId, location) {
  const needle = HALL_CITY_NEEDLE[groupId];
  if (!needle) return true;
  return foldHallLocation(location).includes(needle);
}

function hallDiffCity(location) {
  const folded = foldHallLocation(location);
  if (folded.includes('rio de janeiro')) return 'rio';
  if (folded.includes('curitiba')) return 'curitiba';
  if (folded.includes('fortaleza')) return 'fortaleza';
  return null;
}

/** GIS diffs share one source. Only paint the group whose city is on screen. */
export function hallOverlayPaintsAtLocation(layer, location) {
  if (!isHallMapperGroup(layer?.mapperGroup)) return true;
  if (layer.debugSource === HALL_GIS_DEBUG_SOURCE) {
    return hallGroupIsAvailable(layer.mapperGroup, location);
  }
  if (layer.filters?.some((pair) => pair[0] === HALL_DIFF_PROP)) {
    return hallGroupIsAvailable(layer.mapperGroup, location);
  }
  return true;
}

function arcgisGeoJsonUrl(layerUrl, where) {
  const params = new URLSearchParams({
    where,
    outFields: '*',
    outSR: '4326',
    resultRecordCount: '2000',
    f: 'geojson',
  });
  return `${layerUrl}/query?${params}`;
}

export function hallGisQueryUrl(location) {
  const folded = foldHallLocation(location);
  if (folded.includes('rio de janeiro')) {
    return arcgisGeoJsonUrl(RIO_GIS_LAYER, "status='Implantada' AND contabilizar='Sim'");
  }
  if (folded.includes('curitiba')) {
    return arcgisGeoJsonUrl(CURITIBA_GIS_LAYER, 'ctba_tipo_ciclovia<>0');
  }
  if (folded.includes('fortaleza')) {
    return '/hall-gis/fortaleza.geojson';
  }
  return null;
}

const OSM_EXCLUSIVE_TYPES = new Set(['Ciclovia', 'Ciclofaixa']);
const MATCH_DIST_KM = 0.03;
const MIN_COVERAGE = 0.4;
const GRID_SIZE_DEG = 0.003;
const SAMPLE_STEP_KM = 0.02;
const MAX_SAMPLES = 48;

function hallGisExclusiveCheck(location) {
  const folded = foldHallLocation(location);
  if (folded.includes('rio de janeiro')) {
    return (properties) =>
      properties?.tipo_infra === 'Ciclovia' || properties?.tipo_infra === 'Ciclofaixa';
  }
  if (folded.includes('curitiba')) {
    return (properties) => {
      const tipo = Number(properties?.ctba_tipo_ciclovia);
      return tipo === 1 || tipo === 2 || tipo === 3;
    };
  }
  if (folded.includes('fortaleza')) {
    return (properties) => {
      const tipo = String(properties?.tipologia || '').toLowerCase();
      return tipo === 'ciclovia' || tipo === 'ciclofaixa';
    };
  }
  return null;
}

function eachLineCoords(feature, fn) {
  const geometry = feature?.geometry;
  if (!geometry) return;
  if (geometry.type === 'LineString' && Array.isArray(geometry.coordinates)) {
    fn(geometry.coordinates);
    return;
  }
  if (geometry.type === 'MultiLineString') {
    (geometry.coordinates || []).forEach((coords) => {
      if (Array.isArray(coords)) fn(coords);
    });
  }
}

function sampleLine(coords) {
  if (!coords || coords.length < 2) return [];
  const out = [coords[0]];
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i];
    const b = coords[i + 1];
    const distance = turfDistance(a, b);
    const steps = Math.max(1, Math.ceil(distance / SAMPLE_STEP_KM));
    for (let k = 1; k <= steps; k++) {
      const t = k / steps;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  if (out.length <= MAX_SAMPLES) return out;
  const sampled = [];
  const step = (out.length - 1) / (MAX_SAMPLES - 1);
  for (let i = 0; i < MAX_SAMPLES; i++) sampled.push(out[Math.round(i * step)]);
  return sampled;
}

function sampleFeature(feature) {
  const points = [];
  eachLineCoords(feature, (coords) => {
    points.push(...sampleLine(coords));
  });
  if (points.length <= MAX_SAMPLES) return points;
  const sampled = [];
  const step = (points.length - 1) / (MAX_SAMPLES - 1);
  for (let i = 0; i < MAX_SAMPLES; i++) sampled.push(points[Math.round(i * step)]);
  return sampled;
}

function cellKey(lng, lat) {
  return `${Math.floor(lng / GRID_SIZE_DEG)}:${Math.floor(lat / GRID_SIZE_DEG)}`;
}

function indexSamples(features) {
  const grid = new Map();
  const samples = features.map((feature) => {
    const points = sampleFeature(feature);
    points.forEach(([lng, lat]) => {
      const key = cellKey(lng, lat);
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push([lng, lat]);
    });
    return points;
  });
  return { grid, samples };
}

function coverageAgainst(points, grid) {
  if (!points.length) return 0;
  let hits = 0;
  for (const [lng, lat] of points) {
    const gx = Math.floor(lng / GRID_SIZE_DEG);
    const gy = Math.floor(lat / GRID_SIZE_DEG);
    let matched = false;
    for (let dx = -1; dx <= 1 && !matched; dx++) {
      for (let dy = -1; dy <= 1 && !matched; dy++) {
        const bucket = grid.get(`${gx + dx}:${gy + dy}`);
        if (!bucket) continue;
        matched = bucket.some((point) => turfDistance([lng, lat], point) <= MATCH_DIST_KM);
      }
    }
    if (matched) hits += 1;
  }
  return hits / points.length;
}

function clearHallDiff(geoJson) {
  geoJson?.features?.forEach((feature) => {
    if (feature?.properties) delete feature.properties[HALL_DIFF_PROP];
  });
}

/** Tag OSM ciclovia/ciclofaixa vs official exclusive GIS. Whole ways, ~30 m. */
export function tagHallGisDiff(osmGeoJson, gisGeoJson, location) {
  clearHallDiff(osmGeoJson);
  clearHallDiff(gisGeoJson);
  const city = hallDiffCity(location);
  const isExclusiveGis = hallGisExclusiveCheck(location);
  if (!city || !isExclusiveGis || !osmGeoJson?.features || !gisGeoJson?.features) {
    return { osmGeoJson, gisGeoJson };
  }

  const osmWays = osmGeoJson.features.filter((feature) =>
    OSM_EXCLUSIVE_TYPES.has(feature.properties?.type)
  );
  const gisWays = gisGeoJson.features.filter((feature) => isExclusiveGis(feature.properties));
  const osmIndex = indexSamples(osmWays);
  const gisIndex = indexSamples(gisWays);

  gisWays.forEach((feature, i) => {
    if (!feature.properties) feature.properties = {};
    feature.properties[HALL_DIFF_PROP] =
      coverageAgainst(gisIndex.samples[i], osmIndex.grid) >= MIN_COVERAGE
        ? `${city}:match`
        : `${city}:only`;
  });
  osmWays.forEach((feature, i) => {
    if (!feature.properties) feature.properties = {};
    feature.properties[HALL_DIFF_PROP] =
      coverageAgainst(osmIndex.samples[i], gisIndex.grid) >= MIN_COVERAGE
        ? `${city}:match`
        : `${city}:extra`;
  });
  return { osmGeoJson, gisGeoJson };
}

function salvadorHallBlob(properties) {
  if (!properties) return '';
  return foldHallLocation(
    [properties.name, properties.street, properties['addr:street'], properties.ref]
      .filter(Boolean)
      .join(' | ')
  );
}

export function tagSalvadorHallInventory(geoJson, location) {
  if (!geoJson?.features?.length) return geoJson;
  const inSalvador = hallGroupIsAvailable('salvador-hall', location);
  for (const feature of geoJson.features) {
    const properties = feature.properties;
    if (!properties) continue;
    delete properties[SALVADOR_HALL_PROP];
    if (!inSalvador) continue;
    const blob = salvadorHallBlob(properties);
    if (SALVADOR_HALL_LIST_NEEDLES.some((needle) => blob.includes(needle))) {
      properties[SALVADOR_HALL_PROP] = 'list';
    } else if (SALVADOR_HALL_COUNTED_TYPES.has(properties.type)) {
      properties[SALVADOR_HALL_PROP] = 'extra';
    }
  }
  return geoJson;
}
