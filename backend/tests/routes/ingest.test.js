const request = require('supertest');

const mockQuery = jest.fn();
jest.mock('../../src/config/database', () => ({
  getDbPool: () => ({ query: mockQuery }),
}));

jest.mock('../../src/config/redis', () => ({
  getRedisClient: () => ({ get: jest.fn(), setEx: jest.fn() }),
}));

// Mock env so config.internalApiKey is set. Do NOT use process.env mutation
// at module scope — env.js may already be cached from another test file.
jest.mock('../../src/config/env', () => ({
  internalApiKey: 'test-internal-key',
}));

const mockQueueAdd = jest.fn().mockResolvedValue({});
jest.mock('../../src/jobs/queues', () => ({
  scoringQueue: { add: mockQueueAdd },
}));

const app = require('../../src/app');

const VALID_KEY = 'test-internal-key';
const sampleArticle = {
  external_id: 'tiingo-12345',
  title: 'Oil prices surge',
  content: 'Brent crude rises sharply.',
  url: 'https://reuters.com/oil',
  published_at: '2026-03-25T10:00:00Z',
  source: 'reuters.com',
  category: 'energy',
  author: null,
  source_type: 'tiingo',
};

describe('POST /api/v1/ingest/articles', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockQueueAdd.mockReset();
    mockQueueAdd.mockResolvedValue({});
  });

  it('returns 200 with inserted/skipped counts and enqueues new articles', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'uuid-1' }] });

    const res = await request(app)
      .post('/api/v1/ingest/articles')
      .set('X-Internal-Key', VALID_KEY)
      .send({ articles: [sampleArticle] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ inserted: 1, skipped: 0 });
    expect(mockQueueAdd).toHaveBeenCalledWith(
      { articleId: 'uuid-1' },
      expect.objectContaining({ attempts: 3 }),
    );
  });

  it('counts as skipped when ON CONFLICT DO NOTHING returns no rows', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const res = await request(app)
      .post('/api/v1/ingest/articles')
      .set('X-Internal-Key', VALID_KEY)
      .send({ articles: [sampleArticle] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ inserted: 0, skipped: 1 });
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  it('returns 401 with wrong key', async () => {
    const res = await request(app)
      .post('/api/v1/ingest/articles')
      .set('X-Internal-Key', 'wrong-key')
      .send({ articles: [sampleArticle] });

    expect(res.status).toBe(401);
  });

  it('returns 401 with missing key', async () => {
    const res = await request(app)
      .post('/api/v1/ingest/articles')
      .send({ articles: [sampleArticle] });

    expect(res.status).toBe(401);
  });

  it('returns 400 when articles is not an array', async () => {
    const res = await request(app)
      .post('/api/v1/ingest/articles')
      .set('X-Internal-Key', VALID_KEY)
      .send({ not_articles: 'oops' });

    expect(res.status).toBe(400);
  });

  it('skips articles with DB errors and continues processing remaining articles', async () => {
    mockQuery
      .mockRejectedValueOnce(new Error('DB connection lost'))
      .mockResolvedValueOnce({ rows: [{ id: 'uuid-2' }] });

    const res = await request(app)
      .post('/api/v1/ingest/articles')
      .set('X-Internal-Key', VALID_KEY)
      .send({ articles: [sampleArticle, { ...sampleArticle, external_id: 'tiingo-99999' }] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ inserted: 1, skipped: 1 });
    expect(mockQueueAdd).toHaveBeenCalledTimes(1);
  });
});
