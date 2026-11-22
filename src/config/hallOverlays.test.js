import {
  HALL_GIS_DEBUG_SOURCE,
  hallGisQueryUrl,
  hallGroupIsAvailable,
  hallOverlayPaintsAtLocation,
  tagHallGisDiff,
  tagSalvadorHallInventory,
} from './hallOverlays.js';

describe('hall overlay city gating', () => {
  it('shows each hall group only in that city', () => {
    expect(hallGroupIsAvailable('cuiaba-hall', 'Cuiabá, Mato Grosso, Brasil')).toBe(true);
    expect(hallGroupIsAvailable('salvador-hall', 'Salvador, Bahia, Brasil')).toBe(true);
    expect(hallGroupIsAvailable('rio-hall', 'Rio de Janeiro, Rio de Janeiro, Brasil')).toBe(true);
    expect(hallGroupIsAvailable('curitiba-hall', 'Curitiba, Paraná, Brasil')).toBe(true);
    expect(hallGroupIsAvailable('fortaleza-hall', 'Fortaleza, Ceará, Brasil')).toBe(true);

    expect(hallGroupIsAvailable('rio-hall', 'Rio Branco, Acre, Brasil')).toBe(false);
    expect(hallGroupIsAvailable('fortaleza-hall', 'São Paulo, São Paulo, Brasil')).toBe(false);
    expect(hallGroupIsAvailable('cuiaba-hall', 'São Paulo, São Paulo, Brasil')).toBe(false);
    expect(hallGroupIsAvailable('salvador-hall', 'São Paulo, São Paulo, Brasil')).toBe(false);
  });

  it('does not paint another city GIS overlay on the current city', () => {
    const ippuc = {
      mapperGroup: 'curitiba-hall',
      debugSource: HALL_GIS_DEBUG_SOURCE,
      filters: [['ciclomapa:hall_diff', 'curitiba:only']],
    };
    const scsp = {
      mapperGroup: 'fortaleza-hall',
      debugSource: HALL_GIS_DEBUG_SOURCE,
      filters: [['ciclomapa:hall_diff', 'fortaleza:only']],
    };
    const cuiaba = {
      mapperGroup: 'cuiaba-hall',
      filters: [['ciclomapa:cuiaba_hall', 'list']],
    };
    expect(hallOverlayPaintsAtLocation(ippuc, 'Fortaleza, Ceará, Brasil')).toBe(false);
    expect(hallOverlayPaintsAtLocation(scsp, 'Fortaleza, Ceará, Brasil')).toBe(true);
    expect(hallOverlayPaintsAtLocation(cuiaba, 'Fortaleza, Ceará, Brasil')).toBe(true);
  });

  it('builds GIS urls for Rio, Curitiba and Fortaleza', () => {
    const rio = hallGisQueryUrl('Rio de Janeiro, Rio de Janeiro, Brasil');
    expect(rio).toContain('Rede_Ciclovi');
    expect(rio).toContain('f=geojson');
    expect(decodeURIComponent(rio)).toContain("status='Implantada'");

    const cwb = hallGisQueryUrl('Curitiba, Paraná, Brasil');
    expect(cwb).toContain('CICLOVIA_dashboard');
    expect(decodeURIComponent(cwb)).toContain('ctba_tipo_ciclovia<>0');

    expect(hallGisQueryUrl('Fortaleza, Ceará, Brasil')).toBe('/hall-gis/fortaleza.geojson');
    expect(hallGisQueryUrl('Salvador, Bahia, Brasil')).toBeNull();
    expect(HALL_GIS_DEBUG_SOURCE).toBe('hall-gis');
  });

  it('tags Luís Viana / Paralela aliases on Salvador OSM ways', () => {
    const data = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { name: 'Avenida Luiz Viana Filho', type: 'Ciclovia' },
        },
      ],
    };
    tagSalvadorHallInventory(data, 'Salvador, Bahia, Brasil');
    expect(data.features[0].properties['ciclomapa:salvador_hall']).toBe('list');
  });
});

describe('tagHallGisDiff', () => {
  const way = (properties, latOffset = 0) => ({
    type: 'Feature',
    properties,
    geometry: {
      type: 'LineString',
      coordinates: [
        [0, latOffset],
        [0.01, latOffset],
      ],
    },
  });

  it('marks nearby exclusive OSM and CET-Rio ways as a match, leftovers as extra/only', () => {
    const osm = {
      type: 'FeatureCollection',
      features: [
        way({ name: 'matched', type: 'Ciclovia' }, 0),
        way({ name: 'osm extra', type: 'Ciclovia' }, 0.01),
        way({ name: 'shop', type: 'Lojas & oficinas' }, 0),
      ],
    };
    const gis = {
      type: 'FeatureCollection',
      features: [
        way({ tipo_infra: 'Ciclovia' }, 0.0002),
        way({ tipo_infra: 'Ciclovia' }, 0.02),
        way({ tipo_infra: 'Faixa compartilhada na calçada' }, 0),
      ],
    };
    tagHallGisDiff(osm, gis, 'Rio de Janeiro, Rio de Janeiro, Brasil');
    expect(osm.features[0].properties['ciclomapa:hall_diff']).toBe('rio:match');
    expect(osm.features[1].properties['ciclomapa:hall_diff']).toBe('rio:extra');
    expect(osm.features[2].properties['ciclomapa:hall_diff']).toBeUndefined();
    expect(gis.features[0].properties['ciclomapa:hall_diff']).toBe('rio:match');
    expect(gis.features[1].properties['ciclomapa:hall_diff']).toBe('rio:only');
    expect(gis.features[2].properties['ciclomapa:hall_diff']).toBeUndefined();
  });

  it('does not tag outside GIS cities', () => {
    const osm = {
      type: 'FeatureCollection',
      features: [way({ type: 'Ciclovia' })],
    };
    const gis = {
      type: 'FeatureCollection',
      features: [way({ tipo_infra: 'Ciclovia' })],
    };
    tagHallGisDiff(osm, gis, 'Salvador, Bahia, Brasil');
    expect(osm.features[0].properties['ciclomapa:hall_diff']).toBeUndefined();
    expect(gis.features[0].properties['ciclomapa:hall_diff']).toBeUndefined();
  });

  it('tags nearby Fortaleza SCSP ciclofaixa against OSM', () => {
    const osm = {
      type: 'FeatureCollection',
      features: [way({ type: 'Ciclofaixa' }, 0), way({ type: 'Ciclovia' }, 0.02)],
    };
    const gis = {
      type: 'FeatureCollection',
      features: [way({ tipologia: 'Ciclofaixa' }, 0.0002), way({ tipologia: 'Ciclorrota' }, 0)],
    };
    tagHallGisDiff(osm, gis, 'Fortaleza, Ceará, Brasil');
    expect(osm.features[0].properties['ciclomapa:hall_diff']).toBe('fortaleza:match');
    expect(osm.features[1].properties['ciclomapa:hall_diff']).toBe('fortaleza:extra');
    expect(gis.features[0].properties['ciclomapa:hall_diff']).toBe('fortaleza:match');
    expect(gis.features[1].properties['ciclomapa:hall_diff']).toBeUndefined();
  });
});
