import AirtableDatabase from './AirtableDatabase.js';

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
