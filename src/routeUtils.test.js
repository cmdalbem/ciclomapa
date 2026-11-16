import {
  THIN_SPACE,
  appendKmUnit,
  formatDistance,
  formatDuration,
  getRouteScore,
  readDirectionsUrlParams,
  writeDirectionsUrlParams,
} from './utils/routeUtils.js';

function leadingNumber(formattedDistance) {
  const m = /^(\d+(?:\.\d+)?)/.exec(formattedDistance);
  return m ? Number(m[1]) : NaN;
}

describe('appendKmUnit', () => {
  it('inserts thin space before km', () => {
    expect(appendKmUnit('12,4')).toBe(`12,4${THIN_SPACE}km`);
  });
});

describe('formatDistance', () => {
  it('converts meters to one decimal place in the leading numeric segment', () => {
    expect(leadingNumber(formatDistance(5500))).toBe(5.5);
  });
  it('returns N/A for null/undefined', () => {
    expect(formatDistance(null)).toBe('N/A');
    expect(formatDistance(undefined)).toBe('N/A');
  });
});

describe('formatDuration', () => {
  it('formats seconds as minutes under an hour', () => {
    expect(formatDuration(300)).toBe('5 min');
  });
  it('formats longer trips as hours and minutes', () => {
    expect(formatDuration(226 * 60)).toBe('3h 46min');
    expect(formatDuration(120 * 60)).toBe('2h');
  });
  it('returns N/A for null/undefined', () => {
    expect(formatDuration(null)).toBe('N/A');
    expect(formatDuration(undefined)).toBe('N/A');
  });
});

describe('getRouteScore', () => {
  it('returns score and cssClass for route with coverage', () => {
    const route = {
      coverage: 80,
      coverageByType: { Ciclovia: 50, Ciclofaixa: 30 },
    };
    const result = getRouteScore(route);
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('cssClass');
    expect(typeof result.score).toBe('number');
    expect(['bg-red-600', 'bg-yellow-600', 'bg-green-600']).toContain(result.cssClass);
  });
  it('returns score null and cssClass null when route has no coverageByType', () => {
    const result = getRouteScore({});
    expect(result).toEqual({ score: null, cssClass: null });
  });
  it('returns score 0 and red class when totalCoverage is 0', () => {
    const route = { coverage: 0, coverageByType: {} };
    const result = getRouteScore(route);
    expect(result.score).toBe(0);
    expect(result.cssClass).toBe('bg-red-600');
  });
});

describe('readDirectionsUrlParams', () => {
  it('parses valid directions prefs from a search string', () => {
    expect(
      readDirectionsUrlParams(
        '?provider=brouter&sort=fastest&maxroutes=12&cobertura=brTags&elev=0&unpaved=4&noise=1&river=1&forest=1'
      )
    ).toEqual({
      provider: 'brouter',
      sort: 'fastest',
      maxRoutes: 12,
      coverage: 'brTags',
      consider_elevation: false,
      unpavedPenalty: 4,
      consider_noise: true,
      consider_river: true,
      consider_forest: true,
    });
  });

  it('returns nulls for missing or invalid values', () => {
    expect(readDirectionsUrlParams('?provider=nope&sort=x&maxroutes=-1&cobertura=foo')).toEqual({
      provider: null,
      sort: null,
      maxRoutes: null,
      coverage: null,
      consider_elevation: null,
      unpavedPenalty: null,
      consider_noise: null,
      consider_river: null,
      consider_forest: null,
    });
  });
});

describe('writeDirectionsUrlParams', () => {
  const original = window.location.href;

  afterEach(() => {
    window.history.replaceState(null, '', original);
  });

  it('writes non-default prefs and omits defaults', () => {
    window.history.replaceState(null, '', '/sao-paulo/routes?lat=1&lng=2');
    writeDirectionsUrlParams(
      { provider: 'brouter', sort: 'score', maxRoutes: 5 },
      { maxRoutes: 5 }
    );
    const params = new URLSearchParams(window.location.search);
    expect(params.get('provider')).toBe('brouter');
    expect(params.get('sort')).toBeNull();
    expect(params.get('maxroutes')).toBeNull();
    expect(params.get('lat')).toBe('1');
  });

  it('writes non-default BRouter prefs as short flags', () => {
    window.history.replaceState(null, '', '/barcelona/routes?lat=1');
    writeDirectionsUrlParams({
      consider_elevation: false,
      unpavedPenalty: 4,
      consider_noise: true,
      consider_river: false,
      consider_forest: true,
    });
    const params = new URLSearchParams(window.location.search);
    expect(params.get('elev')).toBe('0');
    expect(params.get('unpaved')).toBe('4');
    expect(params.get('noise')).toBe('1');
    expect(params.get('river')).toBeNull();
    expect(params.get('forest')).toBe('1');
    expect(params.get('lat')).toBe('1');
  });
});
