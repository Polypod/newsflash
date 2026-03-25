# Tiingo General News Ingestion — Design Spec

## Goal

Add Tiingo as a general news source that supplements (not replaces) NewsAPI, feeding articles through the same backend scoring and broadcast pipeline. Both sources are independently toggleable via environment variables.

## Architecture

```text
AI service scheduler (every 15 min, configurable)
  tiingo_scheduler.py
    → tiingo_ingest.py: fetch_tiingo_news(tags, limit)
    → POST /api/v1/ingest/articles (X-Internal-Key auth)

Backend ingest endpoint (new)
  → upsert news_articles (source_type='tiingo', external_id='tiingo-{id}')
  → enqueue new IDs to scoringQueue

scoringQueue (unchanged)
  → Claude Haiku scores → update DB → newsflash broadcast if score ≥ 85
```

## Tech Stack

- **AI service**: Python, APScheduler, existing `tiingo.py` HTTP client, `httpx`
- **Backend**: Node.js, Express, Bull, existing `pg` pool + `scoringQueue`
- **Config**: `ai-service/settings.yaml` (Tiingo tags + poll interval), `backend/.env` (NewsAPI toggle)

---

## Components

### 1. `ai-service/settings.yaml` — new `tiingo.general_news` section

```yaml
tiingo:
  news_limit: 10        # existing — used by financial_news_agent
  max_tickers: 10       # existing

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

### 2. `ai-service/src/config/settings.py` — typed config

Add a `_TiingoGeneralNews` property-class (matching the existing `_Tiingo`, `_Models`, `_Workflow` pattern — no `@dataclass`) with `enabled`, `poll_interval_minutes`, `limit`, `tags` properties. Add a `general_news` property to `_Tiingo` returning a `_TiingoGeneralNews()` instance.

Note: `get()` returns `{}` for missing keys, so numeric properties must include `or <default>` guards to avoid `int({})` raising `TypeError` if the YAML key is absent.

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
        return int(os.getenv("TIINGO_NEWS_POLL_INTERVAL") or get("tiingo", "general_news", "poll_interval_minutes") or 15)

    @property
    def limit(self) -> int:
        return int(get("tiingo", "general_news", "limit") or 50)

    @property
    def tags(self) -> list:
        raw = os.getenv("TIINGO_NEWS_TAGS")
        if raw:
            return [t.strip() for t in raw.split(",")]
        return get("tiingo", "general_news", "tags") or []


class _Tiingo:
    @property
    def news_limit(self) -> int: ...  # existing

    @property
    def max_tickers(self) -> int: ...  # existing

    @property
    def general_news(self) -> _TiingoGeneralNews:
        return _TiingoGeneralNews()
```

### 3. `ai-service/src/services/tiingo_ingest.py` — new service

Expose one public function `ingest(tiingo_cfg, tiingo_api_key, backend_url, internal_key) -> tuple[int, int]` — this is the synchronous function that `scheduler.py` passes to `asyncio.to_thread`.

Responsibilities:

- Call existing `fetch_tiingo_news(tickers=[], tags=tiingo_cfg.general_news.tags, limit=tiingo_cfg.general_news.limit, api_key=tiingo_api_key)`
  - Note: `tiingo.py` already truncates `description` to 500 chars — no additional truncation needed
- Skip any article where `article['id'] == ""` (tiingo.py coerces missing ids to empty string; a blank `external_id` of `"tiingo-"` would collide across all such articles)
- Transform each remaining article to backend ingest shape:

  ```python
  {
    "external_id": f"tiingo-{article['id']}",
    "title": article["title"],
    "content": article["description"],   # already truncated to 500 chars by tiingo.py
    "url": article["url"],
    "published_at": article["published_date"],
    "source": article["source"],
    "category": article["tags"][0] if article["tags"] else None,
    "author": None,
    "source_type": "tiingo",
  }
  ```

- POST to `{backend_url}/api/v1/ingest/articles` with `X-Internal-Key` header using a **synchronous** `httpx.Client` (consistent with `tiingo.py` — do not use `httpx.AsyncClient` here, as this function runs inside `asyncio.to_thread`)
- Returns `(inserted, skipped)` counts
- Error handling: any exception → log warning, return `(0, 0)`, do not crash

**Guard:** if `TIINGO_API_KEY` is not set, log error at startup and skip scheduling entirely.

### 4. `ai-service/src/scheduler.py` — new APScheduler module

`AsyncIOScheduler` runs jobs on the asyncio event loop. Because `tiingo.py` uses a synchronous `httpx.Client`, the job wrapper must delegate to a thread via `asyncio.to_thread` to avoid blocking the event loop.

The scheduler receives the `_Tiingo` instance (imported as `tiingo` from `config.settings`) — there is no `settings` aggregate object. Access is `tiingo_cfg.general_news.enabled`, not `settings.tiingo.general_news.enabled`.

```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler
import asyncio
from services.tiingo_ingest import ingest as _sync_ingest  # sync function, runs in thread

scheduler = AsyncIOScheduler()

async def run_tiingo_ingest(tiingo_cfg, tiingo_api_key, backend_url, internal_key):
    # tiingo_ingest.ingest is sync (uses httpx.Client) — run in thread pool
    inserted, skipped = await asyncio.to_thread(
        _sync_ingest, tiingo_cfg, tiingo_api_key, backend_url, internal_key
    )
    logger.info(f"Tiingo ingest: {inserted} inserted, {skipped} skipped")

async def start_scheduler(tiingo_cfg, tiingo_api_key, backend_url, internal_key):
    if tiingo_cfg.general_news.enabled and tiingo_api_key:
        scheduler.add_job(
            run_tiingo_ingest,
            "interval",
            minutes=tiingo_cfg.general_news.poll_interval_minutes,
            args=[tiingo_cfg, tiingo_api_key, backend_url, internal_key],
        )
        # Initial fetch 5s after startup so articles appear without waiting a full interval
        scheduler.add_job(
            run_tiingo_ingest,
            "date",
            run_date=datetime.now() + timedelta(seconds=5),
            args=[tiingo_cfg, tiingo_api_key, backend_url, internal_key],
        )
        scheduler.start()
```

### 5. `ai-service/src/main.py` — startup hook

Use the FastAPI `lifespan` context manager (replaces the deprecated `@app.on_event` pattern).

**Important:** `lifespan` must be defined **before** `app = FastAPI(...)`. The existing `app = FastAPI(...)` line must be updated to pass `lifespan=lifespan`. Import `tiingo as tiingo_settings` from `config.settings` — there is no `settings` aggregate.

```python
from contextlib import asynccontextmanager
from config.settings import tiingo as tiingo_settings
from scheduler import start_scheduler, scheduler

@asynccontextmanager
async def lifespan(app: FastAPI):
    tiingo_api_key = os.getenv("TIINGO_API_KEY")
    backend_url = os.getenv("BACKEND_URL", "http://localhost:3000")
    internal_key = os.getenv("INTERNAL_API_KEY")
    await start_scheduler(tiingo_settings, tiingo_api_key, backend_url, internal_key)
    yield
    if scheduler.running:  # guard: scheduler.start() is only called when conditions are met
        scheduler.shutdown()

# lifespan must be defined above before this line
app = FastAPI(title="Situational Awareness AI Service", version="1.0.0", lifespan=lifespan)
```

### 6. `backend/src/routes/v1/ingest.js` — new route

`POST /api/v1/ingest/articles`

- Auth: `X-Internal-Key` header checked against `config.internalApiKey`. If `INTERNAL_API_KEY` is not set in env, `config.internalApiKey` is `undefined` — the route handler must treat a missing/undefined server key as a misconfiguration and return 503 (not 401), to avoid accidentally authenticating all requests via `undefined === undefined`.
- Body: `{ articles: Article[] }` (max 100 per request)
- JSON body limit: `express.json({ limit: '1mb' })` applied to this router — 50 articles × ~1 KB each could exceed the default 10 KB body limit
- Logic:
  1. For each article, upsert: `INSERT INTO news_articles (...) ON CONFLICT (external_id) DO NOTHING RETURNING id`
  2. Collect returned IDs (new inserts only)
  3. Enqueue each to `scoringQueue`
  4. Return `{ inserted: N, skipped: M }`
- Errors: 401 missing/wrong key, 400 missing articles array, 500 DB error

### 7. `backend/src/routes/v1/index.js` — register route

Add to the existing index (not `app.js`):

```js
const ingestRoutes = require('./ingest');
// ...
router.use('/ingest', ingestRoutes);
```

The ingest route does not require JWT authentication — it uses `X-Internal-Key` instead.

### 8. `backend/src/jobs/queues.js` — NewsAPI toggle

Wrap **both** `headlinesQueue.add()` calls inside one guard — the cron-repeat job and the startup delay job must both be skipped:

```js
if (config.newsApiEnabled) {  // always a boolean per env.js — no need for !== false
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

### 9. `backend/src/config/env.js` — new flags

```js
internalApiKey: process.env.INTERNAL_API_KEY,
newsApiEnabled: process.env.NEWSAPI_ENABLED !== 'false',  // default true
```

### 10. `backend/src/routes/v1/news.js` — headlines filter update

Replace:

```sql
WHERE source_type = 'newsapi-top'
```

With:

```sql
WHERE source_type IN ('newsapi-top', 'tiingo')
```

---

## Data Flow Detail

```text
Tiingo article id=12345, tag="energy"
  → external_id = "tiingo-12345"
  → POST /api/v1/ingest/articles
  → INSERT ... ON CONFLICT (external_id) DO NOTHING RETURNING id
  → [new] → scoringQueue.add({ articleId: uuid })
  → Claude Haiku: score=72, reason="Energy supply disruption..."
  → UPDATE news_articles SET criticality_score=72 ...
  → score < 85 → no newsflash broadcast
  → appears on /news page under HIGH section
```

**Cache note:** `GET /api/v1/news/headlines` has a 60-second Redis cache. Newly ingested Tiingo articles may take up to 60 seconds to appear on the `/news` page after being inserted.

---

## Error Handling

| Scenario | Behaviour |
| -------- | --------- |
| Tiingo API down | Log warn, skip cycle, retry next interval |
| Backend POST fails (503/timeout) | Log warn, skip cycle — articles re-fetched next poll, deduped by external_id |
| `TIINGO_API_KEY` missing | Log error at startup, scheduler not started |
| `TIINGO_NEWS_ENABLED=false` | Scheduler not started, no fetches |
| `NEWSAPI_ENABLED=false` | headlinesQueue not scheduled |
| Duplicate article | `ON CONFLICT DO NOTHING` — silent skip |

---

## Testing

### Backend (`jest`)

- `tests/routes/ingest.test.js`:
  - `POST /ingest/articles` with valid key → 200, inserts new, skips duplicates
  - `POST /ingest/articles` with wrong key → 401
  - `POST /ingest/articles` with missing array → 400
- `tests/routes/headlines.test.js`: update `source_type` filter test to match `IN ('newsapi-top', 'tiingo')`
- `tests/jobs/queues.test.js`: verify `NEWSAPI_ENABLED=false` skips headlinesQueue scheduling

### AI service (`pytest`)

- `tests/services/test_tiingo_ingest.py`:
  - Transform produces correct `external_id`, `source_type`, content (already truncated by tiingo.py)
  - POST called with correct headers and body
  - Returns `(0, 0)` on HTTP error without raising
  - Missing `TIINGO_API_KEY` → scheduler skips, no crash

---

## Dependencies

- `apscheduler` — add to `ai-service/requirements.txt`
- No new backend npm packages required

---

## Out of Scope

- Chroma indexing (articles embedded into vector store) — separate initiative
- Financial signals / ticker analysis — Sub-project B
- UI changes to the `/news` page — existing page already handles multiple source types
- Tiingo as a source in `settings.yaml` for the financial_news_agent (Node 6) — already works independently
