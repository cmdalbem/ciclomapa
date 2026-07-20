import {
  distanceMeters,
  matchStationForOsmPoi,
  mergeStation,
  normalizeStationRef,
  parseLastReportedMs,
  splitVehicleTypes,
  stationsToGeoJSON,
} from './bicingGbfs.js';

describe('bicingGbfs helpers', () => {
  test('normalizeStationRef strips leading zeros', () => {
    expect(normalizeStationRef('008')).toBe('8');
    expect(normalizeStationRef('12')).toBe('12');
    expect(normalizeStationRef(' 55 ')).toBe('55');
    expect(normalizeStationRef(null)).toBe(null);
  });

  test('splitVehicleTypes separates mechanical and e-bike', () => {
    expect(
      splitVehicleTypes([
        { vehicle_type_id: 'ICONIC', count: 4 },
        { vehicle_type_id: 'FIT', count: 1 },
        { vehicle_type_id: 'BOOST', count: 2 },
        { vehicle_type_id: 'EFIT', count: 3 },
      ])
    ).toEqual({ mechanical: 5, ebike: 5 });
  });

  test('parseLastReportedMs handles epoch seconds and ISO', () => {
    expect(parseLastReportedMs(1784490455)).toBe(1784490455 * 1000);
    expect(parseLastReportedMs('2026-07-19T19:45:17Z')).toBe(Date.parse('2026-07-19T19:45:17Z'));
  });

  test('matchStationForOsmPoi prefers nearby ref then geo', () => {
    const stations = [
      {
        stationId: '8',
        lat: 41.39,
        lon: 2.18,
        bikes: 3,
        docks: 10,
        isRenting: true,
        isInstalled: true,
        lastReportedMs: Date.now(),
      },
      {
        stationId: '9',
        lat: 41.3901,
        lon: 2.1801,
        bikes: 1,
        docks: 5,
        isRenting: true,
        isInstalled: true,
        lastReportedMs: Date.now(),
      },
    ];
    const byRef = matchStationForOsmPoi(stations, { lat: 41.39, lng: 2.18, ref: '008' });
    expect(byRef.stationId).toBe('8');

    const byGeo = matchStationForOsmPoi(stations, {
      lat: 41.39005,
      lng: 2.18005,
      ref: undefined,
    });
    expect(byGeo.stationId).toBe('9');

    const tooFar = matchStationForOsmPoi(stations, { lat: 41.5, lng: 2.3, ref: '8' });
    expect(tooFar).toBe(null);
  });

  test('stationsToGeoJSON includes installed stations', () => {
    const now = Date.now();
    const stations = [
      mergeStation(
        { station_id: '1', name: 'A', lat: 41.4, lon: 2.2, capacity: 20 },
        {
          num_bikes_available: 4,
          num_docks_available: 10,
          is_installed: true,
          is_renting: true,
          is_returning: true,
          last_reported: Math.floor(now / 1000),
          vehicle_types_available: [{ vehicle_type_id: 'ICONIC', count: 4 }],
        }
      ),
      mergeStation(
        { station_id: '2', name: 'B', lat: 41.41, lon: 2.21, capacity: 10 },
        {
          num_bikes_available: 0,
          num_docks_available: 0,
          is_installed: true,
          is_renting: false,
          is_returning: false,
          last_reported: Math.floor(now / 1000),
          vehicle_types_available: [],
        }
      ),
    ];
    const fc = stationsToGeoJSON(stations);
    expect(fc.features).toHaveLength(2);
    expect(fc.features.map((f) => f.properties.stationId).sort()).toEqual(['1', '2']);
    expect(fc.features.find((f) => f.properties.stationId === '1').properties.bikes).toBe(4);
  });

  test('distanceMeters is roughly correct nearby', () => {
    const d = distanceMeters(41.4, 2.2, 41.4001, 2.2);
    expect(d).toBeGreaterThan(10);
    expect(d).toBeLessThan(15);
  });
});
