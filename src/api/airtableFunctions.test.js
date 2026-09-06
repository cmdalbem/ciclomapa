import commentsHandler from '../../api/airtable/comments.js';
import metadataHandler from '../../api/airtable/metadata.js';

function createRes() {
  return {
    headers: {},
    statusCode: 200,
    body: undefined,
    setHeader(key, value) {
      this.headers[key] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

const validComment = {
  latlong: '-30.0346,-51.2177',
  location: 'Porto Alegre, RS',
  text: 'Ciclovia sem continuidade.',
  tags: ['Infraestrutura'],
};

describe('Airtable Vercel functions', () => {
  const originalKey = process.env.AIRTABLE_API_KEY;
  const originalBase = process.env.AIRTABLE_BASE_ID;

  beforeEach(() => {
    process.env.AIRTABLE_API_KEY = 'test-key';
    process.env.AIRTABLE_BASE_ID = 'appTest';
    jest.spyOn(global, 'fetch').mockResolvedValue(jsonResponse(200, { records: [] }));
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.AIRTABLE_API_KEY;
    else process.env.AIRTABLE_API_KEY = originalKey;
    if (originalBase === undefined) delete process.env.AIRTABLE_BASE_ID;
    else process.env.AIRTABLE_BASE_ID = originalBase;
    jest.restoreAllMocks();
  });

  it('rejects unsupported methods with 405', async () => {
    const res = createRes();
    await commentsHandler({ method: 'PUT' }, res);
    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe('GET, POST');
    expect(res.body).toEqual({ error: 'Method not allowed' });
  });

  it('GET metadata paginates Airtable and caches the response', async () => {
    fetch
      .mockResolvedValueOnce(
        jsonResponse(200, {
          records: [{ id: 'rec1', fields: { location: 'Curitiba' } }],
          offset: 'page2',
        })
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          records: [{ id: 'rec2', fields: { location: 'Recife' } }],
        })
      );

    const res = createRes();
    await metadataHandler({ method: 'GET' }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([
      { id: 'rec1', fields: { location: 'Curitiba' } },
      { id: 'rec2', fields: { location: 'Recife' } },
    ]);
    expect(res.headers['Cache-Control']).toContain('s-maxage=3600');
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(String(fetch.mock.calls[0][0])).toContain('/appTest/Metadata');
    expect(String(fetch.mock.calls[1][0])).toContain('offset=page2');
  });

  it('GET comments strips email and solved records', async () => {
    fetch.mockResolvedValueOnce(
      jsonResponse(200, {
        records: [
          { id: 'tags', fields: { id: 44, tags: ['Infraestrutura', 'Sinalização'] } },
          {
            id: 'open',
            fields: {
              status: 'Aberta',
              latlong: '-30.03,-51.21',
              text: 'buraco',
              email: 'secret@example.com',
            },
          },
          { id: 'done', fields: { status: 'Resolvida', latlong: '-30.04,-51.22', text: 'ok' } },
          { id: 'noloc', fields: { status: 'Aberta', text: 'sem ponto' } },
        ],
      })
    );

    const res = createRes();
    await commentsHandler({ method: 'GET' }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.tagsList).toEqual(['Infraestrutura', 'Sinalização']);
    expect(res.body.comments).toHaveLength(1);
    expect(res.body.comments[0].fields.text).toBe('buraco');
    expect(res.body.comments[0].fields.email).toBeUndefined();
  });

  it('rejects a filled honeypot without calling Airtable', async () => {
    const res = createRes();
    await commentsHandler(
      { method: 'POST', body: { ...validComment, website: 'http://spam.test' } },
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid request' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects invalid comment payloads', async () => {
    const res = createRes();
    await commentsHandler(
      { method: 'POST', body: { ...validComment, latlong: 'not-a-coord' } },
      res
    );
    expect(res.statusCode).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('POST allowlists fields, forces status, and returns 201', async () => {
    fetch.mockResolvedValueOnce(jsonResponse(200, { records: [{ id: 'created' }] }));

    const res = createRes();
    await commentsHandler(
      {
        method: 'POST',
        body: {
          ...validComment,
          email: 'rider@example.com',
          status: 'Resolvida',
          extra: 'nope',
        },
      },
      res
    );

    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({ ok: true });
    expect(res.headers['Cache-Control']).toBe('no-store');
    expect(fetch).toHaveBeenCalledTimes(1);
    const [, options] = fetch.mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({
      records: [
        {
          fields: {
            status: 'Aberta',
            latlong: '-30.0346,-51.2177',
            location: 'Porto Alegre, RS',
            text: 'Ciclovia sem continuidade.',
            tags: ['Infraestrutura'],
            email: 'rider@example.com',
          },
        },
      ],
    });
  });

  it('returns a generic 502 when Airtable fails', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'INVALID_CREDENTIALS_DO_NOT_LEAK' } }),
    });

    const res = createRes();
    await metadataHandler({ method: 'GET' }, res);

    expect(res.statusCode).toBe(502);
    expect(res.body).toEqual({ error: 'Airtable request failed' });
    expect(JSON.stringify(res.body)).not.toContain('INVALID_CREDENTIALS');
  });

  it('returns 500 when server env is missing', async () => {
    delete process.env.AIRTABLE_API_KEY;
    const res = createRes();
    await metadataHandler({ method: 'GET' }, res);
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'Airtable is not configured' });
    expect(fetch).not.toHaveBeenCalled();
  });
});
