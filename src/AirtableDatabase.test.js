import AirtableDatabase from './AirtableDatabase.js';

describe('AirtableDatabase.fetchTable', () => {
  const originalKey = process.env.REACT_APP_AIRTABLE_API_KEY;
  const originalBase = process.env.REACT_APP_AIRTABLE_BASE_ID;
  const originalFetch = global.fetch;
  const db = new AirtableDatabase();

  beforeEach(() => {
    process.env.REACT_APP_AIRTABLE_API_KEY = 'pat-test';
    process.env.REACT_APP_AIRTABLE_BASE_ID = 'appTest';
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.REACT_APP_AIRTABLE_API_KEY;
    else process.env.REACT_APP_AIRTABLE_API_KEY = originalKey;
    if (originalBase === undefined) delete process.env.REACT_APP_AIRTABLE_BASE_ID;
    else process.env.REACT_APP_AIRTABLE_BASE_ID = originalBase;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('returns records from a successful response', async () => {
    const records = [{ id: 'rec1', fields: { location: 'Juazeiro' } }];
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ records }),
    });

    await expect(db.fetchTable('Metadata')).resolves.toEqual(records);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('returns nothing for an empty 200 without warning', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ records: [] }),
    });

    await expect(db.fetchTable('Comments')).resolves.toBeUndefined();
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it('does not warn when Airtable rejects the token', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        error: { type: 'UNAUTHORIZED', message: 'Invalid authentication token' },
      }),
    });

    await expect(db.fetchTable('Metadata')).resolves.toBeUndefined();
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
    expect(console.debug).toHaveBeenCalledWith('fetchTable(Metadata): HTTP 401');
  });
});
