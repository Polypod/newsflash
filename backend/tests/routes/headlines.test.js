const request = require('supertest');
const app = require('../../src/app');

// Mock DB pool
const mockQuery = jest.fn();
jest.mock('../../src/config/database', () => ({
  getDbPool: () => ({ query: mockQuery }),
}));

// Mock Redis
const mockGet = jest.fn().mockResolvedValue(null);
const mockSetEx = jest.fn().mockResolvedValue('OK');
jest.mock('../../src/config/redis', () => ({
  getRedisClient: () => ({ get: mockGet, setEx: mockSetEx }),
}));

const sampleRows = [
  { id: 1, source: 'Reuters', title: 'NATO summit', content: 'desc', url: 'http://a.com',
    published_at: new Date('2026-03-24T10:00:00Z'), criticality_score: 92,
    criticality_reason: 'Active military conflict', source_type: 'newsapi-top' },
  { id: 2, source: 'BBC', title: 'Sudan fighting', content: 'desc', url: 'http://b.com',
    published_at: new Date('2026-03-24T09:00:00Z'), criticality_score: null,
    criticality_reason: null, source_type: 'newsapi-top' },
];

describe('GET /api/v1/news/headlines', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockGet.mockResolvedValue(null); // cache miss
  });

  it('returns 200 with articles array', async () => {
    mockQuery.mockResolvedValue({ rows: sampleRows });
    const res = await request(app).get('/api/v1/news/headlines');
    expect(res.status).toBe(200);
    expect(res.body.articles).toHaveLength(2);
  });

  it('?level=critical filters to score >= 85', async () => {
    mockQuery.mockResolvedValue({ rows: [sampleRows[0]] });
    const res = await request(app).get('/api/v1/news/headlines?level=critical');
    expect(res.status).toBe(200);
    const sql = mockQuery.mock.calls[0][0];
    expect(sql).toMatch(/criticality_score >= 85/);
  });

  it('?level=all includes unscored (NULL) articles', async () => {
    mockQuery.mockResolvedValue({ rows: sampleRows });
    const res = await request(app).get('/api/v1/news/headlines?level=all');
    const sql = mockQuery.mock.calls[0][0];
    expect(sql).toMatch(/criticality_score >= 40 OR criticality_score IS NULL/);
  });

  it('returns 200 with empty array when no rows', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const res = await request(app).get('/api/v1/news/headlines');
    expect(res.status).toBe(200);
    expect(res.body.articles).toEqual([]);
  });
});
