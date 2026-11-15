const {
  fetchAirtableTable,
  createAirtableRecord,
  sendJson,
  sendError,
  methodNotAllowed,
} = require('../_lib/airtable');

const COMMENTS_TABLE_NAME = 'Comments';
const TAGS_LIST_COMMENT_ID = 44;
const DEFAULT_STATUS = 'Aberta';
const HONEYPOT_FIELD = 'website';
const PRIVATE_FIELDS = ['email'];
// Shared CDN cache for normal map loads. After a user posts, the client
// refetches with ?fresh=1 so that one request bypasses the edge cache.
const GET_CACHE_CONTROL = 'public, s-maxage=300, stale-while-revalidate=3600';
const FRESH_CACHE_CONTROL = 'no-store';
// Pull only recent open rows the map can show, plus the magic tags-list row (id=44).
// Without this, a ~230-row table is 3 Airtable pages (max pageSize 100) per load,
// and years-old unverified reports look like current map truth.
const MAX_COMMENT_AGE_MONTHS = 24;
const COMMENTS_FILTER_FORMULA = `OR({id}=${TAGS_LIST_COMMENT_ID},AND({status}='Aberta',{latlong}!='',IS_AFTER({createdAt},DATEADD(TODAY(),-${MAX_COMMENT_AGE_MONTHS},'months'))))`;
const COMMENTS_FIELDS = ['id', 'status', 'latlong', 'location', 'text', 'tags', 'createdAt'];
const MAX_COMMENT_AGE_MS = MAX_COMMENT_AGE_MONTHS * 30 * 24 * 60 * 60 * 1000;

const MIN_TEXT_LENGTH = 20;
const MAX_TEXT_LENGTH = 2000;
const MAX_LOCATION_LENGTH = 300;
const MAX_EMAIL_LENGTH = 254;
const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 80;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LATLONG_RE = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;

function badRequest(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

function stripPrivateFields(record) {
  if (!record || typeof record !== 'object') return record;
  const fields = record.fields && typeof record.fields === 'object' ? { ...record.fields } : {};
  PRIVATE_FIELDS.forEach((key) => {
    delete fields[key];
  });
  return { ...record, fields };
}

function readJsonBody(req) {
  if (req.body == null || req.body === '') {
    throw badRequest('Invalid request');
  }
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      throw badRequest('Invalid request');
    }
  }
  if (typeof req.body !== 'object' || Array.isArray(req.body)) {
    throw badRequest('Invalid request');
  }
  return req.body;
}

function parseLatLong(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(LATLONG_RE);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return `${lat},${lng}`;
}

function validateCommentPayload(body) {
  const honeypot = body[HONEYPOT_FIELD];
  if (honeypot != null && String(honeypot).trim() !== '') {
    throw badRequest('Invalid request');
  }

  const latlong = parseLatLong(body.latlong);
  if (!latlong) {
    throw badRequest('Invalid request');
  }

  if (typeof body.location !== 'string' || body.location.trim().length === 0) {
    throw badRequest('Invalid request');
  }
  const location = body.location.trim();
  if (location.length > MAX_LOCATION_LENGTH) {
    throw badRequest('Invalid request');
  }

  if (typeof body.text !== 'string') {
    throw badRequest('Invalid request');
  }
  const text = body.text.trim();
  if (text.length < MIN_TEXT_LENGTH || text.length > MAX_TEXT_LENGTH) {
    throw badRequest('Invalid request');
  }

  if (!Array.isArray(body.tags) || body.tags.length === 0 || body.tags.length > MAX_TAGS) {
    throw badRequest('Invalid request');
  }
  const tags = body.tags.map((tag) => {
    if (typeof tag !== 'string' || tag.trim().length === 0 || tag.trim().length > MAX_TAG_LENGTH) {
      throw badRequest('Invalid request');
    }
    return tag.trim();
  });

  let email;
  if (body.email != null && body.email !== '') {
    if (
      typeof body.email !== 'string' ||
      body.email.length > MAX_EMAIL_LENGTH ||
      !EMAIL_RE.test(body.email.trim())
    ) {
      throw badRequest('Invalid request');
    }
    email = body.email.trim();
  }

  const fields = {
    status: DEFAULT_STATUS,
    latlong,
    location,
    text,
    tags,
  };
  if (email) {
    fields.email = email;
  }
  return fields;
}

function isRecentComment(record) {
  const createdAt = record?.fields?.createdAt;
  if (!createdAt) return false;
  const createdMs = Date.parse(createdAt);
  if (!Number.isFinite(createdMs)) return false;
  return Date.now() - createdMs <= MAX_COMMENT_AGE_MS;
}

function buildCommentsResponse(records) {
  const tagsListComment = records.find((c) => c?.fields?.id === TAGS_LIST_COMMENT_ID);
  if (!tagsListComment || !Array.isArray(tagsListComment.fields.tags)) {
    const err = new Error('Failed to load comments');
    err.statusCode = 502;
    throw err;
  }

  const comments = records
    .filter((c) => c?.fields?.id !== TAGS_LIST_COMMENT_ID)
    .filter((c) => c?.fields?.status === 'Aberta')
    .filter((c) => c?.fields?.latlong !== undefined)
    .filter(isRecentComment)
    .map(stripPrivateFields);

  return {
    comments,
    tagsList: tagsListComment.fields.tags,
  };
}

function wantsFreshComments(req) {
  try {
    const rawUrl = req.url || '/';
    const url = new URL(rawUrl, 'http://localhost');
    return url.searchParams.get('fresh') === '1';
  } catch {
    return false;
  }
}

async function handleGet(req, res) {
  const records = await fetchAirtableTable(COMMENTS_TABLE_NAME, {
    filterByFormula: COMMENTS_FILTER_FORMULA,
    fields: COMMENTS_FIELDS,
  });
  const payload = buildCommentsResponse(records);
  const cacheControl = wantsFreshComments(req) ? FRESH_CACHE_CONTROL : GET_CACHE_CONTROL;
  sendJson(res, 200, payload, { 'Cache-Control': cacheControl });
}

async function handlePost(req, res) {
  const body = readJsonBody(req);
  const fields = validateCommentPayload(body);
  await createAirtableRecord(COMMENTS_TABLE_NAME, fields);
  sendJson(res, 201, { ok: true }, { 'Cache-Control': 'no-store' });
}

module.exports = async function commentsHandler(req, res) {
  try {
    if (req.method === 'GET') {
      await handleGet(req, res);
      return;
    }
    if (req.method === 'POST') {
      await handlePost(req, res);
      return;
    }
    methodNotAllowed(res, 'GET, POST');
  } catch (err) {
    sendError(res, err);
  }
};
