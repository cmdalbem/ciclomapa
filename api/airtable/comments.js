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
const GET_CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=300';

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

  if (typeof body.text !== 'string' || body.text.trim().length === 0) {
    throw badRequest('Invalid request');
  }
  const text = body.text.trim();
  if (text.length > MAX_TEXT_LENGTH) {
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

function buildCommentsResponse(records) {
  const tagsListComment = records.find((c) => c?.fields?.id === TAGS_LIST_COMMENT_ID);
  if (!tagsListComment || !Array.isArray(tagsListComment.fields.tags)) {
    const err = new Error('Failed to load comments');
    err.statusCode = 502;
    throw err;
  }

  const comments = records
    .filter((c) => c?.fields?.status !== 'Resolvida')
    .filter((c) => c?.fields?.latlong !== undefined)
    .map(stripPrivateFields);

  return {
    comments,
    tagsList: tagsListComment.fields.tags,
  };
}

async function handleGet(res) {
  const records = await fetchAirtableTable(COMMENTS_TABLE_NAME);
  const payload = buildCommentsResponse(records);
  sendJson(res, 200, payload, { 'Cache-Control': GET_CACHE_CONTROL });
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
      await handleGet(res);
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
