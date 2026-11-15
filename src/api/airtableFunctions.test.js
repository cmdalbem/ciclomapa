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
    jest.useRealTimers();
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

  it('GET comments filters at Airtable and strips leftover private fields', async () => {
    const recent = new Date().toISOString();
    const old = new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000).toISOString();
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
              createdAt: recent,
            },
          },
          {
            id: 'stale',
            fields: {
              status: 'Aberta',
              latlong: '-30.04,-51.22',
              text: 'comentario antigo',
              createdAt: old,
            },
          },
          {
            id: 'invalid',
            fields: {
              status: 'Inválida',
              latlong: '-30.05,-51.23',
              text: 'lixo',
              createdAt: recent,
            },
          },
        ],
      })
    );

    const res = createRes();
    await commentsHandler({ method: 'GET', url: '/api/airtable/comments' }, res);

    expect(res.statusCode).toBe(200);
    expect(res.headers['Cache-Control']).toContain('s-maxage=300');
    expect(res.body.tagsList).toEqual(['Infraestrutura', 'Sinalização']);
    expect(res.body.comments).toHaveLength(1);
    expect(res.body.comments[0].fields.text).toBe('buraco');
    expect(res.body.comments[0].fields.email).toBeUndefined();

    const requestUrl = String(fetch.mock.calls[0][0]);
    expect(requestUrl).toContain('pageSize=100');
    expect(requestUrl).toContain('filterByFormula=');
    expect(decodeURIComponent(requestUrl)).toContain("{status}='Aberta'");
    expect(decodeURIComponent(requestUrl)).toContain('IS_AFTER({createdAt}');
    expect(decodeURIComponent(requestUrl)).toContain('{id}=44');
    expect(requestUrl).toContain('fields');
  });

  it('GET comments keeps a Nov 20 2024 comment under the 24-month calendar cutoff', async () => {
    // Fixed clock: under the old 720-day ms window this comment would be dropped,
    // but DATEADD(TODAY(), -24, 'months') from 2026-11-15 keeps it.
    jest.useFakeTimers({ advanceTimers: true });
    jest.setSystemTime(new Date('2026-11-15T12:00:00.000Z'));

    fetch.mockResolvedValueOnce(
      jsonResponse(200, {
        records: [
          { id: 'tags', fields: { id: 44, tags: ['Infraestrutura'] } },
          {
            id: 'near-cutoff',
            fields: {
              status: 'Aberta',
              latlong: '-30.03,-51.21',
              text: 'ainda dentro da janela de 24 meses',
              createdAt: '2024-11-20T00:00:00.000Z',
            },
          },
        ],
      })
    );

    const res = createRes();
    await commentsHandler({ method: 'GET', url: '/api/airtable/comments' }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.comments).toHaveLength(1);
    expect(res.body.comments[0].fields.text).toBe('ainda dentro da janela de 24 meses');

    jest.useRealTimers();
  });

  it('GET comments?fresh=1 bypasses the shared CDN cache', async () => {
    fetch.mockResolvedValueOnce(
      jsonResponse(200, {
        records: [{ id: 'tags', fields: { id: 44, tags: ['Infraestrutura'] } }],
      })
    );

    const res = createRes();
    await commentsHandler({ method: 'GET', url: '/api/airtable/comments?fresh=1' }, res);

    expect(res.statusCode).toBe(200);
    expect(res.headers['Cache-Control']).toBe('no-store');
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

  it('rejects comment text shorter than the minimum length', async () => {
    const res = createRes();
    await commentsHandler({ method: 'POST', body: { ...validComment, text: 'a' } }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid request' });
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
