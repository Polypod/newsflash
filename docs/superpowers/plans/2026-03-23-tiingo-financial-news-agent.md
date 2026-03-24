# Tiingo Financial News Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new `financial_news_agent` LangGraph node that uses an LLM to determine which stock tickers and tags to query based on geopolitical events, fetches relevant financial news from Tiingo, and passes it to the threat assessment.

**Architecture:** A new NODE 4 is inserted between `infrastructure_correlator_agent` and `threat_assessment_agent`. It calls `gpt-4o-mini` (structured output) to derive Tiingo query parameters from the geopolitical events, then hits `GET https://api.tiingo.com/tiingo/news?tickers=...&tags=...` via `httpx`. The resulting `financial_signals` list flows through the state to enrich the threat assessment and final report.

**Tech Stack:** Python/FastAPI, LangGraph (existing), httpx (already in requirements), OpenAI gpt-4o-mini (existing), Tiingo REST API, pydantic, pytest

---

## File Map

| File | Action | Reason |
|------|--------|--------|
| `ai-service/settings.yaml` | MODIFY | Add `tiingo.news_limit` and `tiingo.max_tickers` |
| `ai-service/src/config/settings.py` | MODIFY | Add `_Tiingo` class and `tiingo` export |
| `ai-service/src/services/__init__.py` | CREATE | Make `services/` a Python package |
| `ai-service/src/services/tiingo.py` | CREATE | HTTP client for Tiingo news endpoint |
| `ai-service/src/workflows/situational_awareness.py` | MODIFY | Add `FinancialNewsItem` type, `financial_signals` state field, `financial_news_agent` node, update downstream nodes and workflow edges |
| `ai-service/src/main.py` | MODIFY | Add `financial_signals` to `AnalysisResponse` |
| `ai-service/.env.example` | MODIFY | Add `TIINGO_API_KEY` |
| `docker-compose.yml` | MODIFY | Pass `TIINGO_API_KEY` to ai-service |
| `ai-service/tests/conftest.py` | MODIFY | Conditionally stub `httpx` if not installed locally |
| `ai-service/tests/test_tiingo_client.py` | CREATE | 3 unit tests for `fetch_tiingo_news` |
| `ai-service/tests/test_financial_news_agent.py` | CREATE | 2 unit tests for `financial_news_agent` |
| `ai-service/tests/test_output_formatter.py` | MODIFY | Add `financial_signals` to `make_state()` |
| `scripts/test-apis.js` | MODIFY | Add Tiingo smoke test |

---

## Context for implementers

**Codebase conventions (read these before touching any file):**

- `ai-service/src/` is the Python package root at runtime and in tests. All imports inside `src/` use NO `src.` prefix, e.g. `from config.settings import ...`, `from services.tiingo import ...`.
- `ai-service/tests/conftest.py` adds `ai-service/src/` to `sys.path` and stubs heavy ML packages (langgraph, langchain) that aren't installed locally. Tests run with `python -m pytest tests/` from `ai-service/`.
- `settings.yaml` lives at `ai-service/settings.yaml`. `config/settings.py` loads it via relative path `../../settings.yaml` from `src/config/`.
- Lazy imports inside agent functions (e.g. `from config.database import get_db_pool` inside `infrastructure_correlator_agent`) are the established pattern — follow this for `from services.tiingo import fetch_tiingo_news` inside `financial_news_agent`.
- `token_usage: Annotated[int, operator.add]` accumulates across nodes via LangGraph state reduction.

**Tiingo API (https://api.tiingo.com/tiingo/news):**
- Auth: query param `token=YOUR_KEY`
- Key params: `tickers` (comma-separated, e.g. `xom,cvx`), `tags` (comma-separated, e.g. `energy,defense`), `limit`
- Response: JSON array of `{id, title, url, description, publishedDate, crawlDate, source, tickers, tags}`
- No per-second rate limits; limits are hourly/daily/monthly by plan tier

---

## Task 1: Config Plumbing

**Files:**
- Modify: `ai-service/settings.yaml`
- Modify: `ai-service/src/config/settings.py`
- Modify: `ai-service/.env.example`
- Modify: `docker-compose.yml`

- [ ] **Step 1: Add tiingo section to settings.yaml**

Append to `ai-service/settings.yaml`:

```yaml
tiingo:
  # Max articles to fetch per Tiingo query
  news_limit: 10
  # Max tickers to send in a single request
  max_tickers: 10
```

- [ ] **Step 2: Add `_Tiingo` class to config/settings.py**

Read the current `ai-service/src/config/settings.py` first. Then add after the `_Cost` class:

```python
class _Tiingo:
    @property
    def news_limit(self) -> int:
        return int(os.getenv("TIINGO_NEWS_LIMIT") or get("tiingo", "news_limit"))

    @property
    def max_tickers(self) -> int:
        return int(os.getenv("TIINGO_MAX_TICKERS") or get("tiingo", "max_tickers"))


tiingo = _Tiingo()
```

- [ ] **Step 3: Verify settings load**

```bash
cd /path/to/newsflash/ai-service/src && python -c "from config.settings import tiingo; print(tiingo.news_limit, tiingo.max_tickers)"
```

Expected: `10 10`

- [ ] **Step 4: Add TIINGO_API_KEY to ai-service/.env.example**

Append to `ai-service/.env.example`:

```
# Tiingo financial news (https://www.tiingo.com/account/api/token)
TIINGO_API_KEY=your-tiingo-api-key
```

- [ ] **Step 5: Add TIINGO_API_KEY to docker-compose.yml**

In the `ai-service` service environment block in `docker-compose.yml`, add:

```yaml
      TIINGO_API_KEY: ${TIINGO_API_KEY}
```

- [ ] **Step 6: Commit**

```bash
git add ai-service/settings.yaml ai-service/src/config/settings.py ai-service/.env.example docker-compose.yml
git commit -m "feat: add tiingo config section to settings.yaml and env plumbing"
```

---

## Task 2: Tiingo HTTP Client

**Files:**
- Create: `ai-service/src/services/__init__.py`
- Create: `ai-service/src/services/tiingo.py`
- Modify: `ai-service/tests/conftest.py`
- Create: `ai-service/tests/test_tiingo_client.py`

- [ ] **Step 1: Write the failing tests**

Create `ai-service/tests/test_tiingo_client.py`:

```python
import pytest
from unittest.mock import patch, MagicMock


def _make_mock_client(json_return):
    """Helper: create a mock httpx.Client context manager returning json_return."""
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.json.return_value = json_return
    mock_client.get.return_value = mock_response
    return mock_client


def test_fetch_returns_normalized_articles():
    from services.tiingo import fetch_tiingo_news

    raw = [
        {
            "id": 99,
            "title": "Oil prices surge",
            "url": "https://reuters.com/oil",
            "description": "Brent crude rises as conflict escalates in oil-producing region.",
            "publishedDate": "2026-01-15T10:00:00+00:00",
            "crawlDate": "2026-01-15T10:05:00+00:00",
            "source": "reuters.com",
            "tickers": ["XOM", "CVX"],
            "tags": ["energy", "oil"],
        }
    ]
    with patch("httpx.Client") as MockClient:
        MockClient.return_value.__enter__.return_value = _make_mock_client(raw)
        articles = fetch_tiingo_news(tickers=["XOM"], tags=["energy"], limit=5, api_key="test-key")

    assert len(articles) == 1
    a = articles[0]
    assert a["title"] == "Oil prices surge"
    assert a["source"] == "reuters.com"
    assert a["tickers"] == ["XOM", "CVX"]
    assert a["tags"] == ["energy", "oil"]
    assert len(a["description"]) <= 500  # truncated


def test_fetch_passes_correct_query_params():
    from services.tiingo import fetch_tiingo_news

    mock_client = _make_mock_client([])
    with patch("httpx.Client") as MockClient:
        MockClient.return_value.__enter__.return_value = mock_client
        fetch_tiingo_news(tickers=["XOM", "BP"], tags=["energy"], limit=7, api_key="my-key")

    call_kwargs = mock_client.get.call_args[1]
    params = call_kwargs["params"]
    assert params["token"] == "my-key"
    assert params["tickers"] == "XOM,BP"
    assert params["tags"] == "energy"
    assert params["limit"] == 7


def test_fetch_returns_empty_on_network_error():
    from services.tiingo import fetch_tiingo_news

    with patch("httpx.Client") as MockClient:
        MockClient.return_value.__enter__.side_effect = Exception("network failure")
        articles = fetch_tiingo_news(tickers=["XOM"], tags=[], limit=5, api_key="key")

    assert articles == []


def test_fetch_omits_empty_tickers_and_tags():
    from services.tiingo import fetch_tiingo_news

    mock_client = _make_mock_client([])
    with patch("httpx.Client") as MockClient:
        MockClient.return_value.__enter__.return_value = mock_client
        fetch_tiingo_news(tickers=[], tags=[], limit=5, api_key="key")

    params = mock_client.get.call_args[1]["params"]
    assert "tickers" not in params
    assert "tags" not in params
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd /path/to/newsflash/ai-service && python -m pytest tests/test_tiingo_client.py -v 2>&1 | tail -10
```

Expected: `ModuleNotFoundError: No module named 'services'`

- [ ] **Step 3: Add httpx conditional stub to conftest.py**

Read `ai-service/tests/conftest.py` first. Add after the existing stubs:

```python
# Conditionally stub httpx if not installed locally (it IS available in Docker)
try:
    import httpx  # noqa: F401
except ImportError:
    sys.modules["httpx"] = MagicMock()
```

- [ ] **Step 4: Create the services package**

Create empty `ai-service/src/services/__init__.py`.

- [ ] **Step 5: Implement the Tiingo client**

Create `ai-service/src/services/tiingo.py`:

```python
"""Tiingo financial news HTTP client."""
from typing import List
import httpx

TIINGO_NEWS_URL = "https://api.tiingo.com/tiingo/news"


def fetch_tiingo_news(
    tickers: List[str],
    tags: List[str],
    limit: int,
    api_key: str,
) -> List[dict]:
    """Fetch news articles from Tiingo. Returns [] on any error."""
    params: dict = {"token": api_key, "limit": limit}
    if tickers:
        params["tickers"] = ",".join(tickers)
    if tags:
        params["tags"] = ",".join(tags)

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(TIINGO_NEWS_URL, params=params)
            resp.raise_for_status()
            raw = resp.json()
    except Exception:
        return []

    if not isinstance(raw, list):
        return []

    return [
        {
            "id": str(article.get("id", "")),
            "title": article.get("title", ""),
            "url": article.get("url", ""),
            "description": (article.get("description") or "")[:500],
            "published_date": article.get("publishedDate", ""),
            "source": article.get("source", ""),
            "tickers": article.get("tickers") or [],
            "tags": article.get("tags") or [],
        }
        for article in raw
    ]
```

- [ ] **Step 6: Run tests — expect PASS**

```bash
cd /path/to/newsflash/ai-service && python -m pytest tests/test_tiingo_client.py -v 2>&1 | tail -8
```

Expected: `4 passed`

- [ ] **Step 7: Commit**

```bash
git add ai-service/src/services/__init__.py ai-service/src/services/tiingo.py ai-service/tests/conftest.py ai-service/tests/test_tiingo_client.py
git commit -m "feat: add Tiingo HTTP client with unit tests"
```

---

## Task 3: financial_news_agent

**Files:**
- Modify: `ai-service/src/workflows/situational_awareness.py` (add TypedDict, state field, agent function only — no wiring yet)
- Create: `ai-service/tests/test_financial_news_agent.py`

> **Note on imports:** Add `tiingo as tiingo_cfg` to the existing settings import line at the top of `situational_awareness.py`.

- [ ] **Step 1: Write the failing tests**

Create `ai-service/tests/test_financial_news_agent.py`:

```python
import pytest
from unittest.mock import MagicMock, patch


def _make_events_state(events=None):
    return {
        "query": "oil conflict Middle East",
        "geopolitical_events": events or [
            {
                "event_type": "conflict",
                "actors": ["Country A", "Country B"],
                "location": "Middle East",
                "date": "2026-01-01",
                "severity": "high",
                "description": "Armed conflict erupted near major oil fields.",
            }
        ],
        "news_articles": [],
        "infrastructure_impacts": [],
        "financial_signals": [],
        "threat_assessment": "",
        "threat_level": "",
        "recommendations": [],
        "token_usage": 0,
        "final_report": "",
    }


def test_agent_returns_financial_articles_when_api_key_set(monkeypatch):
    monkeypatch.setenv("TIINGO_API_KEY", "test-key")

    mock_query = MagicMock()
    mock_query.tickers = ["XOM", "CVX"]
    mock_query.tags = ["energy"]

    mock_articles = [
        {
            "id": "1",
            "title": "Oil up 5%",
            "url": "https://example.com/oil",
            "description": "Crude rises on conflict fears.",
            "published_date": "2026-01-01T12:00:00+00:00",
            "source": "reuters.com",
            "tickers": ["XOM"],
            "tags": ["energy"],
        }
    ]

    with patch("workflows.situational_awareness.get_llm_extraction") as mock_llm_fn, \
         patch("services.tiingo.fetch_tiingo_news", return_value=mock_articles):

        mock_structured = MagicMock()
        mock_structured.invoke.return_value = mock_query
        mock_llm = MagicMock()
        mock_llm.with_structured_output.return_value = mock_structured
        mock_llm_fn.return_value = mock_llm

        from workflows.situational_awareness import financial_news_agent
        result = financial_news_agent(_make_events_state())

    assert "financial_signals" in result
    assert len(result["financial_signals"]) == 1
    assert result["financial_signals"][0]["title"] == "Oil up 5%"


def test_agent_returns_empty_without_api_key(monkeypatch):
    monkeypatch.delenv("TIINGO_API_KEY", raising=False)

    from workflows.situational_awareness import financial_news_agent
    result = financial_news_agent(_make_events_state())

    assert result == {"financial_signals": []}
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd /path/to/newsflash/ai-service && python -m pytest tests/test_financial_news_agent.py -v 2>&1 | tail -8
```

Expected: `ImportError` or `AttributeError` — `financial_news_agent` not defined yet.

- [ ] **Step 3: Add `FinancialNewsItem` TypedDict to `situational_awareness.py`**

Read `situational_awareness.py` first. Add after the `InfrastructureCorrelation` TypedDict (around line 44):

```python
class FinancialNewsItem(TypedDict):
    id: str
    title: str
    url: str
    description: str
    published_date: str
    source: str
    tickers: list[str]
    tags: list[str]
```

- [ ] **Step 4: Add `financial_signals` to `SituationalAwarenessState`**

In the `SituationalAwarenessState` TypedDict, add after `infrastructure_impacts`:

```python
    financial_signals: Annotated[list[FinancialNewsItem], operator.add]
```

- [ ] **Step 5: Update the settings import to include `tiingo`**

Change the existing import line at the top of `situational_awareness.py`:

```python
from config.settings import models as model_cfg, workflow as wf_cfg, cost as cost_cfg, tiingo as tiingo_cfg
```

- [ ] **Step 6: Implement `financial_news_agent`**

Add this function after `infrastructure_correlator_agent` and before `threat_assessment_agent`:

```python
def financial_news_agent(state: SituationalAwarenessState):
    """NODE 4: LLM determines relevant tickers/tags from events → fetches Tiingo financial news"""
    api_key = os.getenv("TIINGO_API_KEY")
    if not api_key:
        return {"financial_signals": []}

    significant_events = [e for e in state["geopolitical_events"] if e.get("severity") != "low"]
    if not significant_events:
        return {"financial_signals": []}

    # Ask LLM which financial instruments are affected by these events
    llm = get_llm_extraction()

    class TiingoQuery(BaseModel):
        tickers: list[str] = Field(
            description=(
                "Stock tickers most likely affected by these events "
                "(e.g. XOM, CVX for oil conflicts; TSM, NVDA for chip supply disruptions; "
                "LMT, RTX, NOC for military conflicts). ETFs like XLE, IEF are fine. Max 10."
            ),
            default_factory=list,
        )
        tags: list[str] = Field(
            description=(
                "Tiingo news tags relevant to the events. "
                "Choose from: energy, defense, technology, commodities, forex, "
                "financials, healthcare, materials, real-estate, utilities. Max 5."
            ),
            default_factory=list,
        )
        rationale: str = Field(description="One sentence explaining the financial relevance.")

    structured_llm = llm.with_structured_output(TiingoQuery)

    events_text = "\n".join(
        f"- [{e['severity'].upper()}] {e['event_type']}: {e['description'][:200]}"
        for e in significant_events
    )

    query = structured_llm.invoke(
        f"You are a financial analyst. Given these geopolitical events, identify "
        f"the financial instruments most likely to be impacted.\n\nEVENTS:\n{events_text}"
    )

    # Fetch Tiingo news with LLM-determined parameters
    from services.tiingo import fetch_tiingo_news

    articles = fetch_tiingo_news(
        tickers=query.tickers[: tiingo_cfg.max_tickers],
        tags=query.tags[:5],
        limit=tiingo_cfg.news_limit,
        api_key=api_key,
    )

    return {"financial_signals": articles}
```

- [ ] **Step 7: Run tests — expect PASS**

```bash
cd /path/to/newsflash/ai-service && python -m pytest tests/test_financial_news_agent.py -v 2>&1 | tail -8
```

Expected: `2 passed`

- [ ] **Step 8: Commit**

```bash
git add ai-service/src/workflows/situational_awareness.py ai-service/tests/test_financial_news_agent.py
git commit -m "feat: add financial_news_agent with LLM-driven Tiingo query parameter generation"
```

---

## Task 4: Wire Agent Into Workflow + Update Downstream Nodes

**Files:**
- Modify: `ai-service/src/workflows/situational_awareness.py` (workflow edges, threat_assessment context, output_formatter, analyze_situation initial state)
- Modify: `ai-service/tests/test_output_formatter.py`

> **Dependency note:** This task modifies the same `situational_awareness.py` as Task 3. Ensure Task 3 is committed first. Read the file before editing to see current state.

- [ ] **Step 1: Update `test_output_formatter.py` — add `financial_signals` to `make_state()`**

Read `ai-service/tests/test_output_formatter.py` first. Update `make_state()` to accept and include `financial_signals`:

```python
def make_state(events=None, impacts=None, threat_level="medium", recommendations=None,
               token_usage=150, financial_signals=None):
    return {
        "query": "test",
        "news_articles": [{"id": "1", "title": "t", "content": "c", "source": "s",
                           "published_at": "", "url": "", "embedding": [], "relevance_score": 0.9}],
        "geopolitical_events": events or [{"event_type": "conflict", "actors": ["A"], "location": "X",
                                           "date": "2026-01-01", "severity": "high", "description": "d"}],
        "infrastructure_impacts": impacts or [{"event_id": "e1", "infrastructure_ids": ["f1"],
                                               "distance_km": 50.0, "correlation_score": 0.7,
                                               "risk_assessment": "risk"}],
        "financial_signals": financial_signals or [],
        "threat_assessment": "Significant risks observed in the region.",
        "threat_level": threat_level,
        "recommendations": recommendations or ["Monitor closely"],
        "token_usage": token_usage,
        "final_report": "",
    }
```

Also add one new test at the end of the file:

```python
def test_output_formatter_includes_financial_signals():
    signals = [{"id": "1", "title": "Oil up", "url": "u", "description": "d",
                "published_date": "2026-01-01", "source": "reuters.com",
                "tickers": ["XOM"], "tags": ["energy"]}]
    state = make_state(financial_signals=signals)
    result_state = output_formatter(state)
    report = json.loads(result_state["final_report"])
    assert isinstance(report["financial_signals"], list)
    assert len(report["financial_signals"]) == 1
    assert report["financial_signals"][0]["title"] == "Oil up"
```

- [ ] **Step 2: Run existing tests — expect FAIL on new test only**

```bash
cd /path/to/newsflash/ai-service && python -m pytest tests/test_output_formatter.py -v 2>&1 | tail -10
```

Expected: 4 old tests PASS, 1 new test FAIL (KeyError `financial_signals`).

- [ ] **Step 3: Update `output_formatter` to include financial_signals**

Read the current `output_formatter` in `situational_awareness.py`. Replace it:

```python
def output_formatter(state: SituationalAwarenessState):
    """NODE 6: Format results for frontend"""
    token_usage = state.get("token_usage", 0)
    financial_signals = state.get("financial_signals", [])
    final_report = {
        "timestamp": str(datetime.datetime.now()),
        "threat_level": state.get("threat_level", "unknown"),
        "total_articles": len(state["news_articles"]),
        "geopolitical_events": state["geopolitical_events"],
        "infrastructure_at_risk": state["infrastructure_impacts"],
        "financial_signals": financial_signals,
        "recommendations": state.get("recommendations", []),
        "token_usage": token_usage,
        "cost_usd": round(token_usage * _COST_PER_TOKEN_USD, 6),
    }

    return {"final_report": json.dumps(final_report, indent=2)}
```

- [ ] **Step 4: Run output_formatter tests — expect PASS**

```bash
cd /path/to/newsflash/ai-service && python -m pytest tests/test_output_formatter.py -v 2>&1 | tail -8
```

Expected: `5 passed`

- [ ] **Step 5: Update `threat_assessment_agent` to include financial signals in context**

Read `threat_assessment_agent`. Replace the `context = f"""..."""` block:

```python
    context = f"""
    GEOPOLITICAL SITUATION REPORT

    EVENTS: {json.dumps(state['geopolitical_events'], indent=2)}

    INFRASTRUCTURE AT RISK: {json.dumps(state['infrastructure_impacts'], indent=2)}

    FINANCIAL SIGNALS: {json.dumps([{
        'title': f['title'],
        'source': f['source'],
        'tickers': f['tickers'],
        'tags': f['tags'],
    } for f in state.get('financial_signals', [])[:5]], indent=2)}

    NEWS ARTICLES: {json.dumps([{
        'title': a['title'],
        'source': a['source'],
        'relevance': a['relevance_score']
    } for a in state['news_articles'][:5]], indent=2)}

    Generate a concise threat assessment for decision-makers, incorporating financial market signals where relevant.
    """
```

- [ ] **Step 6: Wire `financial_news` node into workflow and update edges**

In `build_situational_awareness_workflow()`, add the new node and update edges:

```python
def build_situational_awareness_workflow():
    """Build the LangGraph workflow"""
    workflow = StateGraph(SituationalAwarenessState)

    # Add nodes
    workflow.add_node("news_aggregation", news_aggregation_agent)
    workflow.add_node("geopolitical_analyst", geopolitical_analyst_agent)
    workflow.add_node("infrastructure_correlator", infrastructure_correlator_agent)
    workflow.add_node("financial_news", financial_news_agent)          # NEW
    workflow.add_node("threat_assessment", threat_assessment_agent)
    workflow.add_node("output_formatter", output_formatter)

    # Define edges
    workflow.add_edge(START, "news_aggregation")
    workflow.add_edge("news_aggregation", "geopolitical_analyst")
    workflow.add_edge("geopolitical_analyst", "infrastructure_correlator")
    workflow.add_edge("infrastructure_correlator", "financial_news")   # NEW
    workflow.add_edge("financial_news", "threat_assessment")           # CHANGED
    workflow.add_edge("threat_assessment", "output_formatter")
    workflow.add_edge("output_formatter", END)

    return workflow.compile()
```

- [ ] **Step 7: Add `financial_signals` to `analyze_situation()` initial state**

In `analyze_situation()`, add `"financial_signals": []` to the `initial_state` dict:

```python
    initial_state = {
        "query": query,
        "news_articles": [],
        "geopolitical_events": [],
        "infrastructure_impacts": [],
        "financial_signals": [],
        "threat_assessment": "",
        "threat_level": "",
        "token_usage": 0,
        "recommendations": [],
        "final_report": ""
    }
```

- [ ] **Step 8: Run all ai-service tests**

```bash
cd /path/to/newsflash/ai-service && python -m pytest tests/ -v 2>&1 | tail -15
```

Expected: all tests pass (6 existing + 1 new output_formatter test + 2 financial_news_agent + 4 tiingo_client = 13 total).

- [ ] **Step 9: Commit**

```bash
git add ai-service/src/workflows/situational_awareness.py ai-service/tests/test_output_formatter.py
git commit -m "feat: wire financial_news_agent into workflow, enrich threat assessment with financial signals"
```

---

## Task 5: Update AnalysisResponse in main.py

**Files:**
- Modify: `ai-service/src/main.py`

- [ ] **Step 1: Read current main.py**

Read `ai-service/src/main.py` to see the current `AnalysisResponse` model and the endpoint.

- [ ] **Step 2: Add `financial_signals` to `AnalysisResponse`**

In the `AnalysisResponse` Pydantic model, add:

```python
    financial_signals: List[dict] = []
```

(After `infrastructure_at_risk: List[dict]`)

- [ ] **Step 3: Pass `financial_signals` through in the endpoint**

In the `analyze_situation` endpoint, add to the `AnalysisResponse(...)` constructor call:

```python
            financial_signals=result.get("financial_signals", []),
```

- [ ] **Step 4: Verify syntax**

```bash
cd /path/to/newsflash/ai-service/src && python -c "import ast; ast.parse(open('main.py').read()); print('OK')"
```

Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add ai-service/src/main.py
git commit -m "feat: add financial_signals field to AnalysisResponse"
```

---

## Task 6: Tiingo Smoke Test

**Files:**
- Modify: `scripts/test-apis.js`

- [ ] **Step 1: Add `testTiingo()` to scripts/test-apis.js**

Read `scripts/test-apis.js` first. Add this function before the `// ── Run all ───` section:

```js
async function testTiingo() {
  const key = process.env.TIINGO_API_KEY;
  if (!key) return skip('Tiingo financial news', 'TIINGO_API_KEY not set');
  try {
    const url = `https://api.tiingo.com/tiingo/news?token=${key}&tickers=xom&limit=1`;
    const res = await get(url, { 'Content-Type': 'application/json' });
    const data = JSON.parse(res.body);
    if (res.status === 200 && Array.isArray(data) && data.length > 0) {
      const a = data[0];
      pass('Tiingo financial news', `"${a.title?.slice(0, 50)}" (${a.source})`);
    } else if (res.status === 401 || res.status === 403) {
      fail('Tiingo financial news', 'invalid or expired API token');
    } else if (res.status === 200 && Array.isArray(data) && data.length === 0) {
      pass('Tiingo financial news', 'connected — no XOM articles at this moment');
    } else {
      fail('Tiingo financial news', `HTTP ${res.status}: ${res.body.slice(0, 120)}`);
    }
  } catch (e) { fail('Tiingo financial news', e.message); }
}
```

- [ ] **Step 2: Call `testTiingo()` in the run block**

In the `(async () => { ... })()` block, add `await testTiingo();` after the existing test calls (before the summary lines).

- [ ] **Step 3: Add TIINGO_API_KEY to .env.local**

The TIINGO_API_KEY is already in `.env.local`:
```
TIINGO_API_KEY=184bec2203d29563927ea8b44d9e269376bc96fc
```
The script already loads `.env.local` at startup, so no code change needed.

- [ ] **Step 4: Run the smoke tests**

```bash
node /path/to/newsflash/scripts/test-apis.js
```

Expected: Tiingo shows PASS (or SKIP if key not in env).

- [ ] **Step 5: Commit**

```bash
git add scripts/test-apis.js
git commit -m "feat: add Tiingo smoke test to scripts/test-apis.js"
```

---

## Verification Checklist

After all tasks are complete:

- [ ] `cd ai-service && python -m pytest tests/ -v` — all 13 tests pass
- [ ] `node scripts/test-apis.js` — Tiingo PASS (key is in .env.local)
- [ ] `cd ai-service/src && python -c "from workflows.situational_awareness import build_situational_awareness_workflow; g = build_situational_awareness_workflow(); print([n for n in g.nodes])"` — `financial_news` appears in the node list
- [ ] `cd ai-service/src && python -c "from config.settings import tiingo; print(tiingo.news_limit)"` — prints `10`
