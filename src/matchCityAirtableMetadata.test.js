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
