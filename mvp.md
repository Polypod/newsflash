# Production-Grade AI-Powered Situational Awareness MVP

**Complete Specification: Global News, Conflicts & Infrastructure Monitoring Platform**

**Timeline**: 12 weeks to production-ready MVP
**Team Size**: 2-3 engineers (backend, frontend, DevOps)
**Infrastructure Cost**: $5-10k/month (dev + production)

---

## EXECUTIVE SUMMARY

This MVP builds a **unified situational awareness platform** that aggregates real-time news, geopolitical events, and energy/aviation infrastructure data through LangGraph-powered AI agents.

**Core Capabilities:**
- ✅ Real-time news ingestion (30+ sources + Telegram OSINT)
- ✅ AI-powered geopolitical event extraction (Claude 3.5)
- ✅ Spatial correlation (events ↔ infrastructure via PostGIS)
- ✅ Automated threat assessment & recommendations
- ✅ Interactive dashboard with WebSocket updates
- ✅ Token budgeting ($5k/month for LLM operations)

---

## FULL SYSTEM ARCHITECTURE

```
┌──────────────────────────────────────────────────────────────────┐
│                      PRESENTATION LAYER                         │
│          React 18 + Mapbox GL JS v3 + D3.js + Recharts         │
│                    Real-time dashboard UI                       │
└──────────────────────────────────────────────────────────────────┘
                           │ WebSocket + REST (/api/v1)
┌──────────────────────────────────────────────────────────────────┐
│              AI INTELLIGENCE ORCHESTRATION LAYER                 │
│  LangGraph Multi-Agent Reasoning System (Python)                │
│  ├─ News Aggregation Agent (RAG + Chroma)                       │
│  ├─ Geopolitical Analyst Agent (LLM extraction)                 │
│  ├─ Infrastructure Correlator Agent (PostGIS spatial)           │
│  └─ Threat Assessment Agent (synthesis & recommendations)       │
└──────────────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────────────────────────────────────────────┐
│                      API GATEWAY LAYER                           │
│   Express.js v4 + Rate Limiting + JWT Auth + Versioning         │
└──────────────────────────────────────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
┌────────┴───────┐ ┌───────┴────────┐ ┌──────┴────────┐
│  DATA LAYER    │ │ LOGIC LAYER   │ │ CACHE LAYER  │
│ (Aggregation)  │ │  (Business)   │ │  (Redis)     │
└────────────────┘ └────────────────┘ └──────────────┘
         │                 │                 │
         └─────────────────┼─────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
   ┌─────┴─────┐   ┌───────┴──────┐  ┌──────┴──────┐
   │PostgreSQL │   │   External   │  │   Queue    │
   │ + PostGIS │   │   APIs +     │  │  (Bull)    │
   │ + pgvector│   │   LLMs       │  │  + Chroma  │
   └───────────┘   │  (Claude,    │  │  (RAG)     │
                   │   GPT, local)│  │            │
                   └──────────────┘  └────────────┘
```

---

## LAYER 1: FRONTEND (React 18 + Mapbox GL)

### Technology Stack

| Component | Technology | Why |
|-----------|-----------|-----|
| **Framework** | React 18 | Industry standard, component reusability, hooks |
| **State Management** | Context API + useReducer | Simple for MVP, scale to Redux later |
| **Routing** | React Router v6 | Nested routes, lazy loading |
| **Map Visualization** | Mapbox GL JS v3 + react-map-gl | WebGL performance, geospatial data |
| **Data Viz** | D3.js + Recharts | D3 for complex charts, Recharts for UI |
| **HTTP Client** | Axios + Socket.io-client | REST + real-time WebSocket |
| **Styling** | Tailwind CSS + CSS Modules | Utility-first, design tokens |
| **Build Tool** | Vite | 10x faster than CRA, ESM-native |
| **Testing** | Vitest + React Testing Library | Fast, React-focused |

### Directory Structure

```
frontend/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── SituationalAwareness/
│   │   │   ├── DashboardContainer.jsx (main layout)
│   │   │   ├── ThreatGauge.jsx (real-time threat level)
│   │   │   ├── EventTimeline.jsx (geopolitical events)
│   │   │   ├── InfrastructureRiskMap.jsx (Mapbox correlations)
│   │   │   ├── NewsIntelligence.jsx (AI-analyzed articles)
│   │   │   ├── RecommendationsPanel.jsx (AI suggestions)
│   │   │   └── AnalysisMetadata.jsx (tokens, cost, time)
│   │   ├── Map/
│   │   │   ├── MapContainer.jsx
│   │   │   ├── ConflictLayer.jsx
│   │   │   ├── EnergyLayer.jsx
│   │   │   ├── FlightLayer.jsx
│   │   │   └── CorrelationOverlay.jsx
│   │   ├── Charts/
│   │   │   ├── TimeSeriesChart.jsx
│   │   │   ├── StatsCard.jsx
│   │   │   ├── ThreatHistoryChart.jsx
│   │   │   ├── SentimentAnalysisChart.jsx
│   │   │   └── CorrelationMatrix.jsx
│   │   ├── Filters/
│   │   │   ├── RegionFilter.jsx
│   │   │   ├── ThreatLevelFilter.jsx
│   │   │   ├── TimeRangeFilter.jsx
│   │   │   └── DataSourceFilter.jsx
│   │   └── Layout/
│   │       ├── Header.jsx
│   │       └── Footer.jsx
│   ├── hooks/
│   │   ├── useWebSocket.js
│   │   ├── useSituationalAwareness.js
│   │   ├── useGeospatialData.js
│   │   └── useMapInteraction.js
│   ├── services/
│   │   ├── api.js (Axios instance)
│   │   ├── wsService.js (WebSocket)
│   │   └── mapUtils.js (Mapbox helpers)
│   ├── context/
│   │   ├── DataContext.js
│   │   └── FilterContext.js
│   ├── utils/
│   │   ├── geoUtils.js
│   │   ├── timeUtils.js
│   │   └── constants.js
│   ├── styles/
│   │   ├── index.css (design tokens)
│   │   └── mapbox-overrides.css
│   ├── App.jsx
│   └── main.jsx
├── vite.config.js
├── package.json
└── .env.example
```

### Key React Hook: Situational Awareness

```javascript
// src/hooks/useSituationalAwareness.js
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

export function useSituationalAwareness() {
  const [data, setData] = useState(null);
  const [threatLevel, setThreatLevel] = useState('low');
  const [isLoading, setIsLoading] = useState(false);
  
  useEffect(() => {
    const socket = io(process.env.REACT_APP_WS_URL, {
      transports: ['websocket'],
    });

    socket.on('threat-alert', (payload) => {
      setThreatLevel(payload.severity);
      setData(prev => ({
        ...prev,
        events: [...(prev?.events || []), payload.event],
        lastUpdate: new Date().toISOString()
      }));
    });

    socket.on('analysis:complete', (result) => {
      setData(result);
      setIsLoading(false);
    });

    return () => socket.disconnect();
  }, []);

  const triggerAnalysis = async (query) => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/analyze/situation`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query })
        }
      );
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Analysis request failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return { data, threatLevel, isLoading, triggerAnalysis };
}
```

---

## LAYER 2: AI INTELLIGENCE ORCHESTRATION (LangGraph + Python)

### LangGraph Workflow Architecture

**Four Parallel AI Agents:**

1. **News Aggregation Agent** (RAG)
   - Queries Chroma vector DB for semantically relevant articles
   - Returns 20 most relevant articles based on user query

2. **Geopolitical Analyst Agent** (Claude 3.5)
   - Extracts events: conflict, diplomatic, trade, military, cyber
   - Identifies actors, locations, severity, descriptions

3. **Infrastructure Correlator Agent** (PostGIS)
   - Spatial query: "Find infrastructure within 200km of events"
   - Calculates correlation scores + risk assessments

4. **Threat Assessment Agent** (Claude 3.5)
   - Synthesizes all data into integrated threat level
   - Generates actionable recommendations & monitoring priorities

### LangGraph Implementation

```python
# src/ai/workflows/situational_awareness.py
from typing import Annotated, TypedDict, Literal
from langgraph.graph import StateGraph, START, END
from langgraph.types import Send
from langchain_anthropic import ChatAnthropic
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
import operator
import json

# ============= STATE SCHEMA =============

class NewsArticle(TypedDict):
    id: str
    title: str
    content: str
    source: str
    published_at: str
    url: str
    embedding: list[float]
    relevance_score: float

class GeopoliticalEvent(TypedDict):
    event_type: str
    actors: list[str]
    location: str
    date: str
    severity: Literal["low", "medium", "high", "critical"]
    description: str

class InfrastructureCorrelation(TypedDict):
    event_id: str
    infrastructure_ids: list[str]
    distance_km: float
    correlation_score: float
    risk_assessment: str

class SituationalAwarenessState(TypedDict):
    query: str
    news_articles: Annotated[list[NewsArticle], operator.add]
    geopolitical_events: Annotated[list[GeopoliticalEvent], operator.add]
    infrastructure_impacts: Annotated[list[InfrastructureCorrelation], operator.add]
    threat_assessment: str
    recommendations: list[str]
    final_report: str

# ============= INITIALIZE LLMs =============

llm_primary = ChatAnthropic(
    model="claude-3-5-sonnet-20241022",
    temperature=0.3,
    max_tokens=2000
)

llm_extraction = ChatOpenAI(
    model="gpt-4o-mini",
    temperature=0.1,
    max_tokens=1000
)

embeddings = OpenAIEmbeddings(model="text-embedding-3-large")

# ============= AGENT NODES =============

def news_aggregation_agent(state: SituationalAwarenessState):
    """NODE 1: Semantic search for relevant articles"""
    from langchain_chroma import Chroma
    
    vectorstore = Chroma(
        collection_name="news_articles",
        embedding_function=embeddings,
        persist_directory="./chroma_db"
    )
    
    retriever = vectorstore.as_retriever(search_kwargs={"k": 20})
    docs = retriever.invoke(state["query"])
    
    articles = []
    for doc in docs:
        articles.append({
            "id": doc.metadata.get("id"),
            "title": doc.metadata.get("title"),
            "content": doc.page_content,
            "source": doc.metadata.get("source"),
            "published_at": doc.metadata.get("published_at"),
            "url": doc.metadata.get("url"),
            "embedding": doc.metadata.get("embedding"),
            "relevance_score": doc.metadata.get("relevance_score", 0.8)
        })
    
    return {"news_articles": articles}


def geopolitical_analyst_agent(state: SituationalAwarenessState):
    """NODE 2: Extract geopolitical events with LLM"""
    from pydantic import BaseModel, Field
    
    class EventExtraction(BaseModel):
        events: list[dict] = Field(description="List of geopolitical events")
        analysis: str = Field(description="Contextual analysis")
    
    structured_llm = llm_primary.with_structured_output(EventExtraction)
    
    articles_context = "\n\n".join([
        f"[{a['source']}] {a['title']}\n{a['content'][:500]}..."
        for a in state["news_articles"]
    ])
    
    extraction_prompt = f"""
    Analyze these news articles and extract geopolitical events:
    
    {articles_context}
    
    For each event, identify:
    - event_type: 'conflict', 'diplomatic', 'trade', 'military', 'cyber'
    - actors: Countries/organizations involved
    - location: Geographic coordinates or region
    - date: When it occurred
    - severity: 'low', 'medium', 'high', 'critical'
    - description: 2-3 sentence summary
    """
    
    result = structured_llm.invoke(extraction_prompt)
    
    events = [
        {
            "event_type": e.get("event_type"),
            "actors": e.get("actors", []),
            "location": e.get("location"),
            "date": e.get("date"),
            "severity": e.get("severity"),
            "description": e.get("description")
        }
        for e in result.events
    ]
    
    return {"geopolitical_events": events}


def infrastructure_correlator_agent(state: SituationalAwarenessState):
    """NODE 3: Find infrastructure within 200km of events"""
    from sqlalchemy import text
    from src.config.database import get_db_pool
    
    correlations = []
    pool = get_db_pool()
    
    for event in state["geopolitical_events"]:
        if event["severity"] == "low":
            continue
        
        query = text("""
        WITH event_point AS (
          SELECT ST_SetSRID(ST_GeomFromText(:location), 4326) as geom
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
        """)
        
        with pool.connect() as conn:
            result = conn.execute(query, {"location": event["location"]})
            rows = result.fetchall()
        
        severity_multiplier = {
            "low": 0.3, "medium": 0.6, "high": 0.8, "critical": 1.0
        }[event["severity"]]
        
        for row in rows:
            facility_id, facility_type, distance_km, status, capacity = row
            correlation_score = max(0, 1.0 - (distance_km / 200)) * severity_multiplier
            
            if correlation_score > 0.3:
                correlations.append({
                    "event_id": event.get("id", "unknown"),
                    "infrastructure_ids": [str(facility_id)],
                    "distance_km": distance_km,
                    "correlation_score": correlation_score,
                    "risk_assessment": (
                        f"{event['event_type']} ({event['severity']}) "
                        f"at {distance_km:.1f}km from {facility_type}"
                    )
                })
    
    return {"infrastructure_impacts": correlations}


def threat_assessment_agent(state: SituationalAwarenessState):
    """NODE 4: Synthesize all data into threat assessment"""
    from pydantic import BaseModel, Field
    
    class ThreatAssessment(BaseModel):
        overall_threat_level: Literal["low", "medium", "high", "critical"]
        executive_summary: str
        key_risks: list[str]
        recommended_actions: list[str]
        monitoring_priorities: list[str]
    
    structured_llm = llm_primary.with_structured_output(ThreatAssessment)
    
    context = f"""
    GEOPOLITICAL SITUATION REPORT
    
    EVENTS: {json.dumps(state['geopolitical_events'], indent=2)}
    
    INFRASTRUCTURE AT RISK: {json.dumps(state['infrastructure_impacts'], indent=2)}
    
    NEWS ARTICLES: {json.dumps([{
        'title': a['title'],
        'source': a['source'],
        'relevance': a['relevance_score']
    } for a in state['news_articles'][:5]], indent=2)}
    
    Generate a concise threat assessment for decision-makers.
    """
    
    assessment = structured_llm.invoke(context)
    
    return {
        "threat_assessment": assessment.executive_summary,
        "recommendations": assessment.recommended_actions
    }


def output_formatter(state: SituationalAwarenessState):
    """NODE 5: Format results for frontend"""
    final_report = {
        "timestamp": str(datetime.datetime.now()),
        "threat_level": state.get("threat_assessment", "unknown"),
        "total_articles": len(state["news_articles"]),
        "geopolitical_events": len(state["geopolitical_events"]),
        "infrastructure_at_risk": len(state["infrastructure_impacts"]),
        "recommendations": state.get("recommendations", []),
        "events": state["geopolitical_events"],
        "correlations": state["infrastructure_impacts"]
    }
    
    return {"final_report": json.dumps(final_report, indent=2)}


# ============= BUILD WORKFLOW =============

workflow = StateGraph(SituationalAwarenessState)

workflow.add_node("news_aggregation", news_aggregation_agent)
workflow.add_node("geopolitical_analyst", geopolitical_analyst_agent)
workflow.add_node("infrastructure_correlator", infrastructure_correlator_agent)
workflow.add_node("threat_assessment", threat_assessment_agent)
workflow.add_node("output_formatter", output_formatter)

workflow.add_edge(START, "news_aggregation")
workflow.add_edge("news_aggregation", "geopolitical_analyst")
workflow.add_edge("geopolitical_analyst", "infrastructure_correlator")
workflow.add_edge("infrastructure_correlator", "threat_assessment")
workflow.add_edge("threat_assessment", "output_formatter")
workflow.add_edge("output_formatter", END)

situational_awareness_graph = workflow.compile()

# ============= INVOKE =============

async def analyze_situation(query: str) -> dict:
    """Entry point for analysis"""
    initial_state = {
        "query": query,
        "news_articles": [],
        "geopolitical_events": [],
        "infrastructure_impacts": [],
        "threat_assessment": "",
        "recommendations": [],
        "final_report": ""
    }
    
    result = situational_awareness_graph.invoke(initial_state)
    return json.loads(result["final_report"])
```

### Technology Stack for AI Layer

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Workflow Orchestration** | LangGraph v0.1+ | State management, multi-step workflows |
| **LLM Primary** | Claude 3.5 Sonnet | Complex reasoning, event extraction |
| **LLM Secondary** | GPT-4o-mini | Fast extraction, cost optimization |
| **Embeddings** | OpenAI text-embedding-3-large | Semantic search |
| **Vector DB** | Chroma (local) | News article storage + retrieval |
| **Memory** | LangGraph state + Redis | Session state across calls |
| **Tools** | LangChain tools + custom Python | External data + database queries |

---

## LAYER 3: API GATEWAY (Express.js)

### Technology Stack

| Component | Technology | Justification |
|-----------|-----------|---|
| **Framework** | Express.js v4+ | Lightweight, middleware ecosystem |
| **Authentication** | JWT + Passport | Stateless, scalable auth |
| **Validation** | Joi or Zod | Schema validation at entry |
| **Logging** | Winston + Morgan | Structured logging, correlation IDs |
| **Rate Limiting** | redis-rate-limiter | Distributed rate limits |
| **Documentation** | Swagger/OpenAPI 3.0 | Auto-generated API docs |
| **Error Handling** | Custom AppError class | Consistent error responses |

### Project Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── env.js
│   │   ├── database.js
│   │   └── redis.js
│   ├── middleware/
│   │   ├── auth.js
│   │   ├── errorHandler.js
│   │   ├── rateLimiter.js
│   │   └── validation.js
│   ├── routes/v1/
│   │   ├── conflicts.js
│   │   ├── energy.js
│   │   ├── flights.js
│   │   ├── analyze.js (AI endpoints)
│   │   └── correlations.js
│   ├── services/
│   │   ├── acledService.js
│   │   ├── eiaService.js
│   │   ├── aviationService.js
│   │   ├── cacheService.js
│   │   └── correlationService.js
│   ├── jobs/
│   │   ├── conflictPoller.js
│   │   ├── energyPoller.js
│   │   ├── flightPoller.js
│   │   └── newsIngestionPoller.js
│   ├── app.js
│   ├── server.js
│   └── index.js
├── tests/
├── Dockerfile
├── package.json
└── .env.example
```

### Express App Configuration

```javascript
// src/app.js
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const { errorHandler } = require('./middleware/errorHandler');
const { rateLimiter } = require('./middleware/rateLimiter');

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ limit: '10kb', extended: false }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/', rateLimiter);
app.use('/api/v1', require('./routes/v1'));
app.use('/api-docs', require('swagger-ui-express').serve);
app.get('/api-docs', require('swagger-ui-express').setup(swaggerSpec));

app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    code: 'NOT_FOUND',
    message: `Route ${req.method} ${req.path} not found`
  });
});

app.use(errorHandler);

module.exports = app;
```

### API Endpoints

```
GET /api/v1/conflicts
  ?bbox=-180,-90,180,90&startDate=2026-01-01&endDate=2026-12-31&limit=1000
  Response: { data: [...], meta: { total, hasMore } }

GET /api/v1/energy/facilities
  ?type=oil_refinery|power_plant&bbox=...
  Response: { data: [...] }

GET /api/v1/flights/active
  ?bbox=...&limit=500
  Response: { data: [...] }

POST /api/v1/analyze/situation
  {
    "query": "Latest developments in Middle East energy crisis",
    "include_infrastructure": true,
    "threat_level_threshold": "medium"
  }
  Response: {
    "timestamp": "2026-03-22T10:15:00Z",
    "threat_level": "high",
    "total_articles": 45,
    "geopolitical_events": [...],
    "infrastructure_at_risk": [...],
    "recommendations": [...]
  }

GET /api/v1/news/trending
  ?timeframe=24h&limit=10&category=geopolitical
  Response: { articles: [...] }

WebSocket: /ws
  Client: { action: "subscribe", channel: "conflicts|energy|flights|threats" }
  Server: { type: "data:update", channel: "...", data: {...} }
```

---

## LAYER 4: DATA LAYER

### Services Layer (Data Aggregation)

```javascript
// src/services/acledService.js
class ACLEDService {
  async fetchConflicts(options = {}) {
    // Fetch conflict events from ACLED API
    // Normalize into unified schema
    // Return array of conflict events
  }
}

// src/services/eiaService.js
class EIAService {
  async fetchOilPrices() { ... }
  async fetchProductionFacilities() { ... }
}

// src/services/aviationService.js
class AviationService {
  async fetchActiveFlight(bbox) { ... }
}
```

### Caching Strategy (Redis)

| Data Type | Key Pattern | TTL | Strategy |
|-----------|-------------|-----|----------|
| **ACLED Conflicts** | `conflicts:bbox:{bbox}:{date}` | 1 hour | Cache-Aside with lock |
| **EIA Prices** | `energy:oil_prices:daily` | 24 hours | Scheduled refresh |
| **Flight Positions** | `flights:bbox:{bbox}` | 5 minutes | Polling with TTL |
| **Correlations** | `correlation:{event_id}` | 6 hours | On-demand compute |
| **Analysis Cache** | `analysis:{query_hash}` | 24 hours | RAG deduplication |

---

## LAYER 5: DATABASE (PostgreSQL + PostGIS + pgvector)

### Schema

```sql
-- News articles with vector embeddings
CREATE TABLE news_articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source VARCHAR(100),
  external_id VARCHAR(500) UNIQUE,
  title VARCHAR(500),
  content TEXT,
  embedding vector(3072),
  published_at TIMESTAMP,
  ingested_at TIMESTAMP DEFAULT NOW(),
  sentiment VARCHAR(20),
  relevance_score NUMERIC(3, 2),
  threat_indicators TEXT[],
  url VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_news_embedding ON news_articles USING ivfflat(embedding vector_cosine_ops);
CREATE INDEX idx_news_published ON news_articles(published_at DESC);

-- Conflicts with geospatial indexing
CREATE TABLE conflicts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source VARCHAR(50),
  external_id VARCHAR(255) UNIQUE,
  title VARCHAR(255),
  description TEXT,
  event_type VARCHAR(100),
  severity VARCHAR(20),
  location GEOMETRY(Point, 4326),
  region VARCHAR(100),
  country VARCHAR(100),
  event_date DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_conflicts_location ON conflicts USING GIST(location);
CREATE INDEX idx_conflicts_event_date ON conflicts(event_date DESC);

-- Energy facilities
CREATE TABLE energy_facilities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source VARCHAR(50),
  external_id VARCHAR(255) UNIQUE,
  name VARCHAR(255),
  facility_type VARCHAR(100),
  location GEOMETRY(Point, 4326),
  capacity NUMERIC(12, 2),
  status VARCHAR(50),
  country VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_energy_location ON energy_facilities USING GIST(location);

-- Flights (real-time, auto-truncated after 24h)
CREATE TABLE flights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flight_number VARCHAR(20),
  aircraft_type VARCHAR(50),
  location GEOMETRY(Point, 4326),
  altitude NUMERIC(10, 2),
  speed NUMERIC(10, 2),
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_flights_timestamp ON flights(timestamp DESC);

-- Analysis cache for LLM queries
CREATE TABLE analysis_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  query_hash VARCHAR(255) UNIQUE,
  geopolitical_events JSONB,
  threat_assessment JSONB,
  recommendations JSONB,
  execution_time_ms INT,
  token_usage INT,
  cost_usd NUMERIC(8, 4),
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '24 hours'
);

-- Geospatial queries
SELECT c.id, c.title, ef.id, ef.name,
  ST_Distance(c.location::geography, ef.location::geography) / 1000 as distance_km
FROM conflicts c
CROSS JOIN energy_facilities ef
WHERE ST_DWithin(c.location::geography, ef.location::geography, 100000)
  AND c.event_date >= NOW() - INTERVAL '7 days'
ORDER BY distance_km ASC;
```

---

## LAYER 6: JOBS & BACKGROUND PROCESSING (Bull Queue)

### Job Configuration

```javascript
// src/jobs/queues.js
const Queue = require('bull');

// Conflicts: Hourly sync
const conflictQueue = new Queue('acled-conflicts', redisConfig);
conflictQueue.process(async (job) => {
  const acledService = require('../services/acledService');
  const conflicts = await acledService.fetchConflicts({
    startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  });
  await conflictRepo.upsertMany(conflicts);
  return { processed: conflicts.length };
});
conflictQueue.add({}, { repeat: { cron: '0 * * * *' } });

// Energy: Daily sync
const energyQueue = new Queue('eia-energy', redisConfig);
energyQueue.process(async (job) => {
  const eiaService = require('../services/eiaService');
  const prices = await eiaService.fetchOilPrices();
  const facilities = await eiaService.fetchProductionFacilities();
  await energyRepo.upsertPrices(prices);
  await energyRepo.upsertFacilities(facilities);
  return { processed: prices.length + facilities.length };
});
energyQueue.add({}, { repeat: { cron: '0 0 * * *' } });

// Aviation: Real-time (every 5 min)
const flightQueue = new Queue('aviation-flights', redisConfig);
flightQueue.process(async (job) => {
  const aviationService = require('../services/aviationService');
  const flights = await aviationService.fetchActiveFlight([-180, -90, 180, 90]);
  await flightRepo.upsertMany(flights);
  return { processed: flights.length };
});
flightQueue.add({}, { repeat: { every: 5 * 60 * 1000 } });

// News ingestion: Every 30 minutes
const newsQueue = new Queue('news-ingestion', redisConfig);
newsQueue.process(async (job) => {
  // Fetch from 30+ news sources
  // Generate embeddings (OpenAI API)
  // Store in Chroma vector DB
  // Cleanup old articles (>30 days)
  return { processed: articlesProcessed };
});
newsQueue.add({}, { repeat: { every: 30 * 60 * 1000 } });
```

---

## LAYER 7: VECTOR DATABASE (Chroma)

### Setup & Integration

```python
# src/services/chromaService.py
from chromadb.config import Settings
import chromadb
from langchain_openai import OpenAIEmbeddings
from fastapi import FastAPI

settings = Settings(
    chroma_db_impl="duckdb+parquet",
    persist_directory="./chroma_db",
    anonymized_telemetry=False
)

chroma_client = chromadb.Client(settings)
news_collection = chroma_client.get_or_create_collection(
    name="news_articles",
    metadata={"hnsw:space": "cosine"}
)

app = FastAPI()
embeddings = OpenAIEmbeddings(model="text-embedding-3-large")

@app.post("/chroma/add")
async def add_to_chroma(payload: dict):
    """Add articles to Chroma"""
    collection = chroma_client.get_or_create_collection(
        name=payload.get("collection", "news_articles")
    )
    
    ids = [doc["id"] for doc in payload["documents"]]
    contents = [doc["content"] for doc in payload["documents"]]
    metadatas = [doc.get("metadata", {}) for doc in payload["documents"]]
    
    collection.upsert(ids=ids, documents=contents, metadatas=metadatas)
    return {"status": "success", "count": len(payload["documents"])}

@app.post("/chroma/query")
async def query_chroma(payload: dict):
    """Query articles by semantic similarity"""
    collection = chroma_client.get_collection(
        name=payload.get("collection", "news_articles")
    )
    
    results = collection.query(
        query_texts=[payload["query"]],
        n_results=payload.get("n_results", 20),
        where={"published_at": {"$gte": (datetime.now() - timedelta(days=30)).isoformat()}}
    )
    
    return {
        "results": results["documents"][0],
        "distances": results["distances"][0],
        "metadatas": results["metadatas"][0]
    }
```

---

## LAYER 8: REAL-TIME UPDATES (Socket.io + WebSocket)

### WebSocket Server Implementation

```javascript
// src/websocket/socketHandler.js
const socketIO = require('socket.io');
const logger = require('../utils/logger');

class SocketHandler {
  constructor(server, redisClient) {
    this.io = socketIO(server, {
      cors: { origin: process.env.FRONTEND_URL },
      transports: ['websocket', 'polling']
    });
    this.redisClient = redisClient;
    this.setupHandlers();
  }

  setupHandlers() {
    this.io.on('connection', (socket) => {
      logger.info('User connected', { socketId: socket.id });

      socket.on('subscribe', (channel) => {
        socket.join(channel);
        logger.info('User subscribed', { socketId: socket.id, channel });
      });

      socket.on('unsubscribe', (channel) => {
        socket.leave(channel);
      });

      socket.on('disconnect', () => {
        logger.info('User disconnected', { socketId: socket.id });
      });
    });
  }

  broadcastConflictUpdate(data) {
    this.io.to('conflicts').emit('data:update', {
      type: 'conflict',
      timestamp: new Date().toISOString(),
      data
    });
  }

  broadcastThreatAlert(data) {
    this.io.to('threat-alerts').emit('threat-alert', {
      severity: data.severity,
      event: data,
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = SocketHandler;
```

---

## LAYER 9: CONTAINERIZATION & DEPLOYMENT

### Docker Compose (Local Development)

```yaml
version: '3.9'

services:
  postgres:
    image: postgis/postgis:15-3.3-alpine
    environment:
      POSTGRES_USER: appuser
      POSTGRES_PASSWORD: devpassword
      POSTGRES_DB: conflicts_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init.sql:/docker-entrypoint-initdb.d/init.sql

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://appuser:devpassword@postgres:5432/conflicts_db
      REDIS_URL: redis://redis:6379
      ACLED_EMAIL: ${ACLED_EMAIL}
      ACLED_PASSWORD: ${ACLED_PASSWORD}
      EIA_API_KEY: ${EIA_API_KEY}
      AVIATIONSTACK_API_KEY: ${AVIATIONSTACK_API_KEY}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
    ports:
      - "3001:3000"
    depends_on:
      - postgres
      - redis
    volumes:
      - ./backend/src:/app/src

  ai-service:
    build:
      context: ./ai-service
      dockerfile: Dockerfile.python
    environment:
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      CHROMA_DB_PATH: /app/chroma_db
      DATABASE_URL: postgresql://appuser:devpassword@postgres:5432/conflicts_db
      REDIS_URL: redis://redis:6379
    ports:
      - "8000:8000"
    depends_on:
      - postgres
      - redis
    volumes:
      - ./ai-service/src:/app/src
      - chroma_data:/app/chroma_db

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    environment:
      VITE_API_URL: http://localhost:3001/api/v1
      VITE_WS_URL: ws://localhost:3001/ws
      VITE_MAPBOX_TOKEN: ${MAPBOX_TOKEN}
    ports:
      - "5173:5173"
    depends_on:
      - backend
    volumes:
      - ./frontend/src:/app/src

volumes:
  postgres_data:
  redis_data:
  chroma_data:
```

### Kubernetes Deployment

```yaml
# k8s/backend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: conflicts-api
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: conflicts-api
  template:
    metadata:
      labels:
        app: conflicts-api
    spec:
      containers:
        - name: api
          image: gcr.io/my-project/conflicts-api:latest
          ports:
            - name: http
              containerPort: 3000
          env:
            - name: NODE_ENV
              value: production
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: app-secrets
                  key: database-url
          livenessProbe:
            httpGet:
              path: /health
              port: http
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /health
              port: http
            initialDelaySeconds: 5
            periodSeconds: 5
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: conflicts-api-service
spec:
  type: LoadBalancer
  ports:
    - protocol: TCP
      port: 80
      targetPort: 3000
  selector:
    app: conflicts-api
```

---

## COST OPTIMIZATION & TOKEN BUDGETING

### LLM Cost Model

| Operation | LLM | Tokens | Cost |
|-----------|-----|--------|------|
| News RAG query | GPT-4o-mini | 2,200 tokens | $0.006 |
| Geopolitical extraction | Claude 3.5 | 3,500 tokens | $0.08 |
| Infrastructure correlation | GPT-4o-mini | 1,800 tokens | $0.004 |
| Threat synthesis | Claude 3.5 | 5,800 tokens | $0.14 |
| **Per analysis** | | **13,300 tokens** | **$0.23** |
| **Monthly (21,700 analyses)** | | **~288M tokens** | **$5,000** |

### Cost Optimizer

```python
# src/services/costOptimizer.py
class CostOptimizer:
    def __init__(self, monthly_budget_usd=5000):
        self.monthly_budget = monthly_budget_usd
        self.daily_limit = monthly_budget_usd / 30
    
    async def run_with_budget(self, workflow_fn):
        today_spend = await self.get_today_spend()
        remaining_today = self.daily_limit - today_spend
        
        if remaining_today < 1.0:
            logger.warn('Daily budget exhausted, using cached analysis')
            return await self.run_cached_analysis()
        
        try:
            result = await workflow_fn()
            token_cost = result.get('cost_usd', 0)
            
            if today_spend + token_cost > self.daily_limit:
                return await self.run_with_fallback_model(workflow_fn)
            
            return result
        except Exception as e:
            raise

cost_optimizer = CostOptimizer(monthly_budget_usd=5000)
result = await cost_optimizer.run_with_budget(lambda: situational_awareness_graph.invoke(...))
```

---

## IMPLEMENTATION ROADMAP (12 WEEKS)

### Phase 1: Foundation + RAG Setup (Weeks 1-2)
- [x] Backend + frontend + database setup
- [x] Chroma vector DB + embedding service
- [x] PostgreSQL + PostGIS schema
- [x] Redis cache setup

### Phase 2: API Layer + Data Ingestion (Weeks 3-4)
- [ ] Express API gateway + middleware
- [ ] ACLED, EIA, AviationStack integration
- [ ] News ingestion poller (30+ sources)
- [ ] Bull job queues

### Phase 3: Frontend MVP (Weeks 5-6)
- [ ] React app scaffold with Vite
- [ ] Mapbox GL integration + layers
- [ ] Data visualization (charts, timeline)
- [ ] Filter panel + controls

### Phase 4: LangGraph Workflows (Weeks 7-8)
- [ ] News aggregation agent (RAG)
- [ ] Geopolitical analyst agent (LLM extraction)
- [ ] Infrastructure correlator (PostGIS queries)
- [ ] Threat assessment agent (synthesis)

### Phase 5: Real-Time Integration (Weeks 9-10)
- [ ] Socket.io WebSocket setup
- [ ] Real-time threat alerts
- [ ] Dashboard subscriptions
- [ ] End-to-end workflow testing

### Phase 6: Production & DevOps (Weeks 11-12)
- [ ] Docker compose + Kubernetes manifests
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Monitoring (Prometheus + Grafana)
- [ ] Cost tracking + billing integration

---

## API SUMMARY

### Core Endpoints

```
POST /api/v1/analyze/situation
  → LangGraph workflow execution
  → Returns threat assessment + recommendations

GET /api/v1/conflicts
  ?bbox=...&startDate=...&endDate=...&limit=1000

GET /api/v1/energy/facilities
  ?type=oil_refinery|power_plant&bbox=...

GET /api/v1/flights/active
  ?bbox=...&limit=500

GET /api/v1/news/trending
  ?timeframe=24h&limit=10&category=geopolitical

GET /api/v1/correlations/events/:eventId
  → Nearby infrastructure + historical correlations

WebSocket /ws
  → Real-time threat alerts & data updates
```

---

## PRODUCTION READINESS CHECKLIST

- [ ] LangGraph workflows tested with 100+ edge cases
- [ ] Cost tracking + daily budget alerts
- [ ] Chroma vector DB with 30-day retention
- [ ] Error handling + fallback LLM models
- [ ] Monitoring dashboards (Grafana)
- [ ] Cache invalidation strategies
- [ ] Rate limiting on all endpoints
- [ ] Load testing (100 concurrent analyses)
- [ ] API key rotation + secrets management
- [ ] Full documentation + deployment guide
- [ ] Security audit (OWASP Top 10)
- [ ] Disaster recovery plan

---

## KEY DECISIONS & RATIONALE

| Decision | Choice | Why |
|----------|--------|-----|
| **Frontend Framework** | React 18 + Vite | Fast dev cycle, large ecosystem |
| **Backend** | Node.js + Express | Single language, real-time capable |
| **AI Orchestration** | LangGraph | State management, parallelization |
| **Vector DB** | Chroma | Local-first, easy setup |
| **Spatial DB** | PostGIS | Proven, mature, optimal for geospatial |
| **Real-Time** | Socket.io | Fallback transports, wide support |
| **Caching** | Redis | Atomic ops, distributed locks |
| **Deployment** | Docker + K8s | Industry standard, scalable |
| **Cost Model** | Token budgeting | Predictable, bounded LLM costs |

---

## SUCCESS METRICS

✅ **Performance**
- Analysis latency: <30 seconds (P95)
- Dashboard load time: <2 seconds
- Real-time alert latency: <5 seconds

✅ **Reliability**
- API uptime: 99.9%
- LLM fallback success rate: >98%
- Data freshness: Conflicts hourly, flights 5-min

✅ **Cost**
- LLM cost per analysis: <$0.25
- Monthly budget adherence: ±5%
- Infrastructure cost: <$8k/month

✅ **Intelligence**
- Geopolitical event extraction accuracy: >85%
- Correlation relevance score: >0.7
- False positive threat alerts: <5%

---

## DELIVERABLES

### Code
- ✅ Complete backend (Express + Bull queues)
- ✅ Complete frontend (React + Mapbox)
- ✅ Python AI service (LangGraph workflows)
- ✅ Database schema (PostgreSQL + PostGIS)
- ✅ Docker compose + Kubernetes manifests

### Documentation
- ✅ API specification (OpenAPI)
- ✅ Architecture diagrams
- ✅ Deployment guide
- ✅ Operational runbook
- ✅ Cost analysis

### Infrastructure
- ✅ Local development environment
- ✅ Staging deployment
- ✅ Production deployment
- ✅ CI/CD pipeline
- ✅ Monitoring setup

---

## NEXT STEPS

1. **Initialize Repos**: Create GitHub repos (backend, frontend, ai-service, infra)
2. **Setup Local Dev**: `docker-compose up` to validate stack
3. **Register APIs**: ACLED (free), EIA, AviationStack, Mapbox, OpenAI, Anthropic
4. **Phase 1 Start**: Database schema + Redis cache
5. **Phase 2 Start**: API layer + data integrations
6. **Phase 3 Start**: Frontend + Mapbox integration
7. **Phase 4 Start**: LangGraph workflows
8. **Phase 5 Start**: Real-time updates + testing
9. **Phase 6 Start**: Docker + Kubernetes deployment

**Estimated Team**: 2-3 engineers
**Time to MVP**: 12 weeks
**Total Infrastructure**: $5-10k/month
