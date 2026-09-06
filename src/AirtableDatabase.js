import { removeAccents } from './utils/utils.js';

class AirtableDatabase {
  /**
   * Find the Metadata row whose `location` is contained in the current area label.
   * @param {Array<{ fields?: { location?: string } }>|null|undefined} records
   * @param {string|null|undefined} areaLabel
   * @returns {Record<string, unknown>|null}
   */
  matchCityMetadataFields(records, areaLabel) {
    if (
      !Array.isArray(records) ||
      records.length === 0 ||
      !areaLabel ||
      typeof areaLabel !== 'string'
    ) {
      return null;
    }
    const normalizedArea = removeAccents(areaLabel.toLowerCase());
    const hit = records.find((row) => {
      const loc = row?.fields?.location;
      if (!loc || typeof loc !== 'string') return false;
      return normalizedArea.includes(removeAccents(loc.toLowerCase()));
    });
    return hit?.fields ?? null;
  }

  async request(path, options) {
    const response = await fetch(path, options);
    if (!response.ok) {
      let message = 'Airtable request failed';
      try {
        const body = await response.json();
        if (body && typeof body.error === 'string' && body.error.trim()) {
          message = body.error;
        }
      } catch {
        // keep generic message
      }
      const err = new Error(message);
      err.status = response.status;
      throw err;
    }
    return response.json();
  }

  async getMetadata() {
    return this.request('/api/airtable/metadata');
  }

  async getComments() {
    return this.request('/api/airtable/comments');
  }

  async create(fields) {
    return this.request('/api/airtable/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
  }
}

export default AirtableDatabase;
