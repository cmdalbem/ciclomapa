const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';

function getAirtableConfig() {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!apiKey || !baseId) {
    const err = new Error('Airtable is not configured');
    err.statusCode = 500;
    throw err;
  }
  return { apiKey, baseId };
}

function airtableError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

async function readAirtableJson(response) {
  if (!response.ok) {
    throw airtableError('Airtable request failed', 502);
  }
  try {
    return await response.json();
  } catch {
    throw airtableError('Airtable request failed', 502);
  }
}

async function fetchAirtableTable(tableName, { view } = {}) {
  const { apiKey, baseId } = getAirtableConfig();
  const records = [];
  let offset;

  do {
    const url = new URL(
      `${AIRTABLE_API_BASE}/${encodeURIComponent(baseId)}/${encodeURIComponent(tableName)}`
    );
    if (view) url.searchParams.set('view', view);
    if (offset) url.searchParams.set('offset', offset);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    const data = await readAirtableJson(response);
    if (Array.isArray(data.records)) {
      records.push(...data.records);
    }
    offset = data.offset;
  } while (offset);

  return records;
}

async function createAirtableRecord(tableName, fields) {
  const { apiKey, baseId } = getAirtableConfig();
  const url = `${AIRTABLE_API_BASE}/${encodeURIComponent(baseId)}/${encodeURIComponent(tableName)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ records: [{ fields }] }),
  });
  return readAirtableJson(response);
}

function sendJson(res, status, body, headers = {}) {
  Object.entries(headers).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  res.status(status).json(body);
}

function publicErrorMessage(err, status) {
  if (status === 400) return err.message || 'Invalid request';
  if (status === 405) return 'Method not allowed';
  if (status === 500 && err.message === 'Airtable is not configured') {
    return 'Airtable is not configured';
  }
  return 'Airtable request failed';
}

function sendError(res, err) {
  const status = Number.isInteger(err.statusCode) ? err.statusCode : 500;
  sendJson(
    res,
    status,
    { error: publicErrorMessage(err, status) },
    { 'Cache-Control': 'no-store' }
  );
}

function methodNotAllowed(res, allow) {
  res.setHeader('Allow', allow);
  sendJson(res, 405, { error: 'Method not allowed' }, { 'Cache-Control': 'no-store' });
}

module.exports = {
  fetchAirtableTable,
  createAirtableRecord,
  sendJson,
  sendError,
  methodNotAllowed,
};
