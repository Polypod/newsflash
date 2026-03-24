# NewsAPI Headlines + Newsflash Alerts — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add NewsAPI top-headlines polling with AI criticality scoring, WebSocket newsflash alerts, and a dedicated /news intel-feed page.

**Architecture:** A new `newsapi-headlines` Bull queue fetches headlines every 15 min and stores them in `news_articles`. A `news-scoring` queue processes each new article with Claude Haiku to produce a 0–100 criticality score; scores ≥ 85 trigger a WebSocket `newsflash` event. The frontend shows all headlines on `/news` (grouped by criticality) and renders toast notifications anywhere in the app.

**Tech Stack:** Node.js/Express (backend), Bull/Redis (queues), @anthropic-ai/sdk (Haiku scoring), Socket.io (real-time), React 18/Vitest (frontend), Jest/supertest (backend tests)

---

## File Map

**Create:**
- `backend/src/services/newsApiHeadlinesService.js` — fetches /v2/top-headlines, 3 category calls, dedup
- `backend/src/services/scoringService.js` — Haiku tool-use scoring, returns `{ score, reason }`
- `backend/tests/services/newsApiHeadlinesService.test.js`
- `backend/tests/services/scoringService.test.js`
- `backend/tests/routes/headlines.test.js`
- `frontend/src/context/NewsflashContext.jsx` — WS subscription + toast state, shared via context
- `frontend/src/components/News/NewsflashToast.jsx` — fixed toast renderer
- `frontend/src/pages/News.jsx` — intel feed page
- `frontend/src/components/News/NewsflashToast.test.jsx`
- `frontend/src/context/NewsflashContext.test.jsx`
- `frontend/src/pages/News.test.jsx`

**Modify:**
- `backend/src/config/env.js` — add `newsApiKey`
- `backend/.env.example` — add `NEWS_API_KEY`
- `backend/src/jobs/queues.js` — add 2 queues, update `scheduleJobs(socketHandler)`
- `backend/src/server.js` — pass `socketHandler` to `scheduleJobs`
- `backend/src/routes/v1/news.js` — add `GET /headlines`
- `backend/src/websocket/socketHandler.js` — add `broadcastNewsflash`
- `frontend/src/App.jsx` — add `/news` route, `<NewsflashProvider>`, `<NewsflashToast />`
- `frontend/src/components/Layout/Header.jsx` — add News nav link + badge

---

## Task 1: Env key + DB migration

**Files:**
- Modify: `backend/src/config/env.js`
- Modify: `backend/.env.example`
- Run: migration SQL directly in psql (or via npm script if one exists)

- [ ] **Step 1: Add `newsApiKey` to env.js**

  In `backend/src/config/env.js`, add after `aviationstackApiKey`:

  ```js
  newsApiKey: process.env.NEWS_API_KEY,
  ```

- [ ] **Step 2: Add to .env.example**

  In `backend/.env.example`, add:

  ```
  NEWS_API_KEY=your_newsapi_org_key_here
  ```

  Also add your actual key to `backend/.env` (not committed).

- [ ] **Step 3: Run DB migration**

  ```bash
  docker-compose up -d postgres  # ensure postgres is running
  docker-compose exec postgres psql -U appuser -d conflicts_db -c "
    ALTER TABLE news_articles
      ADD COLUMN IF NOT EXISTS criticality_score  INTEGER     DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS criticality_reason TEXT        DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS source_type        VARCHAR(50) DEFAULT 'rss';
    CREATE INDEX IF NOT EXISTS idx_news_articles_headlines
      ON news_articles (source_type, published_at DESC);
  "
  ```

  Expected output: `ALTER TABLE` then `CREATE INDEX`

- [ ] **Step 4: Commit**

  ```bash
  git add backend/src/config/env.js backend/.env.example
  git commit -m "feat: add NEWS_API_KEY config + news_articles criticality columns"
  ```

---

## Task 2: NewsAPI headlines service

**Files:**
- Create: `backend/src/services/newsApiHeadlinesService.js`
- Create: `backend/tests/services/newsApiHeadlinesService.test.js`

- [ ] **Step 1: Write the failing test**

  Create `backend/tests/services/newsApiHeadlinesService.test.js`:

  ```js
  const axios = require('axios');
  jest.mock('axios');

  // Must set before require so env.js picks it up
  process.env.NEWS_API_KEY = 'test-key';
  const newsApiHeadlinesService = require('../../src/services/newsApiHeadlinesService');

  const makeArticle = (url, title) => ({
    source: { name: 'Reuters' },
    title,
    description: 'A description',
    url,
    publishedAt: '2026-03-24T10:00:00Z',
    author: 'John Doe',
  });

  describe('newsApiHeadlinesService.fetchTopHeadlines', () => {
    beforeEach(() => {
      axios.get.mockReset();
    });

    it('makes three category requests and merges results', async () => {
      axios.get.mockResolvedValue({ data: { articles: [makeArticle('http://a.com', 'A')] } });
      const results = await newsApiHeadlinesService.fetchTopHeadlines();
      expect(axios.get).toHaveBeenCalledTimes(3);
      expect(results.length).toBe(3); // one per category (no overlap)
    });

    it('deduplicates articles with the same URL', async () => {
      const duplicate = makeArticle('http://same.com', 'Same');
      axios.get.mockResolvedValue({ data: { articles: [duplicate] } });
      const results = await newsApiHeadlinesService.fetchTopHeadlines();
      expect(results.length).toBe(1); // deduplicated from 3 calls
    });

    it('maps articles to the standard shape', async () => {
      axios.get.mockResolvedValue({ data: { articles: [makeArticle('http://b.com', 'B')] } });
      const [article] = await newsApiHeadlinesService.fetchTopHeadlines();
      expect(article).toMatchObject({
        source: 'Reuters',
        external_id: 'http://b.com',
        title: 'B',
        content: 'A description',
        url: 'http://b.com',
        category: expect.stringMatching(/general|business|technology/),
        author: 'John Doe',
      });
      expect(article.published_at).toBeInstanceOf(Date);
    });

    it('returns empty array if NewsAPI returns non-200', async () => {
      axios.get.mockRejectedValue(new Error('Network Error'));
      const results = await newsApiHeadlinesService.fetchTopHeadlines();
      expect(results).toEqual([]);
    });
  });
  ```

- [ ] **Step 2: Run test — verify it fails**

  ```bash
  cd backend && npx jest tests/services/newsApiHeadlinesService.test.js --no-coverage
  ```

  Expected: `Cannot find module '../../src/services/newsApiHeadlinesService'`

- [ ] **Step 3: Implement the service**

  Create `backend/src/services/newsApiHeadlinesService.js`:

  ```js
  const axios = require('axios');
  const logger = require('../utils/logger');
  const config = require('../config/env');

  const CATEGORIES = ['general', 'business', 'technology'];

  async function fetchTopHeadlines() {
    if (!config.newsApiKey) {
      logger.warn('NEWS_API_KEY not set — skipping top-headlines fetch');
      return [];
    }

    const allArticles = [];

    for (const category of CATEGORIES) {
      try {
        const response = await axios.get('https://newsapi.org/v2/top-headlines', {
          params: {
            category,
            language: 'en',
            pageSize: 100,
            apiKey: config.newsApiKey,
          },
        });
        const articles = response.data?.articles || [];
        for (const a of articles) {
          allArticles.push({
            source: a.source?.name || 'NewsAPI',
            external_id: a.url || `newsapi_${Date.now()}`,
            title: a.title || 'No Title',
            content: a.description || a.content || '',
            url: a.url || '',
            published_at: a.publishedAt ? new Date(a.publishedAt) : new Date(),
            category,
            author: a.author || 'Unknown',
          });
        }
      } catch (err) {
        logger.warn(`NewsAPI top-headlines fetch failed for category ${category}: ${err.message}`);
      }
    }

    // Deduplicate by URL
    const seen = new Set();
    return allArticles.filter((a) => {
      if (seen.has(a.url)) return false;
      seen.add(a.url);
      return true;
    });
  }

  module.exports = { fetchTopHeadlines };
  ```

- [ ] **Step 4: Run test — verify it passes**

  ```bash
  cd backend && npx jest tests/services/newsApiHeadlinesService.test.js --no-coverage
  ```

  Expected: all 4 tests PASS

- [ ] **Step 5: Commit**

  ```bash
  git add backend/src/services/newsApiHeadlinesService.js backend/tests/services/newsApiHeadlinesService.test.js
  git commit -m "feat: add NewsAPI top-headlines service (3 category fetch + dedup)"
  ```

---

## Task 3: Scoring service

**Files:**
- Create: `backend/src/services/scoringService.js`
- Create: `backend/tests/services/scoringService.test.js`
- Run: `npm install @anthropic-ai/sdk` in backend

- [ ] **Step 1: Install SDK**

  ```bash
  cd backend && npm install @anthropic-ai/sdk
  ```

- [ ] **Step 2: Write the failing test**

  Create `backend/tests/services/scoringService.test.js`:

  ```js
  // Mock the SDK before requiring the service
  const mockCreate = jest.fn();
  jest.mock('@anthropic-ai/sdk', () => {
    return jest.fn().mockImplementation(() => ({
      messages: { create: mockCreate },
    }));
  });

  process.env.ANTHROPIC_API_KEY = 'test-key';
  const { scoreHeadline } = require('../../src/services/scoringService');

  describe('scoreHeadline', () => {
    it('returns score and reason from tool use response', async () => {
      mockCreate.mockResolvedValue({
        content: [{
          type: 'tool_use',
          name: 'score_headline',
          input: { score: 87, reason: 'Active military conflict with state actors' },
        }],
      });

      const result = await scoreHeadline('NATO calls emergency summit', 'Amid escalating tensions...');
      expect(result).toEqual({ score: 87, reason: 'Active military conflict with state actors' });
    });

    it('returns fallback score 50 if no tool_use block in response', async () => {
      mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'oops' }] });
      const result = await scoreHeadline('Weather forecast', '');
      expect(result).toEqual({ score: 50, reason: 'Scoring unavailable' });
    });

    it('returns fallback if SDK throws', async () => {
      mockCreate.mockRejectedValue(new Error('API error'));
      const result = await scoreHeadline('Title', 'Desc');
      expect(result).toEqual({ score: null, reason: null });
    });
  });
  ```

- [ ] **Step 3: Run test — verify it fails**

  ```bash
  cd backend && npx jest tests/services/scoringService.test.js --no-coverage
  ```

  Expected: `Cannot find module '../../src/services/scoringService'`

- [ ] **Step 4: Implement the service**

  Create `backend/src/services/scoringService.js`:

  ```js
  const Anthropic = require('@anthropic-ai/sdk');
  const logger = require('../utils/logger');

  const SCORE_TOOL = {
    name: 'score_headline',
    description: 'Score a news headline for geopolitical and security criticality.',
    input_schema: {
      type: 'object',
      properties: {
        score: {
          type: 'integer',
          minimum: 0,
          maximum: 100,
          description: 'Criticality score 0-100. 0=irrelevant, 100=immediate global crisis.',
        },
        reason: {
          type: 'string',
          description: 'One plain-English sentence explaining the score.',
        },
      },
      required: ['score', 'reason'],
    },
  };

  const PROMPT = (title, description) =>
    `Rate this news headline for geopolitical and security criticality (0–100).

Consider: direct military conflict or escalation, state actor involvement,
infrastructure or energy sector impact, humanitarian crisis, geopolitical alliance shifts.

Title: ${title}
Description: ${description || '(none)'}`;

  async function scoreHeadline(title, description) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      logger.warn('ANTHROPIC_API_KEY not set — skipping headline scoring');
      return { score: null, reason: null };
    }

    try {
      const client = new Anthropic({ apiKey });
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 150,
        tools: [SCORE_TOOL],
        tool_choice: { type: 'tool', name: 'score_headline' },
        messages: [{ role: 'user', content: PROMPT(title, description) }],
      });

      const toolUse = response.content.find((b) => b.type === 'tool_use' && b.name === 'score_headline');
      if (!toolUse) {
        logger.warn('scoreHeadline: no tool_use block in response');
        return { score: 50, reason: 'Scoring unavailable' };
      }

      return { score: toolUse.input.score, reason: toolUse.input.reason };
    } catch (err) {
      logger.error(`scoreHeadline failed: ${err.message}`);
      return { score: null, reason: null };
    }
  }

  module.exports = { scoreHeadline };
  ```

- [ ] **Step 5: Run test — verify it passes**

  ```bash
  cd backend && npx jest tests/services/scoringService.test.js --no-coverage
  ```

  Expected: all 3 tests PASS

- [ ] **Step 6: Commit**

  ```bash
  git add backend/src/services/scoringService.js backend/tests/services/scoringService.test.js backend/package.json backend/package-lock.json
  git commit -m "feat: add Claude Haiku criticality scoring service"
  ```

---

## Task 4: WebSocket broadcastNewsflash

**Files:**
- Modify: `backend/src/websocket/socketHandler.js`

- [ ] **Step 1: Add `broadcastNewsflash` to SocketHandler**

  In `backend/src/websocket/socketHandler.js`, add after `broadcastFlightUpdate`:

  ```js
  broadcastNewsflash(article) {
    this.io.to('news').emit('newsflash', {
      id: article.id,
      title: article.title,
      source: article.source,
      url: article.url,
      criticality_score: article.criticality_score,
      criticality_reason: article.criticality_reason,
      published_at: article.published_at,
      timestamp: new Date().toISOString(),
    });
  }
  ```

- [ ] **Step 2: Verify existing tests still pass**

  ```bash
  cd backend && npx jest tests/websocket/ --no-coverage
  ```

  Expected: PASS (no regressions)

- [ ] **Step 3: Commit**

  ```bash
  git add backend/src/websocket/socketHandler.js
  git commit -m "feat: add broadcastNewsflash to SocketHandler"
  ```

---

## Task 5: Bull queues (newsapi-headlines + news-scoring)

**Files:**
- Modify: `backend/src/jobs/queues.js`
- Modify: `backend/src/server.js`

- [ ] **Step 1: Add queues and update `scheduleJobs` signature in queues.js**

  In `backend/src/jobs/queues.js`:

  **a) Add queue declarations** after the existing queue declarations (after `analysisQueue`):

  ```js
  const headlinesQueue = new Queue('newsapi-headlines', redisConfig);
  const scoringQueue   = new Queue('news-scoring', redisConfig);
  ```

  **b) Wire up event handlers** — add at the bottom of the `setupQueueEvents` calls block:

  ```js
  setupQueueEvents(headlinesQueue, 'newsapi-headlines');
  setupQueueEvents(scoringQueue, 'news-scoring');
  ```

  **c) Add the headlines job processor** — after the `newsQueue.process(...)` block:

  ```js
  headlinesQueue.process(async (job) => {
    const { fetchTopHeadlines } = require('../services/newsApiHeadlinesService');
    const { getDbPool } = require('../config/database');

    logger.info('Processing newsapi-headlines job');
    const articles = await fetchTopHeadlines();
    if (!articles.length) {
      logger.warn('newsapi-headlines: no articles returned');
      return { processed: 0, timestamp: new Date().toISOString() };
    }

    const pool = getDbPool();
    let inserted = 0;
    const newIds = [];

    for (const a of articles) {
      const result = await pool.query(
        `INSERT INTO news_articles
           (source, external_id, title, content, url, published_at, category, author, source_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'newsapi-top')
         ON CONFLICT (external_id) DO NOTHING
         RETURNING id`,
        [a.source, a.external_id, a.title, a.content, a.url,
         a.published_at, a.category, a.author]
      );
      if (result.rows.length > 0) {
        newIds.push(result.rows[0].id);
        inserted++;
      }
    }

    // Enqueue each new article for scoring
    for (const id of newIds) {
      await scoringQueue.add({ articleId: id }, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } });
    }

    logger.info(`newsapi-headlines: ${inserted} new articles inserted, ${newIds.length} queued for scoring`);
    return { processed: inserted, timestamp: new Date().toISOString() };
  });
  ```

  **d) Add the scoring job processor** — after the headlinesQueue processor, using a closure over `socketHandler`:

  ```js
  // Populated by scheduleJobs(socketHandler) — see below
  let _socketHandler = null;

  scoringQueue.process(async (job) => {
    const { articleId } = job.data;
    const { scoreHeadline } = require('../services/scoringService');
    const { getDbPool } = require('../config/database');
    const { getRedisClient } = require('../config/redis');

    const pool = getDbPool();
    const row = await pool.query(
      'SELECT id, title, content, source, url, published_at FROM news_articles WHERE id = $1',
      [articleId]
    );
    if (!row.rows.length) return { skipped: true };

    const article = row.rows[0];
    const { score, reason } = await scoreHeadline(article.title, article.content);

    await pool.query(
      'UPDATE news_articles SET criticality_score = $1, criticality_reason = $2 WHERE id = $3',
      [score, reason, articleId]
    );

    // Invalidate headlines cache
    try {
      const redis = getRedisClient();
      const keys = await redis.keys('news:headlines:*');
      if (keys.length) await redis.del(keys);
    } catch (e) {
      logger.warn('Redis cache invalidation failed (non-fatal):', e.message);
    }

    // Broadcast if critical
    if (score !== null && score >= 85 && _socketHandler) {
      _socketHandler.broadcastNewsflash({
        id: article.id,
        title: article.title,
        source: article.source,
        url: row.rows[0].url,
        criticality_score: score,
        criticality_reason: reason,
        published_at: row.rows[0].published_at,
      });
    }

    logger.info(`news-scoring: article ${articleId} scored ${score}`);
    return { articleId, score, timestamp: new Date().toISOString() };
  });
  ```

  **e) Update `scheduleJobs` signature** — change the function declaration from:

  ```js
  const scheduleJobs = () => {
  ```

  to:

  ```js
  const scheduleJobs = (socketHandler) => {
    _socketHandler = socketHandler;
  ```

  **f) Add schedule entries for the new queues** — inside `scheduleJobs`, after the news ingestion schedule:

  ```js
  // NewsAPI top-headlines: every 15 min
  headlinesQueue.add({}, {
    repeat: { every: 15 * 60 * 1000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  });
  // Startup run (populate immediately)
  headlinesQueue.add({ startup: true }, { delay: 5_000 });
  ```

  **g) Add to exports** — update `module.exports`:

  ```js
  module.exports = {
    conflictQueue,
    castQueue,
    ucdpQueue,
    energyQueue,
    flightQueue,
    newsQueue,
    analysisQueue,
    headlinesQueue,
    scoringQueue,
    scheduleJobs,
    getQueueStats
  };
  ```

  **h) Add to `getQueueStats`** — add inside the `queues` array:

  ```js
  { name: 'headlines', queue: headlinesQueue },
  { name: 'scoring', queue: scoringQueue },
  ```

- [ ] **Step 2: Update server.js to pass socketHandler**

  In `backend/src/server.js`, change:

  ```js
  scheduleJobs();
  ```

  to:

  ```js
  scheduleJobs(socketHandler);
  ```

- [ ] **Step 3: Smoke-test startup**

  ```bash
  cd backend && npm run dev
  ```

  Watch logs for:
  - `Background job queues started` — no errors
  - After ~5s: `Processing newsapi-headlines job` (if `NEWS_API_KEY` is set)

  Stop with Ctrl+C.

- [ ] **Step 4: Commit**

  ```bash
  git add backend/src/jobs/queues.js backend/src/server.js
  git commit -m "feat: add newsapi-headlines and news-scoring Bull queues"
  ```

---

## Task 6: GET /headlines endpoint

**Files:**
- Modify: `backend/src/routes/v1/news.js`
- Create: `backend/tests/routes/headlines.test.js`

- [ ] **Step 1: Write the failing test**

  Create `backend/tests/routes/headlines.test.js`:

  ```js
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
  ```

- [ ] **Step 2: Run test — verify it fails**

  ```bash
  cd backend && npx jest tests/routes/headlines.test.js --no-coverage
  ```

  Expected: 404 or failing assertions (route doesn't exist yet)

- [ ] **Step 3: Add the endpoint to news.js**

  In `backend/src/routes/v1/news.js`, add before `module.exports`:

  ```js
  const LEVEL_FILTERS = {
    critical: 'na.criticality_score >= 85',
    high:     'na.criticality_score BETWEEN 65 AND 84',
    medium:   'na.criticality_score BETWEEN 40 AND 64',
    all:      '(na.criticality_score >= 40 OR na.criticality_score IS NULL)',
  };

  // GET /api/v1/news/headlines
  router.get('/headlines', async (req, res, next) => {
    try {
      const { level = 'all', limit = 50 } = req.query;
      const redisClient = getRedisClient();
      const pool = getDbPool();

      const cacheKey = `news:headlines:${level}`;
      const cached = await redisClient.get(cacheKey);
      if (cached) return res.json(JSON.parse(cached));

      const scoreFilter = LEVEL_FILTERS[level] || LEVEL_FILTERS.all;
      const query = `
        SELECT id, source, title, content, url, published_at,
               criticality_score, criticality_reason, source_type
        FROM news_articles na
        WHERE source_type = 'newsapi-top'
          AND ${scoreFilter}
        ORDER BY COALESCE(criticality_score, 0) DESC, published_at DESC
        LIMIT $1
      `;
      const result = await pool.query(query, [parseInt(limit, 10)]);
      const response = { articles: result.rows };

      await redisClient.setEx(cacheKey, 60, JSON.stringify(response));
      res.json(response);
    } catch (error) {
      logger.error('Error fetching headlines:', error);
      next(error);
    }
  });
  ```

- [ ] **Step 4: Run test — verify it passes**

  ```bash
  cd backend && npx jest tests/routes/headlines.test.js --no-coverage
  ```

  Expected: all 4 tests PASS

- [ ] **Step 5: Run full backend test suite**

  ```bash
  cd backend && npx jest --no-coverage
  ```

  Expected: all tests PASS

- [ ] **Step 6: Commit**

  ```bash
  git add backend/src/routes/v1/news.js backend/tests/routes/headlines.test.js
  git commit -m "feat: add GET /api/v1/news/headlines with level filter + Redis cache"
  ```

---

## Task 7: NewsflashContext (frontend)

**Files:**
- Create: `frontend/src/context/NewsflashContext.jsx`
- Create: `frontend/src/context/NewsflashContext.test.jsx`

- [ ] **Step 1: Write the failing test**

  Create `frontend/src/context/NewsflashContext.test.jsx`:

  ```jsx
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import { render, act } from '@testing-library/react';
  import { useContext } from 'react';
  import { NewsflashContext, NewsflashProvider } from './NewsflashContext';

  // Mock wsService
  const mockSubscribe = vi.fn();
  const mockOn = vi.fn();
  const mockOff = vi.fn();
  const mockConnect = vi.fn().mockResolvedValue();
  vi.mock('../services/wsService', () => ({
    default: { connect: mockConnect, subscribe: mockSubscribe, on: mockOn, off: mockOff,
                isConnected: true },
  }));

  function TestConsumer({ onRender }) {
    const ctx = useContext(NewsflashContext);
    onRender(ctx);
    return null;
  }

  describe('NewsflashProvider', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('subscribes to news channel on mount', () => {
      render(<NewsflashProvider><div /></NewsflashProvider>);
      expect(mockSubscribe).toHaveBeenCalledWith('news');
    });

    it('exposes empty toasts initially', () => {
      let ctx;
      render(
        <NewsflashProvider>
          <TestConsumer onRender={(c) => { ctx = c; }} />
        </NewsflashProvider>
      );
      expect(ctx.toasts).toEqual([]);
    });

    it('adds a toast when newsflash event fires', () => {
      let newsflashHandler;
      mockOn.mockImplementation((event, cb) => { if (event === 'newsflash') newsflashHandler = cb; });

      let ctx;
      render(
        <NewsflashProvider>
          <TestConsumer onRender={(c) => { ctx = c; }} />
        </NewsflashProvider>
      );

      const payload = { id: 1, title: 'NATO summit', criticality_score: 92, source: 'Reuters', url: 'http://a.com' };
      act(() => newsflashHandler(payload));
      expect(ctx.toasts).toHaveLength(1);
      expect(ctx.toasts[0]).toMatchObject({ title: 'NATO summit' });
    });

    it('caps toasts at 3, dropping oldest', () => {
      let newsflashHandler;
      mockOn.mockImplementation((event, cb) => { if (event === 'newsflash') newsflashHandler = cb; });

      let ctx;
      render(
        <NewsflashProvider>
          <TestConsumer onRender={(c) => { ctx = c; }} />
        </NewsflashProvider>
      );

      act(() => {
        [1, 2, 3, 4].forEach((id) =>
          newsflashHandler({ id, title: `Title ${id}`, criticality_score: 90, source: 'S', url: 'http://x.com' })
        );
      });
      expect(ctx.toasts).toHaveLength(3);
      expect(ctx.toasts[0].id).toBe(4); // newest first
    });
  });
  ```

- [ ] **Step 2: Run test — verify it fails**

  ```bash
  cd frontend && npx vitest run src/context/NewsflashContext.test.jsx
  ```

  Expected: `Cannot find module './NewsflashContext'`

- [ ] **Step 3: Implement NewsflashContext**

  Create `frontend/src/context/NewsflashContext.jsx`:

  ```jsx
  import { createContext, useState, useEffect, useCallback } from 'react';
  import wsService from '../services/wsService';

  export const NewsflashContext = createContext({ toasts: [], dismiss: () => {} });

  export function NewsflashProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const dismiss = useCallback((_toastId) => {
      setToasts((prev) => prev.filter((t) => t._toastId !== _toastId));
    }, []);

    useEffect(() => {
      const wsUrl = import.meta.env.VITE_WS_URL || 'http://localhost:3000';
      const token = localStorage.getItem('auth_token');
      wsService.connect(wsUrl, { auth: { token } }).catch(() => {});
      wsService.subscribe('news');

      const handleNewsflash = (payload) => {
        const toastId = Date.now();
        setToasts((prev) => {
          const next = [{ ...payload, _toastId: toastId }, ...prev];
          return next.slice(0, 3); // keep newest 3
        });
      };

      wsService.on('newsflash', handleNewsflash);
      return () => {
        wsService.off('newsflash', handleNewsflash);
      };
    }, []);

    return (
      <NewsflashContext.Provider value={{ toasts, dismiss }}>
        {children}
      </NewsflashContext.Provider>
    );
  }
  ```

- [ ] **Step 4: Run test — verify it passes**

  ```bash
  cd frontend && npx vitest run src/context/NewsflashContext.test.jsx
  ```

  Expected: all tests PASS

- [ ] **Step 5: Commit**

  ```bash
  git add frontend/src/context/NewsflashContext.jsx frontend/src/context/NewsflashContext.test.jsx
  git commit -m "feat: add NewsflashContext with WebSocket subscription and toast state"
  ```

---

## Task 8: NewsflashToast component

**Files:**
- Create: `frontend/src/components/News/NewsflashToast.jsx`
- Create: `frontend/src/components/News/NewsflashToast.test.jsx`

- [ ] **Step 1: Write the failing test**

  Create `frontend/src/components/News/NewsflashToast.test.jsx`:

  ```jsx
  import { describe, it, expect, vi } from 'vitest';
  import { render, screen, act } from '@testing-library/react';
  import userEvent from '@testing-library/user-event';
  import { NewsflashContext } from '../../context/NewsflashContext';
  import NewsflashToast from './NewsflashToast';

  const toast = { _toastId: 1, id: 1, title: 'NATO summit', criticality_score: 92,
                   source: 'Reuters', url: 'http://a.com' };

  function withContext(toasts, dismiss = vi.fn()) {
    return (
      <NewsflashContext.Provider value={{ toasts, dismiss }}>
        <NewsflashToast />
      </NewsflashContext.Provider>
    );
  }

  describe('NewsflashToast', () => {
    it('renders nothing when toasts is empty', () => {
      const { container } = render(withContext([]));
      expect(container.firstChild).toBeNull();
    });

    it('renders toast title', () => {
      render(withContext([toast]));
      expect(screen.getByText('NATO summit')).toBeTruthy();
    });

    it('calls dismiss when close button is clicked', async () => {
      const dismiss = vi.fn();
      render(withContext([toast], dismiss));
      await userEvent.click(screen.getByRole('button', { name: /close/i }));
      expect(dismiss).toHaveBeenCalledWith(1);
    });

    it('shows score badge', () => {
      render(withContext([toast]));
      expect(screen.getByText('92')).toBeTruthy();
    });
  });
  ```

- [ ] **Step 2: Run test — verify it fails**

  ```bash
  cd frontend && npx vitest run src/components/News/NewsflashToast.test.jsx
  ```

  Expected: `Cannot find module './NewsflashToast'`

- [ ] **Step 3: Implement NewsflashToast**

  Create `frontend/src/components/News/NewsflashToast.jsx`:

  ```jsx
  import { useContext, useEffect } from 'react';
  import { Link } from 'react-router-dom';
  import { NewsflashContext } from '../../context/NewsflashContext';

  const AUTO_DISMISS_MS = 8000;

  function Toast({ toast, onDismiss }) {
    useEffect(() => {
      const timer = setTimeout(() => onDismiss(toast._toastId), AUTO_DISMISS_MS);
      return () => clearTimeout(timer);
    }, [toast._toastId, onDismiss]);

    return (
      <div className="flex items-start gap-3 bg-gray-900 text-white rounded-lg shadow-xl p-4 w-80 border-l-4 border-red-500">
        <span className="text-xl flex-shrink-0">⚡</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-red-400 uppercase tracking-wide">Newsflash</span>
            <span className="text-xs bg-red-500 text-white rounded px-1 font-mono">
              {toast.criticality_score}
            </span>
          </div>
          <p className="text-sm font-medium leading-snug line-clamp-2">{toast.title}</p>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-400">{toast.source}</span>
            <Link to="/news" className="text-xs text-blue-400 hover:text-blue-300">→ News</Link>
          </div>
        </div>
        <button
          onClick={() => onDismiss(toast._toastId)}
          aria-label="close"
          className="text-gray-400 hover:text-white flex-shrink-0 text-lg leading-none"
        >
          ×
        </button>
      </div>
    );
  }

  export default function NewsflashToast() {
    const { toasts, dismiss } = useContext(NewsflashContext);
    if (!toasts.length) return null;

    return (
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-3">
        {toasts.map((t) => (
          <Toast key={t._toastId} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    );
  }
  ```

- [ ] **Step 4: Run test — verify it passes**

  ```bash
  cd frontend && npx vitest run src/components/News/NewsflashToast.test.jsx
  ```

  Expected: all 4 tests PASS

- [ ] **Step 5: Commit**

  ```bash
  git add frontend/src/components/News/NewsflashToast.jsx frontend/src/components/News/NewsflashToast.test.jsx
  git commit -m "feat: add NewsflashToast component with auto-dismiss and close button"
  ```

---

## Task 9: /news page

**Files:**
- Create: `frontend/src/pages/News.jsx`
- Create: `frontend/src/pages/News.test.jsx`

- [ ] **Step 1: Write the failing test**

  Create `frontend/src/pages/News.test.jsx`:

  ```jsx
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import { render, screen, waitFor } from '@testing-library/react';
  import { MemoryRouter } from 'react-router-dom';
  import News from './News';

  global.fetch = vi.fn();

  const mockArticles = [
    { id: 1, title: 'NATO summit', source: 'Reuters', published_at: new Date().toISOString(),
      criticality_score: 92, criticality_reason: 'Active conflict', url: 'http://a.com' },
    { id: 2, title: 'Weather update', source: 'BBC', published_at: new Date().toISOString(),
      criticality_score: null, criticality_reason: null, url: 'http://b.com' },
  ];

  describe('News page', () => {
    beforeEach(() => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ articles: mockArticles }),
      });
    });

    it('renders page heading', async () => {
      render(<MemoryRouter><News /></MemoryRouter>);
      expect(screen.getByText(/live headlines/i)).toBeTruthy();
    });

    it('renders article titles after fetch', async () => {
      render(<MemoryRouter><News /></MemoryRouter>);
      await waitFor(() => {
        expect(screen.getByText('NATO summit')).toBeTruthy();
      });
    });

    it('shows CRITICAL section for high-scored articles', async () => {
      render(<MemoryRouter><News /></MemoryRouter>);
      await waitFor(() => {
        expect(screen.getByText(/critical/i)).toBeTruthy();
      });
    });

    it('shows Scoring… for unscored articles', async () => {
      render(<MemoryRouter><News /></MemoryRouter>);
      await waitFor(() => {
        expect(screen.getByText(/scoring/i)).toBeTruthy();
      });
    });
  });
  ```

- [ ] **Step 2: Run test — verify it fails**

  ```bash
  cd frontend && npx vitest run src/pages/News.test.jsx
  ```

  Expected: `Cannot find module './News'`

- [ ] **Step 3: Implement News page**

  Create `frontend/src/pages/News.jsx`:

  ```jsx
  import { useState, useEffect, useCallback } from 'react';
  import DashboardContainer from '../components/Layout/DashboardContainer';

  const LEVELS = [
    { key: 'all',      label: 'All' },
    { key: 'critical', label: 'Critical', color: 'bg-red-100 text-red-800' },
    { key: 'high',     label: 'High',     color: 'bg-orange-100 text-orange-800' },
    { key: 'medium',   label: 'Medium',   color: 'bg-gray-100 text-gray-700' },
  ];

  const SECTION_THRESHOLDS = { CRITICAL: 85, HIGH: 65, MEDIUM: 40 };

  function getCriticalityLabel(score) {
    if (score === null || score === undefined) return null;
    if (score >= 85) return { label: 'CRITICAL', cls: 'bg-red-500 text-white' };
    if (score >= 65) return { label: 'HIGH',     cls: 'bg-orange-500 text-white' };
    if (score >= 40) return { label: 'MEDIUM',   cls: 'bg-gray-500 text-white' };
    return null;
  }

  function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  }

  function HeadlineItem({ article }) {
    const badge = getCriticalityLabel(article.criticality_score);
    return (
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block p-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 leading-snug">{article.title}</p>
            {article.criticality_reason && (
              <p className="text-xs text-gray-500 mt-1 line-clamp-1">{article.criticality_reason}</p>
            )}
            {!article.criticality_reason && article.criticality_score === null && (
              <p className="text-xs text-gray-400 mt-1 italic">Scoring…</p>
            )}
            <p className="text-xs text-gray-400 mt-1">{article.source} · {timeAgo(article.published_at)}</p>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            {badge && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${badge.cls}`}>{badge.label}</span>
            )}
            {article.criticality_score !== null && (
              <span className="text-xs text-gray-400 font-mono">{article.criticality_score}/100</span>
            )}
          </div>
        </div>
      </a>
    );
  }

  export default function News() {
    const [articles, setArticles] = useState([]);
    const [level, setLevel]       = useState('all');
    const [search, setSearch]     = useState('');
    const [lastUpdated, setLastUpdated] = useState(null);
    const [isLoading, setIsLoading]     = useState(false);

    const fetchHeadlines = useCallback(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/v1/news/headlines?level=${level}&limit=50`);
        if (!res.ok) throw new Error('Fetch failed');
        const data = await res.json();
        setArticles(data.articles || []);
        setLastUpdated(new Date());
      } catch (e) {
        console.error('Failed to fetch headlines:', e);
      } finally {
        setIsLoading(false);
      }
    }, [level]);

    useEffect(() => {
      fetchHeadlines();
      const id = setInterval(fetchHeadlines, 60_000);
      return () => clearInterval(id);
    }, [fetchHeadlines]);

    const filtered = search
      ? articles.filter((a) => a.title.toLowerCase().includes(search.toLowerCase()))
      : articles;

    const sections = [
      { key: 'critical', label: 'CRITICAL', min: 85, cls: 'border-red-500 bg-red-50' },
      { key: 'high',     label: 'HIGH',     min: 65, max: 84, cls: 'border-orange-400 bg-orange-50' },
      { key: 'medium',   label: 'MEDIUM',   min: 40, max: 64, cls: 'border-gray-300 bg-gray-50' },
    ];

    const inSection = (a, s) => {
      if (a.criticality_score === null) return false;
      if (s.max !== undefined) return a.criticality_score >= s.min && a.criticality_score <= s.max;
      return a.criticality_score >= s.min;
    };

    const unscored = filtered.filter((a) => a.criticality_score === null);

    return (
      <DashboardContainer>
        <div className="space-y-6 max-w-3xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Live Headlines</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {lastUpdated ? `Last updated ${timeAgo(lastUpdated)}` : 'Loading…'}
              </p>
            </div>
            <button
              onClick={fetchHeadlines}
              disabled={isLoading}
              className="text-sm px-3 py-1.5 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
            >
              {isLoading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>

          {/* Filter bar */}
          <div className="flex items-center gap-2 flex-wrap">
            {LEVELS.map((l) => (
              <button
                key={l.key}
                onClick={() => setLevel(l.key)}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                  level === l.key
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {l.label}
              </button>
            ))}
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search headlines…"
              className="ml-auto text-sm border border-gray-300 rounded-md px-3 py-1 w-48 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Sections */}
          {sections.map((s) => {
            const items = filtered.filter((a) => inSection(a, s));
            if (!items.length) return null;
            return (
              <div key={s.key}>
                <div className={`text-xs font-bold tracking-widest text-gray-500 mb-2 uppercase`}>
                  {s.label}
                </div>
                <div className="space-y-2">
                  {items.map((a) => <HeadlineItem key={a.id} article={a} />)}
                </div>
              </div>
            );
          })}

          {/* Unscored */}
          {unscored.length > 0 && (
            <div>
              <div className="text-xs font-bold tracking-widest text-gray-400 mb-2 uppercase">Pending</div>
              <div className="space-y-2">
                {unscored.map((a) => <HeadlineItem key={a.id} article={a} />)}
              </div>
            </div>
          )}

          {!isLoading && !filtered.length && (
            <p className="text-sm text-gray-400 text-center py-12">No headlines found.</p>
          )}
        </div>
      </DashboardContainer>
    );
  }
  ```

- [ ] **Step 4: Run test — verify it passes**

  ```bash
  cd frontend && npx vitest run src/pages/News.test.jsx
  ```

  Expected: all 4 tests PASS

- [ ] **Step 5: Commit**

  ```bash
  git add frontend/src/pages/News.jsx frontend/src/pages/News.test.jsx
  git commit -m "feat: add /news intel-feed page with criticality sections"
  ```

---

## Task 10: Wire up App.jsx and Header

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/Layout/Header.jsx`

- [ ] **Step 1: Update App.jsx**

  In `frontend/src/App.jsx`:

  **a) Add imports** at the top alongside existing lazy imports:

  ```jsx
  import { NewsflashProvider } from './context/NewsflashContext';
  import NewsflashToast from './components/News/NewsflashToast';
  const News = lazy(() => import('./pages/News'));
  ```

  **b) Wrap the app with `<NewsflashProvider>`** — change the return in `App()` so that `<NewsflashProvider>` wraps everything outside `<Router>`:

  ```jsx
  return (
    <ErrorBoundary>
      <NewsflashProvider>
        <DataProvider>
          <FilterProvider>
            <Router>
              <Suspense fallback={<LoadingSpinner />}>
                <NewsflashToast />
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/conflicts" element={<Conflicts />} />
                  <Route path="/energy" element={<Energy />} />
                  <Route path="/flights" element={<Flights />} />
                  <Route path="/analysis" element={<Analysis />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/news" element={<News />} />
                </Routes>
              </Suspense>
            </Router>
          </FilterProvider>
        </DataProvider>
      </NewsflashProvider>
    </ErrorBoundary>
  );
  ```

- [ ] **Step 2: Update Header.jsx — read the file first**

  ```bash
  cat frontend/src/components/Layout/Header.jsx
  ```

  Note the existing nav links pattern (look for the list of `<Link>` or `<a>` elements).

- [ ] **Step 3: Add News nav link + badge to Header**

  Add to the navigation links in `Header.jsx`:

  ```jsx
  // At the top of Header.jsx, add imports:
  import { useContext } from 'react';
  import { Link } from 'react-router-dom';
  import { NewsflashContext } from '../../context/NewsflashContext';

  // Inside the component, add:
  const { toasts } = useContext(NewsflashContext);

  // In the nav links JSX, add a News entry:
  <Link
    to="/news"
    className="relative text-sm font-medium text-gray-700 hover:text-gray-900"
  >
    News
    {toasts.length > 0 && (
      <span className="absolute -top-1 -right-2 h-2 w-2 rounded-full bg-red-500" />
    )}
  </Link>
  ```

  Adapt the className to match the existing nav link style in the file.

- [ ] **Step 4: Verify the app starts without errors**

  ```bash
  cd frontend && npm run dev
  ```

  Open http://localhost:5173 — check:
  - "News" appears in the nav bar
  - Navigating to http://localhost:5173/news loads the intel feed page
  - No console errors

- [ ] **Step 5: Run full frontend test suite**

  ```bash
  cd frontend && npx vitest run
  ```

  Expected: all tests PASS

- [ ] **Step 6: Commit**

  ```bash
  git add frontend/src/App.jsx frontend/src/components/Layout/Header.jsx
  git commit -m "feat: wire /news route, NewsflashProvider, and nav badge"
  ```

---

## Task 11: End-to-end smoke test

- [ ] **Step 1: Start the full stack**

  ```bash
  docker-compose up -d postgres redis
  cd backend && npm run dev &
  cd frontend && npm run dev &
  ```

- [ ] **Step 2: Verify headlines endpoint**

  ```bash
  # Get a JWT token first
  TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"password"}' | jq -r .token)

  curl -s "http://localhost:3000/api/v1/news/headlines?level=all" \
    -H "Authorization: Bearer $TOKEN" | jq '.articles | length'
  ```

  After the first 5s startup run completes (watch backend logs for `newsapi-headlines` job), this should return > 0.

- [ ] **Step 3: Verify scoring runs**

  Watch backend logs for:
  ```
  news-scoring: article X scored Y
  ```

- [ ] **Step 4: Check /news page renders headlines**

  Open http://localhost:5173/news — should show the intel feed with criticality sections.

- [ ] **Step 5: Final commit**

  ```bash
  git add -A
  git status  # confirm no secrets or unintended files
  git commit -m "feat: complete NewsAPI headlines + newsflash alerts feature"
  ```
