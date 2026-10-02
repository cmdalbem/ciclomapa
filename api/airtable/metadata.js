const { fetchAirtableTable, sendJson, sendError, methodNotAllowed } = require('../_lib/airtable');

const METADATA_TABLE_NAME = 'Metadata';
const CACHE_CONTROL = 'public, s-maxage=3600, stale-while-revalidate=86400';

module.exports = async function metadataHandler(req, res) {
  if (req.method !== 'GET') {
    methodNotAllowed(res, 'GET');
    return;
  }

  try {
    const records = await fetchAirtableTable(METADATA_TABLE_NAME);
    sendJson(res, 200, records, { 'Cache-Control': CACHE_CONTROL });
  } catch (err) {
    sendError(res, err);
  }
};
