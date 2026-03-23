# Fix Code Review Issues Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 8 high-confidence issues (+ 2 notable) found in the code review: Docker startup failure, port mismatch, dead background jobs, JWT auth absent, WebSocket auth absent, AI service response type mismatch, blocked event loop, missing token tracking, CORS misconfiguration, and missing AI endpoint auth.

**Architecture:** Fixes are spread across three subsystems (infrastructure, backend Node.js, AI service Python) and are independent of each other — they can be executed in any order. Each task makes a minimal, targeted change with no refactoring beyond the fix.

**Tech Stack:** Docker Compose, PostgreSQL/PostGIS/pgvector, Node.js/Express/Bull/JWT, Python/FastAPI/LangGraph/psycopg2

---

## File Map

| File | Action | Reason |
|------|--------|--------|
| `docker/postgres.Dockerfile` | CREATE | Combined PostGIS + pgvector image |
| `docker-compose.yml` | MODIFY | Use custom postgres build |
| `frontend/.env.example` | MODIFY | Port 3001 → 3000 |
| `frontend/src/services/api.js` | MODIFY | Hardcoded fallback port 3001 → 3000 |
| `backend/src/server.js` | MODIFY | Call `scheduleJobs()` on startup |
| `backend/src/middleware/auth.js` | CREATE | JWT verification middleware |
| `backend/src/routes/v1/auth.js` | CREATE | `POST /auth/login` token issuance |
| `backend/src/routes/v1/index.js` | MODIFY | Mount auth route; protect `/analyze` |
| `backend/src/websocket/socketHandler.js` | MODIFY | Verify JWT token on socket connect |
| `backend/tests/middleware/auth.test.js` | CREATE | Unit tests for auth middleware |
| `backend/tests/routes/auth.test.js` | CREATE | Integration tests for login route |
| `ai-service/requirements.txt` | MODIFY | Upgrade `langgraph` to `>=0.1.0` |
| `ai-service/src/config/database.py` | CREATE | Shared psycopg2 connection pool |
| `ai-service/src/config/api_key.py` | CREATE | FastAPI `X-Internal-Key` dependency |
| `ai-service/src/workflows/situational_awareness.py` | MODIFY | Fix async invoke, output shape, token tracking, db pool |
| `ai-service/src/main.py` | MODIFY | Fix CORS; add API key auth to `/analyze/situation` |
| `ai-service/tests/test_output_formatter.py` | CREATE | Unit test for output_formatter |
| `backend/.env.example` | MODIFY | Add `AI_SERVICE_API_KEY` |
| `ai-service/.env.example` | MODIFY | Add `INTERNAL_API_KEY` |
| `docker-compose.yml` | MODIFY (2nd pass) | Pass `INTERNAL_API_KEY` to both services |

---

## Task 1: Fix PostgreSQL Docker Image (pgvector + PostGIS)

**Problem:** `postgis/postgis:15-3.3-alpine` doesn't include pgvector. `init.sql` creates `vector(3072)` columns and `ivfflat` indexes, causing a hard startup failure.

**Files:**
- Create: `docker/postgres.Dockerfile`
- Modify: `docker-compose.yml:5`

- [ ] **Step 1: Create the combined Dockerfile**

```dockerfile
# docker/postgres.Dockerfile
FROM pgvector/pgvector:pg15

RUN apt-get update && \
    apt-get install -y postgresql-15-postgis-3 postgresql-15-postgis-3-scripts && \
    rm -rf /var/lib/apt/lists/*
```

- [ ] **Step 2: Update docker-compose.yml to build from custom image**

In `docker-compose.yml`, replace the `image:` line for the `postgres` service:

```yaml
  postgres:
    build:
      context: .
      dockerfile: docker/postgres.Dockerfile
    environment:
      POSTGRES_USER: appuser
      POSTGRES_PASSWORD: devpassword
      POSTGRES_DB: conflicts_db
```

Remove the `image: postgis/postgis:15-3.3-alpine` line entirely.

- [ ] **Step 3: Verify the build succeeds**

```bash
docker compose build postgres 2>&1 | tail -5
```

Expected: `Successfully built` (or `=> exporting to image`)

- [ ] **Step 4: Verify init.sql runs cleanly**

```bash
docker compose up postgres -d
sleep 5
docker compose exec postgres psql -U appuser -d conflicts_db -c "\dx" | grep -E "vector|postgis"
```

Expected output includes both `postgis` and `vector` in the extension list.

- [ ] **Step 5: Tear down and commit**

```bash
docker compose down -v
git add docker/postgres.Dockerfile docker-compose.yml
git commit -m "fix: replace postgis image with combined postgis+pgvector build"
```

---

## Task 2: Fix Frontend .env.example Port Mismatch

**Problem:** `frontend/.env.example` hardcodes port `3001` but `docker-compose.yml` maps the backend to `3000:3000`. New developers following the example fail to connect.

**Files:**
- Modify: `frontend/.env.example`

- [ ] **Step 1: Fix the port in frontend/.env.example**

Open `frontend/.env.example` and change every `3001` occurrence to `3000`:

```
VITE_API_URL=http://localhost:3000/api/v1
VITE_WS_URL=ws://localhost:3000/ws
```

- [ ] **Step 2: Fix the hardcoded fallback in frontend/src/services/api.js**

In `frontend/src/services/api.js` line 3, change:

```js
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';
```

to:

```js
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
```

- [ ] **Step 3: Commit**

```bash
git add frontend/.env.example frontend/src/services/api.js
git commit -m "fix: correct backend port in frontend config (3001 → 3000)"
```

---

## Task 3: Wire Bull scheduleJobs() on Server Startup

**Problem:** `backend/src/server.js` never imports `jobs/queues.js` or calls `scheduleJobs()`. All four background polling jobs (ACLED hourly, EIA daily, Aviation 5min, news 30min) never start.

**Files:**
- Modify: `backend/src/server.js`

### Sub-task 5a: TDD for WebSocket auth (add before implementing)

See the WebSocket test steps in Task 5 — they must be completed before the implementation here. If working sequentially, complete Task 5 Steps 1–3 first, then return here.

---

- [ ] **Step 1: Add the import and call in server.js**

At the top of `backend/src/server.js`, after the existing requires (line 6):

```js
const { scheduleJobs } = require('./jobs/queues');
```

After the WebSocket handler is initialized (after line 25, `logger.info('WebSocket handler initialized')`), add:

```js
    // Start background job queues
    scheduleJobs();
    logger.info('Background job queues started');
```

The relevant section of `startServer()` should look like:

```js
    // Initialize WebSocket handler
    const socketHandler = new SocketHandler(server, redisClient);
    logger.info('WebSocket handler initialized');

    // Start background job queues
    scheduleJobs();
    logger.info('Background job queues started');

    // Start server
    server.listen(PORT, () => {
```

- [ ] **Step 2: Verify no import errors**

```bash
cd backend && node -e "require('./src/jobs/queues')" 2>&1
```

Expected: no output (clean require).

- [ ] **Step 3: Commit**

```bash
git add backend/src/server.js
git commit -m "fix: call scheduleJobs() on startup so background polling runs"
```

---

## Task 4: Implement JWT Auth Middleware and Protect /analyze

**Problem:** `jsonwebtoken` is installed and `JWT_SECRET` is configured but there is no JWT middleware and no routes are protected. The `/analyze/situation` endpoint triggers expensive LLM calls with zero authentication.

**Files:**
- Create: `backend/src/middleware/auth.js`
- Create: `backend/src/routes/v1/auth.js`
- Modify: `backend/src/routes/v1/index.js`
- Create: `backend/tests/middleware/auth.test.js`
- Create: `backend/tests/routes/auth.test.js`

### Step group: Write tests first

- [ ] **Step 1: Write failing test for auth middleware**

Create `backend/tests/middleware/auth.test.js`:

```js
const { authenticate } = require('../../src/middleware/auth');

describe('authenticate middleware', () => {
  const JWT_SECRET = 'test-secret';
  const jwt = require('jsonwebtoken');

  beforeEach(() => {
    process.env.JWT_SECRET = JWT_SECRET;
  });

  it('calls next() with valid Bearer token', () => {
    const token = jwt.sign({ id: 1, role: 'user' }, JWT_SECRET);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = {};
    const next = jest.fn();
    authenticate(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toMatchObject({ id: 1, role: 'user' });
  });

  it('returns 401 with no Authorization header', () => {
    const req = { headers: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 with invalid token', () => {
    const req = { headers: { authorization: 'Bearer bad-token' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL (module not found)**

```bash
cd backend && npm test -- tests/middleware/auth.test.js 2>&1 | tail -10
```

Expected: `Cannot find module '../../src/middleware/auth'`

- [ ] **Step 3: Implement auth middleware**

Create `backend/src/middleware/auth.js`:

```js
const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ status: 'error', code: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.slice(7);
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ status: 'error', code: 'UNAUTHORIZED', message: 'Invalid or expired token' });
  }
};

module.exports = { authenticate };
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd backend && npm test -- tests/middleware/auth.test.js 2>&1 | tail -5
```

Expected: `Tests: 3 passed`

- [ ] **Step 5: Write failing test for login route**

Create `backend/tests/routes/auth.test.js`:

```js
const request = require('supertest');
const app = require('../../src/app');
const jwt = require('jsonwebtoken');

describe('POST /api/v1/auth/login', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.API_USERNAME = 'admin';
    process.env.API_PASSWORD = 'password';
  });

  it('returns 200 with token on valid credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'password' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    const decoded = jwt.verify(res.body.token, 'test-secret');
    expect(decoded.role).toBe('user');
  });

  it('returns 401 on wrong password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'wrong' });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 6: Run test — expect FAIL (route not found)**

```bash
cd backend && npm test -- tests/routes/auth.test.js 2>&1 | tail -10
```

Expected: `404` response (route doesn't exist yet).

- [ ] **Step 7: Create the login route**

Create `backend/src/routes/v1/auth.js`:

```js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

// POST /api/v1/auth/login
// Body: { username: string, password: string }
// Returns: { token: string }
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const expectedUser = process.env.API_USERNAME || 'admin';
  const expectedPass = process.env.API_PASSWORD;

  if (!expectedPass || username !== expectedUser || password !== expectedPass) {
    return res.status(401).json({ status: 'error', code: 'UNAUTHORIZED', message: 'Invalid credentials' });
  }

  const token = jwt.sign({ role: 'user' }, process.env.JWT_SECRET, { expiresIn: '8h' });
  res.json({ token });
});

module.exports = router;
```

- [ ] **Step 8: Mount auth route and protect /analyze in index.js**

Modify `backend/src/routes/v1/index.js`:

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

// Public routes
router.use('/auth', authRoutes);
router.use('/conflicts', conflictsRoutes);
router.use('/energy', energyRoutes);
router.use('/flights', flightsRoutes);
router.use('/correlations', correlationsRoutes);
router.use('/news', newsRoutes);

// Protected routes (require JWT)
router.use('/analyze', authenticate, analyzeRoutes);

module.exports = router;
```

- [ ] **Step 9: Run both tests — expect PASS**

```bash
cd backend && npm test -- tests/middleware/auth.test.js tests/routes/auth.test.js 2>&1 | tail -5
```

Expected: `Tests: 5 passed`

- [ ] **Step 10: Add env vars to backend/.env.example**

Add to `backend/.env.example`:

```
API_USERNAME=admin
API_PASSWORD=changeme-strong-password
```

- [ ] **Step 11: Commit**

```bash
git add backend/src/middleware/auth.js backend/src/routes/v1/auth.js backend/src/routes/v1/index.js backend/tests/middleware/auth.test.js backend/tests/routes/auth.test.js backend/.env.example
git commit -m "fix: implement JWT auth middleware and protect /analyze endpoint"
```

---

## Task 5: Add WebSocket Authentication

**Problem:** `socketHandler.js` accepts all socket connections unconditionally — any unauthenticated client can subscribe to `threat-alerts`.

**Files:**
- Modify: `backend/src/websocket/socketHandler.js`
- Create: `backend/tests/websocket/socketHandler.test.js`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/websocket/socketHandler.test.js`:

```js
const http = require('http');
const { Server } = require('socket.io');
const { io: ioc } = require('socket.io-client');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'test-secret';

function createTestServer() {
  const httpServer = http.createServer();
  // Minimal SocketHandler recreation for test
  const SocketHandler = require('../../src/websocket/socketHandler');
  const handler = new SocketHandler(httpServer, { quit: jest.fn() });
  return { httpServer, handler };
}

describe('WebSocket auth', () => {
  let httpServer, handler, port;

  beforeAll((done) => {
    process.env.JWT_SECRET = JWT_SECRET;
    ({ httpServer, handler } = createTestServer());
    httpServer.listen(() => {
      port = httpServer.address().port;
      done();
    });
  });

  afterAll(() => httpServer.close());

  it('disconnects client with no token', (done) => {
    const client = ioc(`http://localhost:${port}`, { auth: {} });
    client.on('disconnect', () => {
      done();
    });
    client.on('connect', () => {
      // Should not reach here — expect disconnect
    });
  });

  it('accepts client with valid token', (done) => {
    const token = jwt.sign({ role: 'user' }, JWT_SECRET);
    const client = ioc(`http://localhost:${port}`, { auth: { token } });
    client.on('connect', () => {
      client.disconnect();
      done();
    });
    client.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') {
        done(new Error('Server rejected valid token'));
      }
    });
  });
});
```

- [ ] **Step 2: Run test — expect FAIL (both cases connect without auth)**

```bash
cd backend && npm test -- tests/websocket/socketHandler.test.js 2>&1 | tail -10
```

Expected: test for "no token" fails (server does not disconnect unauthenticated client yet).

- [ ] **Step 3: Add token verification in the connection handler**

Replace the `setupHandlers()` method in `backend/src/websocket/socketHandler.js`:

```js
setupHandlers() {
  this.io.on('connection', (socket) => {
    // Verify JWT token passed as handshake auth
    const token = socket.handshake.auth?.token;
    if (!token) {
      logger.warn('Socket connection rejected: no token', { socketId: socket.id });
      socket.disconnect(true);
      return;
    }

    try {
      const jwt = require('jsonwebtoken');
      socket.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      logger.warn('Socket connection rejected: invalid token', { socketId: socket.id });
      socket.disconnect(true);
      return;
    }

    logger.info('User connected', { socketId: socket.id });

    socket.on('subscribe', (channel) => {
      socket.join(channel);
      logger.info('User subscribed', { socketId: socket.id, channel });
    });

    socket.on('unsubscribe', (channel) => {
      socket.leave(channel);
      logger.info('User unsubscribed', { socketId: socket.id, channel });
    });

    socket.on('disconnect', () => {
      logger.info('User disconnected', { socketId: socket.id });
    });
  });
}
```

Socket.io-client connects with: `io(url, { auth: { token: '<jwt>' } })`.

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd backend && npm test -- tests/websocket/socketHandler.test.js 2>&1 | tail -5
```

Expected: `Tests: 2 passed`

- [ ] **Step 5: Verify no syntax errors**

```bash
cd backend && node -e "require('./src/websocket/socketHandler')" 2>&1
```

Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add backend/src/websocket/socketHandler.js backend/tests/websocket/socketHandler.test.js
git commit -m "fix: require JWT auth on WebSocket connections"
```

---

## Task 6: Upgrade langgraph and Fix Async Invocation

**Problem 1:** `langgraph==0.0.20` is pinned but the code imports `from langgraph.graph import START, END` — a 0.1+ API, causing `ImportError` at startup.

**Problem 2:** `graph.invoke(initial_state)` (synchronous) is called inside `async def analyze_situation`, blocking FastAPI's event loop for the full duration of every LLM call.

**Files:**
- Modify: `ai-service/requirements.txt:3`
- Modify: `ai-service/src/workflows/situational_awareness.py:311`

- [ ] **Step 1: Upgrade langgraph in requirements.txt**

Change line 3 of `ai-service/requirements.txt`:

```
langgraph>=0.1.0,<0.3.0
```

Also bump `langchain`, `langchain-anthropic`, `langchain-openai` to compatible versions:

```
langchain>=0.2.0,<0.4.0
langchain-anthropic>=0.1.15,<0.4.0
langchain-openai>=0.1.0,<0.4.0
langchain-chroma>=0.1.0,<0.2.0
```

- [ ] **Step 2: Reinstall dependencies**

```bash
cd ai-service && pip install -r requirements.txt 2>&1 | tail -5
```

Expected: installs without errors.

- [ ] **Step 3: Add `threat_level` and `token_usage` to SituationalAwarenessState**

These fields are referenced in the initial state below (Step 4) and in Task 8, so they must be added now. In `situational_awareness.py`, replace the `SituationalAwarenessState` TypedDict:

```python
class SituationalAwarenessState(TypedDict):
    query: str
    news_articles: Annotated[list[NewsArticle], operator.add]
    geopolitical_events: Annotated[list[GeopoliticalEvent], operator.add]
    infrastructure_impacts: Annotated[list[InfrastructureCorrelation], operator.add]
    threat_assessment: str
    threat_level: str                           # "low"|"medium"|"high"|"critical"
    token_usage: Annotated[int, operator.add]   # accumulated across agent nodes
    recommendations: list[str]
    final_report: str
```

- [ ] **Step 4: Verify the workflow imports cleanly**

```bash
cd ai-service/src && python -c "from workflows.situational_awareness import build_situational_awareness_workflow; print('OK')"
```

Expected: `OK`

- [ ] **Step 5: Fix the blocking invoke call**

In `ai-service/src/workflows/situational_awareness.py`, replace the `analyze_situation` function body:

```python
async def analyze_situation(query: str) -> dict:
    """Entry point for analysis"""
    initial_state = {
        "query": query,
        "news_articles": [],
        "geopolitical_events": [],
        "infrastructure_impacts": [],
        "threat_assessment": "",
        "threat_level": "",
        "token_usage": 0,
        "recommendations": [],
        "final_report": ""
    }

    graph = build_situational_awareness_workflow()
    result = await graph.ainvoke(initial_state)
    return json.loads(result["final_report"])
```

(`graph.ainvoke` is the non-blocking async version available in langgraph ≥ 0.1.0.)

- [ ] **Step 6: Verify async works**

```bash
cd ai-service/src && python -c "
import inspect
from workflows.situational_awareness import analyze_situation
print('is coroutine:', inspect.iscoroutinefunction(analyze_situation))
"
```

Expected: `is coroutine: True`

- [ ] **Step 7: Commit**

```bash
git add ai-service/requirements.txt ai-service/src/workflows/situational_awareness.py
git commit -m "fix: upgrade langgraph to 0.1+, add threat_level/token_usage state fields, use ainvoke"
```

---

## Task 7: Create AI Service Database Connection Pool

**Problem:** `infrastructure_correlator_agent` calls `create_engine(database_url)` inline on every invocation, creating a new SQLAlchemy engine with no connection pooling. The spec requires shared `psycopg2` connections. The `ai-service/src/config/` directory doesn't exist.

**Files:**
- Create: `ai-service/src/config/__init__.py`
- Create: `ai-service/src/config/database.py`
- Create: `ai-service/tests/conftest.py`
- Modify: `ai-service/src/workflows/situational_awareness.py:160-167`

> **Import convention:** uvicorn is invoked as `uvicorn src.main:app` from `ai-service/`, making `ai-service/` the working directory and `src` a Python package. However, inside `src/`, existing code uses relative imports (`from workflows.situational_awareness import…`), which means `ai-service/src/` is also on `PYTHONPATH` at runtime. For pytest to resolve the same paths, a `conftest.py` must add `src/` to `sys.path`.

- [ ] **Step 1: Create pytest conftest.py for path resolution**

Create `ai-service/tests/conftest.py`:

```python
import sys
import os

# Add ai-service/src/ to sys.path so tests can import as: from config.database import ...
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
```

- [ ] **Step 2: Write failing test for database pool**

Create `ai-service/tests/test_database_config.py`:

```python
import os
import pytest

def test_get_db_pool_returns_pool(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://appuser:devpassword@localhost:5432/conflicts_db")
    # Just test that the module imports and get_db_pool is callable
    from config.database import get_db_pool
    assert callable(get_db_pool)

def test_get_db_pool_raises_without_env(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    # Re-import to reset the module state
    import importlib
    import config.database as db_mod
    importlib.reload(db_mod)
    # get_db_pool should raise when DATABASE_URL is not set
    with pytest.raises(Exception):
        db_mod.get_db_pool()
```

- [ ] **Step 3: Run test — expect FAIL**

```bash
cd ai-service && python -m pytest tests/test_database_config.py -v 2>&1 | tail -10
```

Expected: `ModuleNotFoundError: No module named 'config'`

- [ ] **Step 4: Create the config module**

```bash
touch ai-service/src/config/__init__.py
```

Create `ai-service/src/config/database.py`:

```python
import os
import psycopg2
from psycopg2 import pool as psycopg2_pool

_pool: psycopg2_pool.ThreadedConnectionPool | None = None


def _init_pool() -> psycopg2_pool.ThreadedConnectionPool:
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL environment variable is not set")
    return psycopg2_pool.ThreadedConnectionPool(
        minconn=1,
        maxconn=5,
        dsn=database_url,
    )


def get_db_pool() -> psycopg2_pool.ThreadedConnectionPool:
    """Return the shared connection pool, initialising it on first call."""
    global _pool
    if _pool is None:
        _pool = _init_pool()
    return _pool
```

- [ ] **Step 5: Run test — expect PASS**

```bash
cd ai-service && python -m pytest tests/test_database_config.py -v 2>&1 | tail -5
```

Expected: `2 passed`

- [ ] **Step 6: Update infrastructure_correlator_agent to use the pool**

In `ai-service/src/workflows/situational_awareness.py`, replace the body of `infrastructure_correlator_agent` from lines 158–216.

Remove:
```python
    from sqlalchemy import create_engine, text
    from sqlalchemy.orm import sessionmaker
    ...
    database_url = os.getenv("DATABASE_URL", "postgresql://appuser:devpassword@postgres:5432/conflicts_db")
    engine = create_engine(database_url)
```

Replace the database block with psycopg2 pool usage:

```python
def infrastructure_correlator_agent(state: SituationalAwarenessState):
    """NODE 3: Find infrastructure within 200km of events"""
    from config.database import get_db_pool

    correlations = []
    severity_multiplier = {
        "low": 0.3, "medium": 0.6, "high": 0.8, "critical": 1.0
    }

    db_pool = get_db_pool()

    for event in state["geopolitical_events"]:
        if event["severity"] == "low":
            continue

        sql = """
        WITH event_point AS (
          SELECT ST_SetSRID(ST_GeomFromText(%s), 4326) as geom
        )
        SELECT
          f.id,
          f.facility_type,
          ST_Distance(f.location::geography, ep.geom::geography) / 1000 as distance_km,
          f.status,
          f.capacity
        FROM energy_facilities f
        CROSS JOIN event_point ep
        WHERE ST_DWithin(f.location::geography, ep.geom::geography, 200000)
        ORDER BY distance_km ASC
        LIMIT 10
        """

        conn = db_pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(sql, (event["location"],))
                rows = cur.fetchall()
        finally:
            db_pool.putconn(conn)

        multiplier = severity_multiplier.get(event["severity"], 0.3)

        for row in rows:
            facility_id, facility_type, distance_km, status, capacity = row
            correlation_score = max(0, 1.0 - (distance_km / 200)) * multiplier

            if correlation_score > 0.3:
                correlations.append({
                    "event_id": event.get("id", "unknown"),
                    "infrastructure_ids": [str(facility_id)],
                    "distance_km": float(distance_km),
                    "correlation_score": float(correlation_score),
                    "risk_assessment": (
                        f"{event['event_type']} ({event['severity']}) "
                        f"at {distance_km:.1f}km from {facility_type}"
                    )
                })

    return {"infrastructure_impacts": correlations}
```

- [ ] **Step 7: Verify import**

```bash
cd ai-service/src && python -c "from workflows.situational_awareness import infrastructure_correlator_agent; print('OK')"
```

Expected: `OK`

- [ ] **Step 8: Commit**

```bash
git add ai-service/src/config/__init__.py ai-service/src/config/database.py ai-service/src/workflows/situational_awareness.py ai-service/tests/conftest.py ai-service/tests/test_database_config.py
git commit -m "fix: add psycopg2 connection pool for ai-service and use it in infrastructure correlator"
```

---

## Task 8: Fix output_formatter Response Shape + Token Tracking

**Problem 1:** `output_formatter` stores `len(geopolitical_events)` and `len(infrastructure_impacts)` as integers under the keys `geopolitical_events` and `infrastructure_at_risk`. `AnalysisResponse` expects `List[dict]` — Pydantic validation fails on every call.

**Problem 2:** `threat_level` is set to `state["threat_assessment"]` which is Claude's multi-sentence `executive_summary`, not a level word like `"high"`. The `AnalysisResponse.threat_level` field expects a level word.

**Problem 3:** `token_usage` and `cost_usd` always return `0` / `0.0` — tracking is entirely absent.

**Files:**
- Modify: `ai-service/src/workflows/situational_awareness.py`
- Create: `ai-service/tests/test_output_formatter.py`

### Sub-task 8a: Add threat_level and token counting to agents

> **Note:** `threat_level` and `token_usage` fields were already added to `SituationalAwarenessState` in Task 6 Step 3. No state changes needed here.

- [ ] **Step 1: Store threat_level in threat_assessment_agent**

In `threat_assessment_agent`, change the return statement (around line 250):

```python
    return {
        "threat_assessment": assessment.executive_summary,
        "threat_level": assessment.overall_threat_level,
        "recommendations": assessment.recommended_actions,
        "token_usage": tokens,
    }
```

But first, extract token usage after the `structured_llm.invoke(context)` call:

```python
    assessment = structured_llm.invoke(context)

    usage = getattr(assessment, "usage_metadata", None) or {}
    tokens = usage.get("input_tokens", 0) + usage.get("output_tokens", 0)
```

- [ ] **Step 2: Add token counting to geopolitical_analyst_agent**

In `geopolitical_analyst_agent`, after `structured_llm.invoke(extraction_prompt)` (around line 141):

```python
    result = structured_llm.invoke(extraction_prompt)

    usage = getattr(result, "usage_metadata", None) or {}
    tokens = usage.get("input_tokens", 0) + usage.get("output_tokens", 0)
```

Then add `token_usage` to the return dict (`Annotated[int, operator.add]` accumulates ints):

```python
    return {
        "geopolitical_events": events,
        "token_usage": tokens,
    }
```

Complete `threat_assessment_agent` return (combining Step 1 edits into one coherent block):

```python
    assessment = structured_llm.invoke(context)

    usage = getattr(assessment, "usage_metadata", None) or {}
    tokens = usage.get("input_tokens", 0) + usage.get("output_tokens", 0)

    return {
        "threat_assessment": assessment.executive_summary,
        "threat_level": assessment.overall_threat_level,
        "recommendations": assessment.recommended_actions,
        "token_usage": tokens,
    }
```

### Sub-task 8b: Write test for output_formatter

- [ ] **Step 5: Write the test**

Create `ai-service/tests/test_output_formatter.py`:

```python
import json
import pytest
from workflows.situational_awareness import output_formatter


def make_state(events=None, impacts=None, threat_level="medium", recommendations=None, token_usage=150):
    return {
        "query": "test",
        "news_articles": [{"id": "1", "title": "t", "content": "c", "source": "s",
                           "published_at": "", "url": "", "embedding": [], "relevance_score": 0.9}],
        "geopolitical_events": events or [{"event_type": "conflict", "actors": ["A"], "location": "X",
                                           "date": "2026-01-01", "severity": "high", "description": "d"}],
        "infrastructure_impacts": impacts or [{"event_id": "e1", "infrastructure_ids": ["f1"],
                                               "distance_km": 50.0, "correlation_score": 0.7,
                                               "risk_assessment": "risk"}],
        "threat_assessment": "Significant risks observed in the region.",
        "threat_level": threat_level,
        "recommendations": recommendations or ["Monitor closely"],
        "token_usage": token_usage,
        "final_report": "",
    }


def test_output_formatter_returns_lists_not_counts():
    state = make_state()
    result_state = output_formatter(state)
    report = json.loads(result_state["final_report"])

    assert isinstance(report["geopolitical_events"], list), "geopolitical_events must be a list"
    assert isinstance(report["infrastructure_at_risk"], list), "infrastructure_at_risk must be a list"
    assert len(report["geopolitical_events"]) == 1
    assert len(report["infrastructure_at_risk"]) == 1


def test_output_formatter_threat_level_is_word():
    state = make_state(threat_level="high")
    result_state = output_formatter(state)
    report = json.loads(result_state["final_report"])

    assert report["threat_level"] in ("low", "medium", "high", "critical"), \
        f"Expected threat level word, got: {report['threat_level']}"


def test_output_formatter_includes_token_usage():
    state = make_state(token_usage=500)
    result_state = output_formatter(state)
    report = json.loads(result_state["final_report"])

    assert report["token_usage"] == 500
    assert report["cost_usd"] > 0, "cost_usd should be computed from token_usage"


def test_output_formatter_total_articles_correct():
    state = make_state()
    result_state = output_formatter(state)
    report = json.loads(result_state["final_report"])
    assert report["total_articles"] == 1
```

- [ ] **Step 6: Run test — expect FAIL**

```bash
cd ai-service && python -m pytest tests/test_output_formatter.py -v 2>&1 | tail -15
```

Expected: 3–4 failures (counts instead of lists, wrong threat_level, no cost).

- [ ] **Step 7: Fix output_formatter**

Replace the entire `output_formatter` function:

```python
# Claude Sonnet pricing approximation: ~$9/1M tokens blended
_COST_PER_TOKEN_USD = 9.0 / 1_000_000


def output_formatter(state: SituationalAwarenessState):
    """NODE 5: Format results for frontend"""
    token_usage = state.get("token_usage", 0)
    final_report = {
        "timestamp": str(datetime.datetime.now()),
        "threat_level": state.get("threat_level", "unknown"),
        "total_articles": len(state["news_articles"]),
        "geopolitical_events": state["geopolitical_events"],
        "infrastructure_at_risk": state["infrastructure_impacts"],
        "recommendations": state.get("recommendations", []),
        "token_usage": token_usage,
        "cost_usd": round(token_usage * _COST_PER_TOKEN_USD, 6),
    }

    return {"final_report": json.dumps(final_report, indent=2)}
```

- [ ] **Step 8: Run test — expect PASS**

```bash
cd ai-service && python -m pytest tests/test_output_formatter.py -v 2>&1 | tail -5
```

Expected: `4 passed`

- [ ] **Step 9: Commit**

```bash
git add ai-service/src/workflows/situational_awareness.py ai-service/tests/test_output_formatter.py
git commit -m "fix: output_formatter returns lists not counts, correct threat_level, add token/cost tracking"
```

---

## Task 9: Fix AI Service CORS and Add Endpoint Authentication

**Problem 1:** `allow_origins=["*"]` combined with `allow_credentials=True` is invalid per the CORS spec — browsers will reject all credentialed requests.

**Problem 2:** `POST /analyze/situation` has no authentication. Anyone who can reach port 8000 can trigger LLM calls at cost to the operator.

**Solution:** Fix CORS to use the explicit frontend origin. Protect `/analyze/situation` with a pre-shared `X-Internal-Key` header checked against an `INTERNAL_API_KEY` env var. The backend already calls the AI service — it will pass the key as a header. The `/health` endpoint stays public.

**Files:**
- Create: `ai-service/src/config/api_key.py`
- Modify: `ai-service/src/main.py`
- Modify: `backend/src/routes/v1/analyze.js:38-44`
- Modify: `backend/.env.example`
- Modify: `ai-service/.env.example`
- Modify: `docker-compose.yml`

- [ ] **Step 1: Create the API key dependency**

Create `ai-service/src/config/api_key.py`:

```python
import os
from fastapi import Header, HTTPException


async def require_internal_key(x_internal_key: str = Header(default="")):
    """FastAPI dependency: validates X-Internal-Key against INTERNAL_API_KEY env var."""
    expected = os.getenv("INTERNAL_API_KEY", "")
    if not expected:
        raise HTTPException(status_code=500, detail="INTERNAL_API_KEY not configured")
    if x_internal_key != expected:
        raise HTTPException(status_code=403, detail="Invalid internal API key")
```

- [ ] **Step 2: Fix CORS and apply auth dependency in main.py**

Replace `main.py` content:

```python
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Situational Awareness AI Service", version="1.0.0")

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
    infrastructure_at_risk: List[dict]
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
            infrastructure_at_risk=result.get("infrastructure_at_risk", []),
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

Add the import at the top (following the same no-`src.`-prefix convention used throughout `src/`):

```python
from config.api_key import require_internal_key
```

- [ ] **Step 3: Pass X-Internal-Key in backend's axios call**

In `backend/src/routes/v1/analyze.js`, update the axios call (lines 38–44):

```js
    const response = await axios.post(`${aiServiceUrl}/analyze/situation`, {
      query,
      include_infrastructure,
      threat_level_threshold
    }, {
      timeout: 30000,
      headers: {
        'X-Internal-Key': process.env.AI_SERVICE_API_KEY || ''
      }
    });
```

- [ ] **Step 4: Add env vars to .env.example files**

Add to `backend/.env.example`:

```
AI_SERVICE_API_KEY=changeme-internal-key
```

Add to `ai-service/.env.example` (create if it doesn't exist):

```
INTERNAL_API_KEY=changeme-internal-key
FRONTEND_URL=http://localhost:5173
```

- [ ] **Step 5: Add to docker-compose.yml**

In the `backend` service environment block, add:

```yaml
      AI_SERVICE_API_KEY: ${AI_SERVICE_API_KEY:-changeme-internal-key}
```

In the `ai-service` environment block, add:

```yaml
      INTERNAL_API_KEY: ${AI_SERVICE_API_KEY:-changeme-internal-key}
      FRONTEND_URL: http://localhost:5173
```

- [ ] **Step 6: Verify main.py imports cleanly**

```bash
cd ai-service/src && python -c "import main; print('OK')"
```

Expected: `OK`

- [ ] **Step 7: Commit**

```bash
git add ai-service/src/config/api_key.py ai-service/src/main.py backend/src/routes/v1/analyze.js backend/.env.example ai-service/.env.example docker-compose.yml
git commit -m "fix: restrict CORS to explicit origin and require X-Internal-Key on /analyze/situation"
```

---

## Verification Checklist

After all tasks are complete, run this full verification pass:

- [ ] `docker compose build` completes without errors (postgres now includes pgvector)
- [ ] `docker compose up postgres -d && docker compose exec postgres psql -U appuser -d conflicts_db -c "\dx"` shows both `postgis` and `vector`
- [ ] `curl -s http://localhost:3000/api/v1/analyze/situation -X POST -H "Content-Type: application/json" -d '{"query":"test"}'` returns `401` (auth enforced)
- [ ] `curl -s http://localhost:8000/analyze/situation -X POST -H "Content-Type: application/json" -H "X-Internal-Key: wrong" -d '{"query":"test"}'` returns `403`
- [ ] `curl -s http://localhost:8000/health` returns `{"status":"ok"}` (health stays public)
- [ ] Backend logs show `Background job queues started` on startup
- [ ] `cd backend && npm test` — auth middleware and login route tests pass
- [ ] `cd ai-service && python -m pytest tests/` — output_formatter and database config tests pass
- [ ] WebSocket connection without token is rejected (check backend logs for `Socket connection rejected`)
