# NewsAPI Top Headlines + Newsflash Alerts — Design Spec

**Date:** 2026-03-24
**Status:** Approved

## Overview

Add NewsAPI `/v2/top-headlines` as a live news source, scoring each headline for geopolitical criticality with Claude Haiku. Critical headlines trigger real-time toast notifications across the app via WebSocket. All headlines are visible on a dedicated `/news` page with an intel-feed layout grouped by criticality level.

## Goals

- Surface breaking geopolitical/security news within ~15 minutes of publication
- AI-score each headline (0–100) so analysts can triage at a glance
- Push critical newsflashes to users without requiring them to navigate to the news page
- Keep the main dashboard uncluttered (no new sidebar panel)

## Data Flow

```text
NewsAPI /v2/top-headlines (every 15 min)
  → newsapi-headlines Bull queue
    → upsert into news_articles (source_type='newsapi-top')
    → enqueue each new article ID → news-scoring Bull queue
      → Claude Haiku: criticality score 0–100 + one-line reason
      → update news_articles (criticality_score, criticality_reason)
      → score ≥ 85 → socketHandler.broadcastNewsflash()
        → Socket.io emits 'newsflash' event to 'news' room
          → NewsflashToast renders in frontend (all pages)

GET /api/v1/news/headlines (polled every 60s by /news page)
  → scored + unscored headlines grouped by criticality level
```

## Backend

### New Files

**`backend/src/services/newsApiHeadlinesService.js`**

- Calls `GET https://newsapi.org/v2/top-headlines` — three separate requests (one per category, since the API accepts only a single `category` per request): `general`, `business`, `technology`
- Common parameters: `language=en`, `pageSize=100`
- Merges and deduplicates results by URL before returning
- Maps response to the standard article shape: `{ source, external_id, title, content, url, published_at, category, author }`
- Uses `config.newsApiKey` from `backend/src/config/env.js` (see Environment section)

**`backend/src/services/scoringService.js`**

- Imports `@anthropic-ai/sdk` (new npm dependency on the backend)
- Model: `claude-haiku-4-5-20251001`
- Prompt: given headline title + description, rate geopolitical/security criticality 0–100 and return a one-line plain-English reason
- Returns `{ score: number, reason: string }`
- Uses tool use for structured output to avoid JSON parse failures

### Modified Files

**`backend/src/jobs/queues.js`**

- Add `newsapi-headlines` queue (Bull): runs every 15 min; fetches top headlines via `newsApiHeadlinesService`, upserts new articles into `news_articles`, enqueues each new article ID to `news-scoring`
- Add `news-scoring` queue (Bull): processes individual article IDs; calls `scoringService`; updates `criticality_score` + `criticality_reason`; if score ≥ 85 calls `socketHandler.broadcastNewsflash()`; after each score write deletes all `news:headlines:*` Redis keys so the next poll returns fresh data immediately
- **`scheduleJobs` signature changes to `scheduleJobs(socketHandler)`** — `server.js` already constructs `SocketHandler` before calling `scheduleJobs`, so passing the instance is straightforward. The `news-scoring` processor captures it in a closure.
- Startup run for `newsapi-headlines` after 5s delay (populates table immediately on boot); `news-scoring` has no independent startup job — it is purely reactive to `newsapi-headlines`
- Both new queues added to `module.exports` and to `getQueueStats()` alongside existing queues

**`backend/src/routes/v1/news.js`**

- Add `GET /headlines`: queries `news_articles WHERE source_type='newsapi-top'`, ordered by `COALESCE(criticality_score, 0) DESC, published_at DESC`
- Unscored articles (`criticality_score IS NULL`) are included in `?level=all` and shown at the bottom without a score badge
- LOW-scored articles (0–39) are excluded from all levels including `all` — they are not surfaced in the feed
- Level filter SQL: `critical` → `criticality_score >= 85`; `high` → `criticality_score BETWEEN 65 AND 84`; `medium` → `criticality_score BETWEEN 40 AND 64`; `all` → `(criticality_score >= 40 OR criticality_score IS NULL)`
- Query params: `?level=critical|high|medium|all` (default: `all`), `?limit=50`
- Redis cache: 60s TTL keyed by `news:headlines:{level}`

**`backend/src/websocket/socketHandler.js`**

- Add `broadcastNewsflash(article)` method: `this.io.to('news').emit('newsflash', payload)`
- Payload: `{ id, title, source, url, criticality_score, criticality_reason, published_at, timestamp }`
- Event name `'newsflash'` must match exactly what `useNewsflash.js` listens for

### Database

Two new columns and one tracking column on `news_articles`:

```sql
ALTER TABLE news_articles
  ADD COLUMN IF NOT EXISTS criticality_score   INTEGER     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS criticality_reason  TEXT        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS source_type         VARCHAR(50) DEFAULT 'rss';
```

Index for the headlines feed query:

```sql
CREATE INDEX IF NOT EXISTS idx_news_articles_headlines
  ON news_articles (source_type, published_at DESC);
```

### Environment

**New key** — add to `backend/src/config/env.js`:

```js
newsApiKey: process.env.NEWS_API_KEY,
```

Add to `backend/.env.example`:

```
NEWS_API_KEY=your_newsapi_org_key_here
```

Note: `newsService.js` already references `config.newsApiKey` but the mapping did not previously exist in `env.js`. This fix also unblocks the existing RSS+NewsAPI fetch path.

## Frontend

### Shared State — `NewsflashContext`

`useNewsflash.js` is called once in `App.jsx` and its state is shared via a new `NewsflashContext`. Both `NewsflashToast` and `Header` consume this context — `NewsflashToast` renders the toasts, `Header` reads `toasts.length` to show the badge. This avoids prop-drilling and keeps the WebSocket subscription to a single instance.

### New Files

**`frontend/src/context/NewsflashContext.jsx`**

- Creates `NewsflashContext` and `NewsflashProvider`
- `NewsflashProvider` owns the `useNewsflash` logic: subscribes to `news` Socket.io channel, listens for `'newsflash'` events, maintains `toasts` array (max 3, FIFO), exposes `{ toasts, dismiss(id) }`
- Wraps `<Router>` in `App.jsx`

**`frontend/src/pages/News.jsx`**

- Polls `GET /api/v1/news/headlines` every 60s via `useEffect` + `setInterval`; clears interval on unmount
- Intel feed layout: sections CRITICAL → HIGH → MEDIUM, each item shows: criticality badge (color-coded), score (`96/100`), title (bold), source + age, one-line reason
- Unscored articles appear at bottom with a "Scoring…" placeholder
- Filter bar: ALL / CRITICAL / HIGH / MEDIUM + search input (client-side filter on title)
- "Last updated X min ago" indicator; manual refresh button

**`frontend/src/components/News/NewsflashToast.jsx`**

- Consumes `NewsflashContext`
- Fixed position bottom-right, `z-50`
- Each toast: ⚡ icon, "NEWSFLASH" label, headline title, score, "→ News" link
- Auto-dismisses after 8s; manual close button
- Stacks up to 3; oldest dropped when full

### Modified Files

**`frontend/src/App.jsx`**

- Wrap entire app in `<NewsflashProvider>` (outside `<Router>`)
- Add `<Route path="/news" element={<News />} />`
- Render `<NewsflashToast />` inside `<Router>` but outside `<Routes>` so it persists during navigation

**`frontend/src/components/Layout/Header.jsx`**

- Add "News" nav link to `/news`
- Consumes `NewsflashContext`; shows a small red dot badge on the nav item when `toasts.length > 0`

## Criticality Scoring

| Score   | Label    | Color  | Toast? |
|---------|----------|--------|--------|
| 85–100  | CRITICAL | Red    | Yes ⚡ |
| 65–84   | HIGH     | Orange | No     |
| 40–64   | MEDIUM   | Gray   | No     |
| 0–39    | LOW      | —      | Hidden by default |
| NULL    | —        | —      | Shown as "Scoring…" |

Claude Haiku evaluates based on: direct military conflict or escalation, state actor involvement, infrastructure or energy sector impact, humanitarian crisis potential, geopolitical alliance shifts.

## Error Handling

- `newsapi-headlines` job: if NewsAPI returns 4xx/5xx, log warning and return early — do not retry immediately (avoids burning rate limit)
- `news-scoring` job: if Haiku call fails, leave `criticality_score = NULL`; article still visible on `/news` page as "Scoring…"; job marked failed in Bull (retried on next cycle per Bull defaults)
- Toast WebSocket: if connection drops, toasts stop arriving — no crash; reconnection handled by existing `wsService.js` logic

## Out of Scope

- Storing or displaying full article body (description only, matching existing newsService pattern)
- User-configurable alert thresholds
- Mobile push notifications
- Retroactive scoring of existing RSS/GDELT articles
