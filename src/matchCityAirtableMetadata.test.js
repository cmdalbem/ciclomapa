import { matchCityAirtableFields } from './matchCityAirtableMetadata.js';

describe('matchCityAirtableFields', () => {
  const records = [
    { fields: { location: 'São Paulo', pnb_total: 10 } },
    { fields: { location: 'Curitiba', pnb_total: 20 } },
  ];

  it('returns null for empty input', () => {
    expect(matchCityAirtableFields(null, 'São Paulo, SP')).toBe(null);
    expect(matchCityAirtableFields([], 'São Paulo, SP')).toBe(null);
    expect(matchCityAirtableFields(records, '')).toBe(null);
  });

  it('matches when area label contains the Airtable location', () => {
    expect(matchCityAirtableFields(records, 'São Paulo, SP, Brasil')?.pnb_total).toBe(10);
    expect(matchCityAirtableFields(records, 'Curitiba, PR')?.pnb_total).toBe(20);
  });
});
