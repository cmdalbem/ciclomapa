import MapPopups, {
  buildGoogleStreetViewUrl,
  buildMapillaryUrl,
  contrastingTextOn,
  escapeHtml,
  formatAddressLineFromOsmProperties,
  formatNominatimReverseLine,
  omitAddressTagsForDetailGrid,
  primaryCityFromAreaLabel,
} from './MapPopups.js';

jest.mock('./Analytics.js', () => ({ event: jest.fn() }));

jest.mock('mapbox-gl', () => {
  function Popup() {
    this._isOpen = false;
    this.setHTML = jest.fn().mockReturnThis();
    this.setLngLat = jest.fn().mockReturnThis();
    this.addTo = jest.fn(function addTo() {
      this._isOpen = true;
      return this;
    });
    this.remove = jest.fn(function remove() {
      this._isOpen = false;
    });
    this.addClassName = jest.fn();
    this.removeClassName = jest.fn();
    this.on = jest.fn();
    this.isOpen = jest.fn(function isOpen() {
      return this._isOpen;
    });
  }
  return { __esModule: true, default: { Popup } };
});

describe('MapPopups POI address helpers', () => {
  /** @type {InstanceType<typeof MapPopups>[]} */
  let livePopups = [];

  function createPopups(...args) {
    const popups = new MapPopups(...args);
    livePopups.push(popups);
    return popups;
  }

  afterEach(() => {
    livePopups.forEach((p) => p.destroy());
    livePopups = [];
  });

  describe('escapeHtml', () => {
    it('escapes HTML special characters', () => {
      expect(escapeHtml('<a>')).toBe('&lt;a&gt;');
      expect(escapeHtml('A & B')).toBe('A &amp; B');
    });
  });

  describe('Escape key', () => {
    it('closes an open feature popup', () => {
      const popups = createPopups({});
      popups.cyclewayPopup._isOpen = true;

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      expect(popups.cyclewayPopup.remove).toHaveBeenCalled();
    });

    it('does nothing when no popup is open', () => {
      const popups = createPopups({});
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(popups.cyclewayPopup.remove).not.toHaveBeenCalled();
    });
  });

  describe('contrastingTextOn', () => {
    it('picks white on near-black and black on yellow', () => {
      expect(contrastingTextOn('#111111')).toBe('#ffffff');
      expect(contrastingTextOn('#000')).toBe('#ffffff');
      expect(contrastingTextOn('#FFE600')).toBe('#111111');
      expect(contrastingTextOn('nope')).toBe('#ffffff');
    });
  });

  describe('showCyclewayPopup theme', () => {
    const click = {
      lngLat: { lng: -46.63, lat: -23.55 },
      features: [
        {
          id: 1,
          source: 'geojson',
          properties: { id: 'way/1', name: 'Rua X', highway: 'cycleway' },
        },
      ],
    };

    function popupEl() {
      const el = document.createElement('div');
      el.className = 'popup-big mapboxgl-popup';
      document.body.appendChild(el);
      return el;
    }

    afterEach(() => {
      document.querySelectorAll('.popup-big.mapboxgl-popup').forEach((el) => el.remove());
    });

    it('does not paint mapper overlay popups with the layer line color', () => {
      const el = popupEl();
      const popups = createPopups({});
      popups.showCyclewayPopup(click, {
        id: 'nao-pareados',
        name: 'Não pareados',
        onlyDebug: true,
        description: 'fora da dupla contagem',
        style: { lineColor: '#111111' },
      });

      expect(el.style.getPropertyValue('--popup-bg-color')).toBe('');
      expect(el.style.getPropertyValue('--popup-text-color')).toBe('');
      const html = popups.cyclewayPopup.setHTML.mock.calls[0][0];
      expect(html).toContain('background-color: #111111');
      expect(html).toContain('color: #ffffff');
      expect(html).toContain('Não pareados');
    });

    it('clears a previous typology tint before showing a mapper overlay', () => {
      const el = popupEl();
      el.style.setProperty('--popup-bg-color', '#386641');
      el.style.setProperty('--popup-text-color', '#FFFFFF');
      const popups = createPopups({});
      popups.showCyclewayPopup(click, {
        id: 'nao-pareados',
        name: 'Não pareados',
        onlyDebug: true,
        style: { lineColor: '#111111' },
      });
      expect(el.style.getPropertyValue('--popup-bg-color')).toBe('');
      expect(el.style.getPropertyValue('--popup-text-color')).toBe('');
    });

    it('still tints production typology popups', () => {
      const el = popupEl();
      const popups = createPopups({});
      popups.showCyclewayPopup(click, {
        id: 'ciclovia',
        name: 'Ciclovia',
        style: { lineColor: '#386641', textColor: '#FFFFFF' },
      });
      expect(el.style.getPropertyValue('--popup-bg-color')).toBe('#386641');
      expect(el.style.getPropertyValue('--popup-text-color')).toBe('#FFFFFF');
    });
  });

  describe('Street View mapper button', () => {
    it('builds a Street View URL with the map pane open', () => {
      const url = buildGoogleStreetViewUrl(-23.55, -46.63);
      expect(url).toContain('google.com/maps');
      expect(url).toContain('layer=c');
      expect(url).toContain('cbll=-23.55%2C-46.63');
      expect(url).toContain('cbp=11%2C0%2C0%2C0%2C0');
    });

    it('builds a Mapillary URL zoomed to the feature', () => {
      const url = buildMapillaryUrl(-23.55, -46.63);
      expect(url).toContain('mapillary.com/app');
      expect(url).toContain('lat=-23.55');
      expect(url).toContain('lng=-46.63');
      expect(url).toContain('z=17');
    });

    it('puts Street View and Mapillary inside the mapper box, not the footer', () => {
      const mapperPopups = createPopups({}, false, false, '', true);
      const normalPopups = createPopups({}, false);
      const coords = [-46.63, -23.55];

      const mapperHtml = mapperPopups.renderFeatureDetails({ lit: 'yes' }, coords);
      const footerHtml = mapperPopups.getFooter(
        'https://www.openstreetmap.org/way/1',
        'black',
        coords
      );
      const normalHtml = normalPopups.renderFeatureDetails({ lit: 'yes' }, coords);

      expect(mapperHtml).toContain('data-mapper-box');
      expect(mapperHtml).toContain('Street View');
      expect(mapperHtml).toContain('Mapillary');
      expect(mapperHtml).toContain('Modo mapeador');
      expect(mapperHtml).toContain('layer=c');
      expect(mapperHtml).toContain('mapillary.com/app');
      expect(footerHtml).not.toContain('Street View');
      expect(footerHtml).not.toContain('Mapillary');
      expect(normalHtml).not.toContain('Street View');
      expect(normalHtml).not.toContain('Mapillary');
      expect(normalHtml).not.toContain('data-mapper-box');
    });
  });

  describe('renderFeatureDetails', () => {
    it('puts translated tags in the main grid without OSM-key tooltips', () => {
      const popups = createPopups({}, false);
      const html = popups.renderFeatureDetails({
        lit: 'yes',
        surface: 'concrete',
        highway: 'cycleway',
      });

      expect(html).toContain('data-popup-tag-kind="main"');
      expect(html).toContain('Iluminado?');
      expect(html).toContain('Superfície');
      expect(html).not.toContain('cursor-help');
      expect(html).not.toContain('data-mapper-box');
      expect(html).not.toContain('highway');
    });

    it('puts untranslated tags in the mapper box with tooltips', () => {
      const popups = createPopups({}, false, false, '', true);
      const html = popups.renderFeatureDetails({
        lit: 'yes',
        highway: 'cycleway',
        id: 'way/311571202',
        'source:lit': 'survey',
        segregated: 'no',
      });

      expect(html).toContain('data-mapper-box');
      expect(html).toContain('Modo mapeador');
      expect(html).toContain('data-popup-tag-kind="debug"');
      expect(html).toContain('highway');
      expect(html).toContain('way/311571202');
      expect(html).toContain('source:lit');
      expect(html).toContain('cursor-help');
      expect(html).toContain('type="button"');
      expect(html).toContain('group-focus-within:opacity-100');
      expect(html).not.toContain(' title=');
      expect(html).toContain('popup-debug-tag-tooltip');
      expect(html).toContain('Valores comuns');
      expect(html).toMatch(/cycleway/);
      expect(html).toMatch(/designated|faixas separadas|survey/);
      expect(html).toContain('Iluminado?');
      expect(html.indexOf('Iluminado?')).toBeLessThan(html.indexOf('data-mapper-box'));
    });

    it('shows typology tags first and collapses the rest under Ver mais', () => {
      const popups = createPopups({}, false, false, '', true);
      const html = popups.renderFeatureDetails({
        id: 'way/1',
        'source:surface': 'survey',
        name: 'Ciclovia X',
        highway: 'cycleway',
        bicycle: 'designated',
        segregated: 'no',
      });

      expect(html).toContain('Ver mais (3)');
      expect(html).toContain('popup-debug-tags__more');
      expect(html.indexOf('data-popup-tag="highway"')).toBeLessThan(
        html.indexOf('popup-debug-tags__more')
      );
      expect(html.indexOf('data-popup-tag="bicycle"')).toBeLessThan(
        html.indexOf('popup-debug-tags__more')
      );
      expect(html.indexOf('data-popup-tag="segregated"')).toBeLessThan(
        html.indexOf('popup-debug-tags__more')
      );
      expect(html.indexOf('popup-debug-tags__more')).toBeLessThan(
        html.indexOf('data-popup-tag="id"')
      );
      expect(html.indexOf('data-popup-tag="highway"')).toBeLessThan(
        html.indexOf('data-popup-tag="bicycle"')
      );
    });
  });

  describe('showCommentPopup', () => {
    it('HTML-escapes comment text and tags before setHTML', () => {
      const popups = createPopups({});
      popups.showCommentPopup({
        features: [
          {
            geometry: { coordinates: [-46.6, -23.5] },
            properties: {
              createdAt: new Date().toISOString(),
              text: '<img src=x onerror=alert(1)>',
              tags: JSON.stringify(['ok', '<script>', 'Outros']),
            },
          },
        ],
      });

      expect(popups.commentPopup.setHTML).toHaveBeenCalledTimes(1);
      const html = popups.commentPopup.setHTML.mock.calls[0][0];
      expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
      expect(html).not.toContain('<img src=x');
      expect(html).toContain('&lt;script&gt;');
      expect(html).toContain('ok');
      expect(html).not.toContain('Outros');
    });
  });

  describe('formatAddressLineFromOsmProperties', () => {
    it('returns addr:full when present', () => {
      expect(
        formatAddressLineFromOsmProperties({
          'addr:full': '  Av. Ipiranga, 123  ',
        })
      ).toBe('Av. Ipiranga, 123');
    });

    it('returns contact:address', () => {
      expect(
        formatAddressLineFromOsmProperties({
          'contact:address': 'Rua X, 10',
        })
      ).toBe('Rua X, 10');
    });

    it('combines street and housenumber', () => {
      expect(
        formatAddressLineFromOsmProperties({
          'addr:street': 'Rua da Praia',
          'addr:housenumber': '500',
        })
      ).toContain('Rua da Praia');
    });

    it('adds suburb and city when available (no state)', () => {
      const line = formatAddressLineFromOsmProperties({
        'addr:street': 'Rua A',
        'addr:housenumber': '1',
        'addr:suburb': 'Centro',
        'addr:city': 'Porto Alegre',
        'addr:state': 'RS',
      });
      expect(line).toMatch(/Rua A/);
      expect(line).toMatch(/Centro/);
      expect(line).toMatch(/Porto Alegre/);
      expect(line).not.toMatch(/\bRS\b/);
    });

    it('returns null when no address tags', () => {
      expect(formatAddressLineFromOsmProperties({ name: 'Bike shop' })).toBeNull();
      expect(formatAddressLineFromOsmProperties(null)).toBeNull();
    });
  });

  describe('omitAddressTagsForDetailGrid', () => {
    it('removes addr:* and contact:address', () => {
      const out = omitAddressTagsForDetailGrid({
        name: 'X',
        'addr:street': 'Rua A',
        'addr:city': 'Y',
        'contact:address': 'Z',
        website: 'http://example.com',
      });
      expect(out.name).toBe('X');
      expect(out.website).toBe('http://example.com');
      expect(out['addr:street']).toBeUndefined();
      expect(out['addr:city']).toBeUndefined();
      expect(out['contact:address']).toBeUndefined();
    });
  });

  describe('primaryCityFromAreaLabel', () => {
    it('returns first comma segment', () => {
      expect(primaryCityFromAreaLabel('Porto Alegre, RS, Brasil')).toBe('Porto Alegre');
      expect(primaryCityFromAreaLabel('São Paulo')).toBe('São Paulo');
    });
  });

  describe('formatNominatimReverseLine', () => {
    it('returns null on error payload', () => {
      expect(formatNominatimReverseLine({ error: 'x' })).toBeNull();
      expect(formatNominatimReverseLine(null)).toBeNull();
    });

    it('builds local line without state', () => {
      const line = formatNominatimReverseLine({
        display_name: 'Ignore this long string, Brazil',
        address: {
          road: 'Av. Borges de Medeiros',
          house_number: '123',
          suburb: 'Centro Histórico',
          city: 'Porto Alegre',
          state: 'Rio Grande do Sul',
          country: 'Brasil',
        },
      });
      expect(line).toContain('Av. Borges de Medeiros');
      expect(line).toContain('123');
      expect(line).toContain('Porto Alegre');
      expect(line).not.toMatch(/Rio Grande do Sul/);
      expect(line).not.toMatch(/Brasil/);
      expect(line).not.toContain('Ignore this long');
    });

    it('omits city when it matches selected map area', () => {
      const line = formatNominatimReverseLine(
        {
          address: {
            road: 'Rua X',
            suburb: 'Centro Histórico',
            city: 'Porto Alegre',
            state: 'RS',
          },
        },
        { selectedAreaLabel: 'Porto Alegre, Rio Grande do Sul, Brasil' }
      );
      expect(line).toBe('Rua X · Centro Histórico');
      expect(line).not.toMatch(/Porto Alegre/);
    });

    it('returns null when address block missing', () => {
      expect(formatNominatimReverseLine({ display_name: 'Only display' })).toBeNull();
    });
  });
});
