import AirtableDatabase, {
  citySlugFromLocationLabel,
  listCitiesWithMetric,
  metricHistoryYears,
} from './AirtableDatabase.js';

describe('AirtableDatabase.matchCityMetadataFields', () => {
  const db = new AirtableDatabase();
  const records = [
    { fields: { location: 'São Paulo', pnb_total: 10 } },
    { fields: { location: 'Curitiba', pnb_total: 20 } },
  ];

  it('returns null for empty input', () => {
    expect(db.matchCityMetadataFields(null, 'São Paulo, SP')).toBe(null);
    expect(db.matchCityMetadataFields([], 'São Paulo, SP')).toBe(null);
    expect(db.matchCityMetadataFields(records, '')).toBe(null);
  });

  it('matches when area label contains the Airtable location', () => {
    expect(db.matchCityMetadataFields(records, 'São Paulo, SP, Brasil')?.pnb_total).toBe(10);
    expect(db.matchCityMetadataFields(records, 'Curitiba, PR')?.pnb_total).toBe(20);
  });
});

describe('listCitiesWithMetric', () => {
  const records = [
    { fields: { location: 'Curitiba', pnb_total: 20, ideciclo: 0.3 } },
    { fields: { location: 'São Paulo', pnb_total: 10 } },
    { fields: { location: 'Salvador', pnb_total: 'nope' } },
    { fields: { location: 'Recife' } },
    { fields: { location: 'Fortaleza', pnb_total: 15, alianca_2026: 120 } },
    { fields: { location: 'Fortaleza, Ceará', pnb_total: 99 } },
  ];

  it('builds a slug and sorts by value descending', () => {
    expect(citySlugFromLocationLabel('São Paulo, SP, Brasil')).toBe('sao-paulo');
    expect(listCitiesWithMetric(records, 'pnb_total')).toEqual([
      { cityName: 'Fortaleza', slug: 'fortaleza', value: 99 },
      { cityName: 'Curitiba', slug: 'curitiba', value: 20 },
      { cityName: 'São Paulo', slug: 'sao-paulo', value: 10 },
    ]);
  });

  it('skips missing or non-numeric values and empty input', () => {
    expect(listCitiesWithMetric(null, 'pnb_total')).toEqual([]);
    expect(listCitiesWithMetric(records, 'ideciclo')).toEqual([
      { cityName: 'Curitiba', slug: 'curitiba', value: 0.3 },
    ]);
    expect(listCitiesWithMetric(records, 'alianca_2026')).toEqual([
      { cityName: 'Fortaleza', slug: 'fortaleza', value: 120 },
    ]);
  });

  it('collects year columns from a prefix and keeps 0 as a real value', () => {
    const historic = [
      {
        fields: {
          location: 'Palmas',
          pnb_total: 17,
          pnb_2018: 0,
          pnb_2024: 17,
          alianca_2025: 93,
          alianca_2026: 120,
        },
      },
      {
        fields: {
          location: 'São Paulo',
          pnb_total: 28,
          pnb_2018: 19,
          pnb_2024: 28,
          alianca_2024: 710.9,
          alianca_2026: 756.8,
        },
      },
    ];
    const pnb = listCitiesWithMetric(historic, 'pnb_total', { yearPrefix: 'pnb_' });
    expect(metricHistoryYears(pnb)).toEqual([2018, 2024]);
    expect(pnb[0].history).toEqual({ 2018: 19, 2024: 28 });
    expect(pnb[1].history).toEqual({ 2018: 0, 2024: 17 });

    const official = listCitiesWithMetric(historic, 'alianca_2026', { yearPrefix: 'alianca_' });
    expect(metricHistoryYears(official)).toEqual([2024, 2025, 2026]);
    expect(official.find((r) => r.slug === 'palmas').history[2024]).toBeUndefined();
  });
});

describe('AirtableDatabase same-origin client', () => {
  const db = new AirtableDatabase();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('getMetadata returns JSON when the proxy succeeds', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [{ id: 'rec1', fields: { location: 'Curitiba' } }],
    });

    await expect(db.getMetadata()).resolves.toEqual([
      { id: 'rec1', fields: { location: 'Curitiba' } },
    ]);
    expect(fetch).toHaveBeenCalledWith('/api/airtable/metadata', undefined);
  });

  it('getComments throws the server error message', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ error: 'Airtable request failed' }),
    });

    await expect(db.getComments()).rejects.toThrow('Airtable request failed');
  });

  it('getComments({ fresh: true }) bypasses the CDN cache', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ comments: [], tagsList: [] }),
    });

    await expect(db.getComments({ fresh: true })).resolves.toEqual({
      comments: [],
      tagsList: [],
    });
    expect(fetch).toHaveBeenCalledWith('/api/airtable/comments?fresh=1', undefined);
  });

  it('getComments({ all: true, fresh: true }) asks for unfiltered comments', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ comments: [], tagsList: [] }),
    });

    await expect(db.getComments({ all: true, fresh: true })).resolves.toEqual({
      comments: [],
      tagsList: [],
    });
    expect(fetch).toHaveBeenCalledWith('/api/airtable/comments?fresh=1&all=1', undefined);
  });

  it('create POSTs JSON and throws when the write fails', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Invalid request' }),
    });

    await expect(db.create({ text: 'x' })).rejects.toThrow('Invalid request');
    expect(fetch).toHaveBeenCalledWith('/api/airtable/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'x' }),
    });
  });
});
