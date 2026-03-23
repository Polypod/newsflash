# Newsflash — AI-Powered Situational Awareness Platform

A production-grade platform that aggregates real-time news, geopolitical events, and energy/aviation infrastructure data through LangGraph-powered AI agents, delivering automated threat assessments via an interactive dashboard.

**Timeline**: 12 weeks to production-ready MVP
**Infrastructure Cost**: ~$5–10k/month (dev + production)

---

## Core Capabilities

- Real-time news ingestion (30+ sources + Telegram OSINT)
- AI-powered geopolitical event extraction (Claude 3.5 Sonnet)
- Spatial correlation — events ↔ infrastructure via PostGIS
- Automated threat assessment & actionable recommendations
- Interactive dashboard with WebSocket real-time updates
- Token budgeting (~$5k/month for LLM operations)

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER                        │
│        React 18 + Mapbox GL JS v3 + D3.js + Recharts         │
└──────────────────────────────────────────────────────────────┘
                         │ WebSocket + REST (/api/v1)
┌──────────────────────────────────────────────────────────────┐
│           AI INTELLIGENCE ORCHESTRATION LAYER                 │
│   LangGraph Multi-Agent Reasoning System (Python)            │
│   ├─ News Aggregation Agent        (RAG + Chroma)            │
│   ├─ Geopolitical Analyst Agent    (LLM extraction)          │
│   ├─ Infrastructure Correlator     (PostGIS spatial)         │
│   └─ Threat Assessment Agent       (synthesis)               │
└──────────────────────────────────────────────────────────────┘
                         │
┌──────────────────────────────────────────────────────────────┐
│                    API GATEWAY LAYER                          │
│     Express.js v4 · Rate Limiting · JWT Auth · Versioning    │
└──────────────────────────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
   PostgreSQL        Bull Queue        Redis Cache
   + PostGIS         + Chroma RAG
   + pgvector
```

### LangGraph Workflow

```
START → News Aggregation → Geopolitical Analyst → Infrastructure Correlator → Threat Assessment → Output Formatter → END
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, Mapbox GL JS v3, D3.js, Recharts |
| API | Express.js v4, JWT Auth, Socket.io |
| AI Orchestration | LangGraph (Python), Claude 3.5 Sonnet, GPT-4o-mini |
| Embeddings | OpenAI Embeddings + Chroma Vector DB |
| Database | PostgreSQL + PostGIS + pgvector |
| Cache | Redis |
| Queue | Bull |
| Infra | Kubernetes (3 namespaces: app, data, monitoring) |
| Monitoring | Prometheus + Grafana |

---

## Project Structure

```
newsflash/
├── frontend/        # React 18 + Vite dashboard
├── backend/         # Express.js API gateway
├── ai-service/      # Python LangGraph multi-agent system
├── scripts/         # Utility & deployment scripts
└── docker-compose.yml
```

### Frontend Components

| Component | Purpose |
|---|---|
| `DashboardContainer` | Main layout |
| `ThreatGauge` | Real-time threat level indicator |
| `EventTimeline` | Geopolitical event feed |
| `InfrastructureRiskMap` | Mapbox spatial correlation overlay |
| `NewsIntelligence` | AI-analyzed article viewer |
| `RecommendationsPanel` | AI-generated recommendations |
| `AnalysisMetadata` | Token usage, cost, and timing |

### Backend Services

| Service | Purpose |
|---|---|
| `ACLEDService` | Conflict event data (hourly) |
| `EIAService` | Energy infrastructure data (daily) |
| `AviationService` | Flight data (every 5 min) |
| `CacheService` | Redis operations |
| `CorrelationService` | Spatial analysis via PostGIS |

---

## External APIs

| API | Usage |
|---|---|
| Claude 3.5 Sonnet | Event extraction, threat assessment |
| GPT-4o-mini | Secondary LLM tasks |
| OpenAI Embeddings | RAG vector generation |
| ACLED API | Armed conflict location & event data |
| EIA API | US Energy Information Administration data |
| AviationStack API | Real-time flight tracking |

---

## Data Flow

1. Background jobs poll ACLED, EIA, and AviationStack on schedule, storing to PostgreSQL
2. News ingestion runs every 30 minutes, vectorizing articles into Chroma
3. User requests `/api/v1/analyze/situation`
4. API checks Redis cache — on miss, invokes LangGraph workflow
5. LangGraph agents run in sequence: aggregate → analyze → correlate → assess
6. Result cached in Redis and returned to frontend via REST/WebSocket

---

## Infrastructure

Deployed on Kubernetes with three namespaces:

- **app** — Backend (×3), Frontend (×2), AI Service (×2) pods
- **data** — PostgreSQL, Redis, Chroma
- **monitoring** — Prometheus + Grafana

---

## Getting Started

```bash
# Copy environment variables
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
cp ai-service/.env.example ai-service/.env

# Start all services
docker-compose up
```

Required environment variables include API keys for Claude, OpenAI, ACLED, EIA, AviationStack, and a Mapbox token.
