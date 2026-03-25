# Tiingo General News Ingestion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Tiingo as a general news source that polls every 15 minutes via an AI-service APScheduler job, pushes articles through the backend ingest endpoint, and surfaces them on the `/news` page alongside NewsAPI articles.

**Architecture:** The AI service's `scheduler.py` runs `tiingo_ingest.ingest()` in a thread pool (via `asyncio.to_thread`) every 15 minutes. The backend exposes `POST /api/v1/ingest/articles` (authenticated with `X-Internal-Key`) that upserts articles into `news_articles` and enqueues new IDs to `scoringQueue`. The `GET /news/headlines` SQL filter is widened from `source_type = 'newsapi-top'` to `source_type IN ('newsapi-top', 'tiingo')`.

**Tech Stack:** Python 3.12, APScheduler 3.x, httpx (sync), FastAPI lifespan; Node.js 18, Express, Bull, pg; Jest + supertest; pytest

---

## File Map

| File | Action | Responsibility |
| ---- | ------ | -------------- |
| `backend/src/config/env.js` | Modify | Add `internalApiKey`, `newsApiEnabled` flags |
| `backend/src/app.js` | Modify | Raise JSON body limit to 1 mb |
| `backend/src/routes/v1/ingest.js` | **Create** | `POST /api/v1/ingest/articles` handler |
| `backend/src/routes/v1/index.js` | Modify | Register ingest route |
| `backend/src/jobs/queues.js` | Modify | Wrap both `headlinesQueue.add()` calls in `newsApiEnabled` guard |
| `backend/src/routes/v1/news.js` | Modify | Widen `source_type` filter to include `'tiingo'` |
| `backend/tests/routes/ingest.test.js` | **Create** | Jest tests for ingest route |
| `backend/tests/jobs/queues.test.js` | **Create** | Jest test: `NEWSAPI_ENABLED=false` skips both headlines jobs |
| `backend/tests/routes/headlines.test.js` | Modify | Update `source_type` assertion to match `IN (...)` |
| `ai-service/settings.yaml` | Modify | Add `tiingo.general_news` config block |
| `ai-service/src/config/settings.py` | Modify | Add `_TiingoGeneralNews` class; add `general_news` property to `_Tiingo` |
| `ai-service/requirements.txt` | Modify | Add `apscheduler>=3.10,<4` |
| `ai-service/src/services/tiingo_ingest.py` | **Create** | Sync `ingest()` function |
| `ai-service/src/scheduler.py` | **Create** | APScheduler setup + `start_scheduler()` |
| `ai-service/src/main.py` | Modify | Replace deprecated `@app.on_event` with `lifespan` context manager |
| `ai-service/tests/test_tiingo_ingest.py` | **Create** | pytest tests for `ingest()` |

---

## Task 1: Backend config flags + body limit

**Files:**
- Modify: `backend/src/config/env.js` (after line 30: `newsApiKey`)
- Modify: `backend/src/app.js` (lines 27–28)

These changes have no isolated test — they are exercised by Tasks 2, 3, and 4.

- [ ] **Step 1: Add `internalApiKey` and `newsApiEnabled` to env.js**

  In `backend/src/config/env.js`, add to the config object after `newsApiKey`:

  ```js
  newsApiKey: process.env.NEWS_API_KEY,

  // Internal service auth
  internalApiKey: process.env.INTERNAL_API_KEY,

  // Source toggles
  newsApiEnabled: process.env.NEWSAPI_ENABLED !== 'false',  // default true
  ```

- [ ] **Step 2: Raise the Express body limit in app.js**

  The ingest route can receive up to 50 articles (~50 KB). The current 10 KB limit will reject these payloads. Note: the spec suggests a router-level body parser, but Express parses the body stream once at the app level — adding a second parser on the router would be a no-op. The correct fix is to raise the global limit. Change lines 27–28 in `backend/src/app.js`:

  ```js
  // Before:
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ limit: '10kb', extended: false }));

  // After:
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ limit: '1mb', extended: false }));
  ```

- [ ] **Step 3: Commit**

  ```bash
  cd /Users/henrik/vsc_projects/newsflash
  git add backend/src/config/env.js backend/src/app.js
  git commit -m "feat: add internalApiKey, newsApiEnabled to config; raise body limit to 1mb"
  ```

---

## Task 2: Backend ingest route (TDD)

**Files:**
- Create: `backend/tests/routes/ingest.test.js`
- Create: `backend/src/routes/v1/ingest.js`
- Modify: `backend/src/routes/v1/index.js`

- [ ] **Step 1: Write the failing test**

  Create `backend/tests/routes/ingest.test.js`:

  ```js
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
  });
  ```

- [ ] **Step 2: Run the test to confirm it fails**

  ```bash
  cd /Users/henrik/vsc_projects/newsflash/backend
  npm test -- --testPathPattern=ingest --no-coverage 2>&1 | tail -20
  ```

  Expected: FAIL — `Cannot find module '../../src/routes/v1/ingest'`

- [ ] **Step 3: Create `backend/src/routes/v1/ingest.js`**

  ```js
  const express = require('express');
  const router = express.Router();
  const { getDbPool } = require('../../config/database');
  const { scoringQueue } = require('../../jobs/queues');
  const config = require('../../config/env');
  const logger = require('../../utils/logger');

  router.post('/articles', async (req, res, next) => {
    // Guard: if INTERNAL_API_KEY is not configured, refuse all requests to
    // avoid authenticating everyone via undefined === undefined.
    if (!config.internalApiKey) {
      return res.status(503).json({ error: 'Service not configured' });
    }
    if (req.headers['x-internal-key'] !== config.internalApiKey) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { articles } = req.body;
    if (!Array.isArray(articles)) {
      return res.status(400).json({ error: 'articles array required' });
    }

    const pool = getDbPool();
    let inserted = 0;
    let skipped = 0;
    const newIds = [];

    for (const a of articles) {
      try {
        const result = await pool.query(
          `INSERT INTO news_articles
             (source, external_id, title, content, url, published_at, category, author, source_type)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (external_id) DO NOTHING
           RETURNING id`,
          [a.source, a.external_id, a.title, a.content, a.url,
           a.published_at, a.category, a.author, a.source_type],
        );
        if (result.rows.length > 0) {
          newIds.push(result.rows[0].id);
          inserted++;
        } else {
          skipped++;
        }
      } catch (err) {
        logger.error('ingest: DB error', { external_id: a.external_id, err: err.message });
        return next(err);
      }
    }

    for (const id of newIds) {
      await scoringQueue.add(
        { articleId: id },
        { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
      );
    }

    res.json({ inserted, skipped });
  });

  module.exports = router;
  ```

- [ ] **Step 4: Register the ingest route in `backend/src/routes/v1/index.js`**

  Add the require and route registration. The ingest route uses `X-Internal-Key` — do NOT put it behind `authenticate` (JWT). Add it as a public route alongside the other public routes:

  ```js
  // Add at top with other requires:
  const ingestRoutes = require('./ingest');

  // Add in the public routes block (before the protected routes):
  router.use('/ingest', ingestRoutes);
  ```

  The full updated file should look like:

  ```js
  const express = require('express');
  const router = express.Router();
  const { authenticate } = require('../../middleware/auth');

  const conflictsRoutes = require('./conflicts');
  const energyRoutes = require('./energy');
  const flightsRoutes = require('./flights');
  const analyzeRoutes = require('./analyze');
  const correlationsRoutes = require('./correlations');
  const newsRoutes = require('./news');
  const authRoutes = require('./auth');
  const ingestRoutes = require('./ingest');

  // Public routes
  router.use('/auth', authRoutes);
  router.use('/conflicts', conflictsRoutes);
  router.use('/energy', energyRoutes);
  router.use('/flights', flightsRoutes);
  router.use('/correlations', correlationsRoutes);
  router.use('/news', newsRoutes);
  router.use('/ingest', ingestRoutes);

  // Protected routes (require JWT)
  router.use('/analyze', authenticate, analyzeRoutes);

  module.exports = router;
  ```

- [ ] **Step 5: Run the tests to confirm they pass**

  ```bash
  cd /Users/henrik/vsc_projects/newsflash/backend
  npm test -- --testPathPattern=ingest --no-coverage 2>&1 | tail -30
  ```

  Expected: 5 passing tests

- [ ] **Step 6: Commit**

  ```bash
  cd /Users/henrik/vsc_projects/newsflash
  git add backend/tests/routes/ingest.test.js \
          backend/src/routes/v1/ingest.js \
          backend/src/routes/v1/index.js
  git commit -m "feat: add POST /api/v1/ingest/articles endpoint with X-Internal-Key auth"
  ```

---

## Task 3: NewsAPI queue toggle (TDD)

**Files:**
- Create: `backend/tests/jobs/queues.test.js`
- Modify: `backend/src/jobs/queues.js` (lines 460–467 in `scheduleJobs`)

- [ ] **Step 1: Write the failing test**

  Create `backend/tests/jobs/queues.test.js`:

  ```js
  // Mock Bull before any require so queues.js uses the mock constructor.
  // Each new Queue(name, ...) returns a distinct mock with its own add/process/on.
  jest.mock('bull', () => {
    return jest.fn().mockImplementation((name) => ({
      add: jest.fn().mockResolvedValue({}),
      process: jest.fn(),
      on: jest.fn(),
    }));
  });

  jest.mock('../../src/config/env', () => ({
    redisUrl: 'redis://localhost:6379',
    newsApiEnabled: false,   // ← what we're testing
  }));

  jest.mock('../../src/utils/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  }));

  const Bull = require('bull');
  const { scheduleJobs } = require('../../src/jobs/queues');

  describe('scheduleJobs with newsApiEnabled=false', () => {
    // Run scheduleJobs once; check queue instances via Bull.mock
    beforeAll(() => {
      scheduleJobs(null);
    });

    it('does not call headlinesQueue.add for either the repeat or startup job', () => {
      const idx = Bull.mock.calls.findIndex(([name]) => name === 'newsapi-headlines');
      expect(idx).toBeGreaterThanOrEqual(0);
      const headlinesInstance = Bull.mock.results[idx].value;
      expect(headlinesInstance.add).not.toHaveBeenCalled();
    });

    it('still schedules acled-conflicts', () => {
      const idx = Bull.mock.calls.findIndex(([name]) => name === 'acled-conflicts');
      const conflictsInstance = Bull.mock.results[idx].value;
      expect(conflictsInstance.add).toHaveBeenCalled();
    });
  });
  ```

- [ ] **Step 2: Run the test to confirm it fails**

  ```bash
  cd /Users/henrik/vsc_projects/newsflash/backend
  npm test -- --testPathPattern=queues --no-coverage 2>&1 | tail -20
  ```

  Expected: FAIL — headlinesQueue.add was called (guard not yet in place)

- [ ] **Step 3: Wrap both headlinesQueue.add calls in `backend/src/jobs/queues.js`**

  In `scheduleJobs()`, find the two `headlinesQueue.add(...)` calls (currently around lines 460–467) and wrap them together:

  ```js
  // Before (two separate calls):
  // NewsAPI top-headlines: every 15 min
  headlinesQueue.add({}, {
    repeat: { every: 15 * 60 * 1000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  });
  // Startup run (populate immediately)
  headlinesQueue.add({ startup: true }, { delay: 5_000 });

  // After (both inside guard):
  if (config.newsApiEnabled) {
    // NewsAPI top-headlines: every 15 min
    headlinesQueue.add({}, {
      repeat: { every: 15 * 60 * 1000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    });
    // Startup run (populate immediately)
    headlinesQueue.add({ startup: true }, { delay: 5_000 });
  }
  ```

- [ ] **Step 4: Run the test to confirm it passes**

  ```bash
  cd /Users/henrik/vsc_projects/newsflash/backend
  npm test -- --testPathPattern=queues --no-coverage 2>&1 | tail -20
  ```

  Expected: 2 passing

- [ ] **Step 5: Commit**

  ```bash
  cd /Users/henrik/vsc_projects/newsflash
  git add backend/tests/jobs/queues.test.js backend/src/jobs/queues.js
  git commit -m "feat: skip headlinesQueue scheduling when NEWSAPI_ENABLED=false"
  ```

---

## Task 4: Headlines source_type filter update

**Files:**
- Modify: `backend/src/routes/v1/news.js` (line 94)
- Modify: `backend/tests/routes/headlines.test.js`

- [ ] **Step 1: Write the failing test in `headlines.test.js`**

  Add this test inside the existing `describe('GET /api/v1/news/headlines', ...)` block in `backend/tests/routes/headlines.test.js`. The existing test at line 43 checks `sql.toMatch(/criticality_score >= 85/)` — add alongside it:

  ```js
  it('queries both newsapi-top and tiingo source types', async () => {
    mockQuery.mockResolvedValue({ rows: sampleRows });
    await request(app).get('/api/v1/news/headlines');
    const sql = mockQuery.mock.calls[0][0];
    expect(sql).toMatch(/source_type IN \('newsapi-top', 'tiingo'\)/);
  });
  ```

- [ ] **Step 2: Run the test to confirm it fails**

  ```bash
  cd /Users/henrik/vsc_projects/newsflash/backend
  npm test -- --testPathPattern=headlines --no-coverage 2>&1 | tail -20
  ```

  Expected: FAIL — SQL still has `source_type = 'newsapi-top'`

- [ ] **Step 3: Update the SQL in `news.js`**

  In `backend/src/routes/v1/news.js`, change line 94:

  ```js
  // Before:
  WHERE source_type = 'newsapi-top'

  // After:
  WHERE source_type IN ('newsapi-top', 'tiingo')
  ```

- [ ] **Step 5: Run the full backend test suite**

  ```bash
  cd /Users/henrik/vsc_projects/newsflash/backend
  npm test --no-coverage 2>&1 | tail -30
  ```

  Expected: all tests passing across all files

- [ ] **Step 5: Commit**

  ```bash
  cd /Users/henrik/vsc_projects/newsflash
  git add backend/src/routes/v1/news.js backend/tests/routes/headlines.test.js
  git commit -m "feat: widen headlines SQL filter to include tiingo source_type"
  ```

---

## Task 5: AI service config

**Files:**
- Modify: `ai-service/settings.yaml`
- Modify: `ai-service/src/config/settings.py`
- Modify: `ai-service/requirements.txt`

- [ ] **Step 1: Add `general_news` block to `ai-service/settings.yaml`**

  **Do NOT re-declare the `tiingo:` key** — YAML will silently drop the first occurrence and the existing `news_limit`/`max_tickers` keys will be lost, breaking the financial news agent. Instead, add `general_news:` **nested inside** the existing `tiingo:` block, after `max_tickers: 10`:

  The existing block ends at:

  ```yaml
  tiingo:
    # Max articles to fetch per Tiingo query
    news_limit: 10
    # Max tickers to send in a single request
    max_tickers: 10
  ```

  Add the following lines immediately after `max_tickers: 10`, keeping the same indentation level as `news_limit` and `max_tickers`:

  ```yaml
    general_news:
      enabled: true                    # override: TIINGO_NEWS_ENABLED=false
      poll_interval_minutes: 15        # override: TIINGO_NEWS_POLL_INTERVAL=N
      limit: 50                        # articles per poll
      tags:
        - geopolitics
        - conflict
        - war
        - energy
        - sanctions
        - defense
        - oil
        - natural-gas
        - government
        - politics
  ```

  The final `tiingo:` section should look like:

  ```yaml
  tiingo:
    # Max articles to fetch per Tiingo query
    news_limit: 10
    # Max tickers to send in a single request
    max_tickers: 10

    general_news:
      enabled: true                    # override: TIINGO_NEWS_ENABLED=false
      poll_interval_minutes: 15        # override: TIINGO_NEWS_POLL_INTERVAL=N
      limit: 50                        # articles per poll
      tags:
        - geopolitics
        - conflict
        - war
        - energy
        - sanctions
        - defense
        - oil
        - natural-gas
        - government
        - politics
  ```

- [ ] **Step 2: Add `_TiingoGeneralNews` to `ai-service/src/config/settings.py`**

  Add the new class BEFORE the existing `_Tiingo` class (it must be defined first since `_Tiingo` references it). Then add a `general_news` property to `_Tiingo`.

  Insert this block before `class _Tiingo:`:

  ```python
  class _TiingoGeneralNews:
      @property
      def enabled(self) -> bool:
          v = os.getenv("TIINGO_NEWS_ENABLED")
          if v is not None:
              return v.lower() not in ("false", "0", "no")
          return bool(get("tiingo", "general_news", "enabled"))

      @property
      def poll_interval_minutes(self) -> int:
          return int(
              os.getenv("TIINGO_NEWS_POLL_INTERVAL")
              or get("tiingo", "general_news", "poll_interval_minutes")
              or 15
          )

      @property
      def limit(self) -> int:
          return int(get("tiingo", "general_news", "limit") or 50)

      @property
      def tags(self) -> list:
          raw = os.getenv("TIINGO_NEWS_TAGS")
          if raw:
              return [t.strip() for t in raw.split(",")]
          return get("tiingo", "general_news", "tags") or []
  ```

  Add `general_news` property to `_Tiingo`:

  ```python
  class _Tiingo:
      @property
      def news_limit(self) -> int:
          return int(os.getenv("TIINGO_NEWS_LIMIT") or get("tiingo", "news_limit"))

      @property
      def max_tickers(self) -> int:
          return int(os.getenv("TIINGO_MAX_TICKERS") or get("tiingo", "max_tickers"))

      @property
      def general_news(self) -> _TiingoGeneralNews:
          return _TiingoGeneralNews()
  ```

- [ ] **Step 3: Add `apscheduler` to `ai-service/requirements.txt`**

  ```
  apscheduler>=3.10,<4
  ```

- [ ] **Step 4: Install the new dependency**

  ```bash
  cd /Users/henrik/vsc_projects/newsflash/ai-service
  pip install apscheduler>=3.10,<4
  ```

- [ ] **Step 5: Smoke-test the settings load**

  ```bash
  cd /Users/henrik/vsc_projects/newsflash/ai-service
  python -c "
  import sys; sys.path.insert(0, 'src')
  from config.settings import tiingo
  print('enabled:', tiingo.general_news.enabled)
  print('interval:', tiingo.general_news.poll_interval_minutes)
  print('limit:', tiingo.general_news.limit)
  print('tags:', tiingo.general_news.tags[:3])
  "
  ```

  Expected output (no errors):
  ```
  enabled: True
  interval: 15
  limit: 50
  tags: ['geopolitics', 'conflict', 'war']
  ```

- [ ] **Step 6: Commit**

  ```bash
  cd /Users/henrik/vsc_projects/newsflash
  git add ai-service/settings.yaml \
          ai-service/src/config/settings.py \
          ai-service/requirements.txt
  git commit -m "feat: add tiingo.general_news config block and _TiingoGeneralNews settings class"
  ```

---

## Task 6: `tiingo_ingest.py` — sync ingest function (TDD)

**Files:**
- Create: `ai-service/tests/test_tiingo_ingest.py`
- Create: `ai-service/src/services/tiingo_ingest.py`

The test pattern mirrors `tests/test_tiingo_client.py` — patch `httpx.Client` and `fetch_tiingo_news`. The conftest adds `ai-service/src/` to `sys.path`, so imports work as `from services.tiingo_ingest import ingest`.

- [ ] **Step 1: Write the failing tests**

  Create `ai-service/tests/test_tiingo_ingest.py`:

  ```python
  from unittest.mock import MagicMock, patch


  def _make_tiingo_cfg(tags=None, limit=50):
      cfg = MagicMock()
      cfg.general_news.tags = tags or ["energy", "geopolitics"]
      cfg.general_news.limit = limit
      return cfg


  SAMPLE_ARTICLES = [
      {
          "id": "12345",
          "title": "Oil price surge",
          "description": "Brent crude rises sharply.",
          "url": "https://reuters.com/oil",
          "published_date": "2026-03-25T10:00:00+00:00",
          "source": "reuters.com",
          "tickers": [],
          "tags": ["energy", "oil"],
      }
  ]


  def test_ingest_returns_inserted_skipped_counts():
      """Happy path: one new article → (1, 0) returned."""
      from services.tiingo_ingest import ingest

      mock_resp = MagicMock()
      mock_resp.json.return_value = {"inserted": 1, "skipped": 0}

      with patch("services.tiingo_ingest.fetch_tiingo_news", return_value=SAMPLE_ARTICLES):
          with patch("httpx.Client") as MockClient:
              MockClient.return_value.__enter__.return_value.post.return_value = mock_resp
              result = ingest(_make_tiingo_cfg(), "api-key", "http://backend:3000", "internal-key")

      assert result == (1, 0)


  def test_ingest_transforms_article_to_correct_shape():
      """POST body has correct external_id, source_type, and author=None."""
      from services.tiingo_ingest import ingest

      mock_resp = MagicMock()
      mock_resp.json.return_value = {"inserted": 1, "skipped": 0}
      mock_post = MagicMock(return_value=mock_resp)

      with patch("services.tiingo_ingest.fetch_tiingo_news", return_value=SAMPLE_ARTICLES):
          with patch("httpx.Client") as MockClient:
              MockClient.return_value.__enter__.return_value.post = mock_post
              ingest(_make_tiingo_cfg(), "api-key", "http://backend:3000", "secret")

      call_args = mock_post.call_args
      article = call_args.kwargs["json"]["articles"][0]
      assert article["external_id"] == "tiingo-12345"
      assert article["source_type"] == "tiingo"
      assert article["author"] is None
      assert article["category"] == "energy"   # first tag
      assert article["content"] == "Brent crude rises sharply."


  def test_ingest_posts_with_correct_url_and_header():
      """POST goes to /api/v1/ingest/articles with X-Internal-Key header."""
      from services.tiingo_ingest import ingest

      mock_resp = MagicMock()
      mock_resp.json.return_value = {"inserted": 1, "skipped": 0}
      mock_post = MagicMock(return_value=mock_resp)

      with patch("services.tiingo_ingest.fetch_tiingo_news", return_value=SAMPLE_ARTICLES):
          with patch("httpx.Client") as MockClient:
              MockClient.return_value.__enter__.return_value.post = mock_post
              ingest(_make_tiingo_cfg(), "api-key", "http://backend:3000", "my-secret")

      url = mock_post.call_args.args[0]
      headers = mock_post.call_args.kwargs["headers"]
      assert url == "http://backend:3000/api/v1/ingest/articles"
      assert headers["X-Internal-Key"] == "my-secret"


  def test_ingest_skips_articles_with_empty_id():
      """Articles with id='' produce external_id 'tiingo-' — must be skipped."""
      from services.tiingo_ingest import ingest

      bad_articles = [{**SAMPLE_ARTICLES[0], "id": ""}]

      with patch("services.tiingo_ingest.fetch_tiingo_news", return_value=bad_articles):
          result = ingest(_make_tiingo_cfg(), "api-key", "http://backend:3000", "key")

      assert result == (0, 0)   # no POST made, no error raised


  def test_ingest_returns_zero_zero_on_http_error():
      """Any exception (network, 4xx, 5xx) → (0, 0), no crash."""
      from services.tiingo_ingest import ingest

      with patch("services.tiingo_ingest.fetch_tiingo_news", return_value=SAMPLE_ARTICLES):
          with patch("httpx.Client") as MockClient:
              MockClient.return_value.__enter__.return_value.post.side_effect = Exception("timeout")
              result = ingest(_make_tiingo_cfg(), "api-key", "http://backend:3000", "key")

      assert result == (0, 0)


  def test_ingest_returns_zero_zero_when_no_articles():
      """fetch_tiingo_news returns [] → no POST, (0, 0)."""
      from services.tiingo_ingest import ingest

      with patch("services.tiingo_ingest.fetch_tiingo_news", return_value=[]):
          with patch("httpx.Client") as MockClient:
              result = ingest(_make_tiingo_cfg(), "api-key", "http://backend:3000", "key")
              MockClient.return_value.__enter__.return_value.post.assert_not_called()

      assert result == (0, 0)
  ```

- [ ] **Step 2: Run the tests to confirm they fail**

  ```bash
  cd /Users/henrik/vsc_projects/newsflash/ai-service
  python -m pytest tests/test_tiingo_ingest.py -v 2>&1 | tail -20
  ```

  Expected: FAIL — `ModuleNotFoundError: No module named 'services.tiingo_ingest'`

- [ ] **Step 3: Implement `ai-service/src/services/tiingo_ingest.py`**

  ```python
  """Sync ingest function: fetch Tiingo general news and push to backend.

  This module is designed to run inside asyncio.to_thread(), so it uses
  synchronous httpx.Client — do NOT use httpx.AsyncClient here.
  """
  import logging

  import httpx

  from services.tiingo import fetch_tiingo_news

  logger = logging.getLogger(__name__)


  def ingest(tiingo_cfg, tiingo_api_key: str, backend_url: str, internal_key: str) -> tuple:
      """Fetch Tiingo general news and POST to the backend ingest endpoint.

      Returns (inserted, skipped). Never raises — returns (0, 0) on any error.
      tiingo_cfg is the _Tiingo settings instance (has .general_news.tags, .limit).
      Uses synchronous httpx.Client — safe to call from asyncio.to_thread().
      """
      try:
          articles_raw = fetch_tiingo_news(
              tickers=[],
              tags=tiingo_cfg.general_news.tags,
              limit=tiingo_cfg.general_news.limit,
              api_key=tiingo_api_key,
          )

          articles = []
          for article in articles_raw:
              # tiingo.py coerces missing ids to ""; "tiingo-" would collide for all such articles
              if not article["id"]:
                  continue
              articles.append({
                  "external_id": f"tiingo-{article['id']}",
                  "title": article["title"],
                  "content": article["description"],   # already truncated to 500 chars by tiingo.py
                  "url": article["url"],
                  "published_at": article["published_date"],
                  "source": article["source"],
                  "category": article["tags"][0] if article["tags"] else None,
                  "author": None,
                  "source_type": "tiingo",
              })

          if not articles:
              return (0, 0)

          with httpx.Client(timeout=15.0) as client:
              resp = client.post(
                  f"{backend_url}/api/v1/ingest/articles",
                  json={"articles": articles},
                  headers={"X-Internal-Key": internal_key},
              )
              resp.raise_for_status()
              data = resp.json()

          return (data.get("inserted", 0), data.get("skipped", 0))

      except Exception as exc:
          logger.warning("Tiingo ingest failed: %s", exc)
          return (0, 0)
  ```

- [ ] **Step 4: Run the tests to confirm they pass**

  ```bash
  cd /Users/henrik/vsc_projects/newsflash/ai-service
  python -m pytest tests/test_tiingo_ingest.py -v 2>&1 | tail -20
  ```

  Expected: 6 tests passing

- [ ] **Step 5: Run the full AI service test suite to check for regressions**

  ```bash
  cd /Users/henrik/vsc_projects/newsflash/ai-service
  python -m pytest tests/ -v 2>&1 | tail -30
  ```

  Expected: all tests passing

- [ ] **Step 6: Commit**

  ```bash
  cd /Users/henrik/vsc_projects/newsflash
  git add ai-service/tests/test_tiingo_ingest.py \
          ai-service/src/services/tiingo_ingest.py
  git commit -m "feat: add tiingo_ingest.ingest() with full test coverage"
  ```

---

## Task 7: `scheduler.py` — APScheduler module

**Files:**
- Create: `ai-service/src/scheduler.py`

The scheduler is glue code around APScheduler and is difficult to meaningfully unit-test (it uses asyncio event loop integration). It is integration-tested implicitly when the AI service starts. Write it and verify it imports cleanly.

- [ ] **Step 1: Create `ai-service/src/scheduler.py`**

  ```python
  """APScheduler setup for Tiingo general news ingestion.

  start_scheduler() is called from main.py's lifespan context manager.
  run_tiingo_ingest() wraps the synchronous tiingo_ingest.ingest() via
  asyncio.to_thread so it does not block the FastAPI event loop.
  """
  import asyncio
  import logging
  from datetime import datetime, timedelta

  from apscheduler.schedulers.asyncio import AsyncIOScheduler

  from services.tiingo_ingest import ingest as _sync_ingest

  logger = logging.getLogger(__name__)
  scheduler = AsyncIOScheduler()


  async def run_tiingo_ingest(tiingo_cfg, tiingo_api_key: str, backend_url: str, internal_key: str):
      """Async wrapper: delegates sync ingest() to a thread pool."""
      inserted, skipped = await asyncio.to_thread(
          _sync_ingest, tiingo_cfg, tiingo_api_key, backend_url, internal_key
      )
      logger.info("Tiingo ingest complete: %d inserted, %d skipped", inserted, skipped)


  async def start_scheduler(tiingo_cfg, tiingo_api_key: str, backend_url: str, internal_key: str):
      """Start the APScheduler if Tiingo is enabled and API key is present.

      Adds two jobs:
      - Interval job: fires every poll_interval_minutes (default 15)
      - Date job: fires 5 seconds after startup so articles appear immediately
      """
      if not tiingo_cfg.general_news.enabled:
          logger.info("Tiingo general news disabled (TIINGO_NEWS_ENABLED=false) — scheduler not started")
          return
      if not tiingo_api_key:
          logger.error("TIINGO_API_KEY not set — Tiingo scheduler not started")
          return

      interval = tiingo_cfg.general_news.poll_interval_minutes
      args = [tiingo_cfg, tiingo_api_key, backend_url, internal_key]

      scheduler.add_job(
          run_tiingo_ingest,
          "interval",
          minutes=interval,
          args=args,
          id="tiingo_interval",
      )
      # Initial fetch shortly after startup — no need to wait a full interval
      scheduler.add_job(
          run_tiingo_ingest,
          "date",
          run_date=datetime.now() + timedelta(seconds=5),
          args=args,
          id="tiingo_startup",
      )
      scheduler.start()
      logger.info("Tiingo scheduler started (interval=%d min)", interval)
  ```

- [ ] **Step 2: Verify the module imports cleanly**

  ```bash
  cd /Users/henrik/vsc_projects/newsflash/ai-service
  python -c "import sys; sys.path.insert(0, 'src'); import scheduler; print('scheduler imported OK')"
  ```

  Expected: `scheduler imported OK` (no errors)

- [ ] **Step 3: Commit**

  ```bash
  cd /Users/henrik/vsc_projects/newsflash
  git add ai-service/src/scheduler.py
  git commit -m "feat: add APScheduler module for Tiingo general news polling"
  ```

---

## Task 8: `main.py` — lifespan context manager

**Files:**
- Modify: `ai-service/src/main.py`

Replace the deprecated `@app.on_event` pattern with FastAPI's `lifespan` context manager. The `lifespan` function MUST be defined before `app = FastAPI(...)`.

- [ ] **Step 1: Update `ai-service/src/main.py`**

  The complete updated file:

  ```python
  import os
  from contextlib import asynccontextmanager

  from dotenv import load_dotenv
  from fastapi import Depends, FastAPI, HTTPException
  from fastapi.middleware.cors import CORSMiddleware
  from pydantic import BaseModel
  from typing import List, Optional

  from config.api_key import require_internal_key
  from config.settings import tiingo as tiingo_settings
  from scheduler import scheduler, start_scheduler

  load_dotenv()


  @asynccontextmanager
  async def lifespan(app: FastAPI):
      """Start Tiingo scheduler on startup; shut it down on shutdown."""
      tiingo_api_key = os.getenv("TIINGO_API_KEY")
      backend_url = os.getenv("BACKEND_URL", "http://localhost:3000")
      internal_key = os.getenv("INTERNAL_API_KEY")
      await start_scheduler(tiingo_settings, tiingo_api_key, backend_url, internal_key)
      yield
      if scheduler.running:   # guard: only shut down if scheduler.start() was called
          scheduler.shutdown()


  # lifespan must be defined above before this line
  app = FastAPI(title="Situational Awareness AI Service", version="1.0.0", lifespan=lifespan)

  # CORS: explicit origin, no wildcard when credentials are used
  _frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
  app.add_middleware(
      CORSMiddleware,
      allow_origins=[_frontend_url],
      allow_credentials=True,
      allow_methods=["*"],
      allow_headers=["*"],
  )


  class AnalysisRequest(BaseModel):
      query: str
      include_infrastructure: bool = True
      threat_level_threshold: str = "medium"


  class AnalysisResponse(BaseModel):
      timestamp: str
      threat_level: str
      total_articles: int
      geopolitical_events: List[dict]
      ucdp_events: List[dict] = []
      ucdp_conflicts: List[dict] = []
      infrastructure_at_risk: List[dict]
      cast_forecasts: List[dict] = []
      financial_signals: List[dict] = []
      recommendations: List[str]
      execution_time_ms: int
      token_usage: int
      cost_usd: float


  @app.get("/health")
  async def health_check():
      return {"status": "ok", "service": "ai-service"}


  @app.post("/analyze/situation", response_model=AnalysisResponse)
  async def analyze_situation(
      request: AnalysisRequest,
      _: None = Depends(require_internal_key),
  ):
      """Analyze a situation using LangGraph workflow (internal endpoint — requires X-Internal-Key)."""
      try:
          from workflows.situational_awareness import analyze_situation as run_analysis
          result = await run_analysis(request.query)
          return AnalysisResponse(
              timestamp=result.get("timestamp", ""),
              threat_level=result.get("threat_level", "unknown"),
              total_articles=result.get("total_articles", 0),
              geopolitical_events=result.get("geopolitical_events", []),
              ucdp_events=result.get("ucdp_events", []),
              ucdp_conflicts=result.get("ucdp_conflicts", []),
              infrastructure_at_risk=result.get("infrastructure_at_risk", []),
              cast_forecasts=result.get("cast_forecasts", []),
              financial_signals=result.get("financial_signals", []),
              recommendations=result.get("recommendations", []),
              execution_time_ms=result.get("execution_time_ms", 0),
              token_usage=result.get("token_usage", 0),
              cost_usd=result.get("cost_usd", 0.0),
          )
      except Exception as e:
          raise HTTPException(status_code=500, detail=str(e))


  if __name__ == "__main__":
      import uvicorn
      uvicorn.run(app, host="0.0.0.0", port=8000)
  ```

- [ ] **Step 2: Verify the health check works (requires no external services)**

  ```bash
  cd /Users/henrik/vsc_projects/newsflash/ai-service
  python -m pytest tests/ -v 2>&1 | tail -30
  ```

  Expected: all tests pass (no regressions from main.py change)

- [ ] **Step 3: Commit**

  ```bash
  cd /Users/henrik/vsc_projects/newsflash
  git add ai-service/src/main.py
  git commit -m "feat: replace deprecated @app.on_event with FastAPI lifespan; wire Tiingo scheduler"
  ```

---

## Done

At this point all components are implemented and tested. To verify end-to-end with a real `TIINGO_API_KEY`:

1. Set `TIINGO_API_KEY=<real-key>` in `ai-service/.env`
2. Start the stack: `docker-compose up postgres redis` + backend + AI service
3. Watch AI service logs for `Tiingo ingest complete: N inserted, M skipped` within 5 seconds of startup
4. Check `GET /api/v1/news/headlines` — articles with `source_type='tiingo'` should appear within 60 seconds (Redis cache TTL)
