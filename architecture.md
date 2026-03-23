# Situational Awareness MVP - Architecture Diagram

## System Overview

```mermaid
graph TB
    subgraph PRESENTATION [Presentation Layer]
        React[React 18 + Vite]
        Mapbox[Mapbox GL JS v3]
        D3[D3.js + Recharts]
        Socket[Socket.io-client]
    end

    subgraph AI [AI Intelligence Orchestration]
        LangGraph[LangGraph Multi-Agent]
        News[News Aggregation Agent]
        Geo[Geopolitical Analyst Agent]
        Infra[Infrastructure Correlator Agent]
        Threat[Threat Assessment Agent]
    end

    subgraph API [API Gateway Layer]
        Express[Express.js v4]
        Auth[JWT Auth]
        Rate[Rate Limiting]
        Validation[Validation]
    end

    subgraph DATA [Data Layer]
        ACLED[ACLED Service]
        EIA[EIA Service]
        Aviation[Aviation Service]
        NewsIngest[News Ingestion]
    end

    subgraph CACHE [Cache Layer]
        Redis[Redis]
    end

    subgraph DB [Database Layer]
        Postgres[(PostgreSQL + PostGIS)]
        Chroma[(Chroma Vector DB)]
    end

    subgraph QUEUE [Queue Layer]
        Bull[Bull Job Queue]
    end

    subgraph EXTERNAL [External APIs]
        Claude[Claude 3.5 Sonnet]
        GPT[GPT-4o-mini]
        OpenAI[OpenAI Embeddings]
        ACLED_API[ACLED API]
        EIA_API[EIA API]
        Aviation_API[AviationStack API]
    end

    React -->|REST + WebSocket| Express
    Express -->|Routes| API
    Express -->|Cache| Redis
    Express -->|Queries| Postgres
    Express -->|Queue Jobs| Bull
    Bull -->|Process| DATA
    DATA -->|Fetch| ACLED_API
    DATA -->|Fetch| EIA_API
    DATA -->|Fetch| Aviation_API
    Express -->|Analyze| LangGraph
    LangGraph -->|RAG| Chroma
    LangGraph -->|LLM| Claude
    LangGraph -->|LLM| GPT
    LangGraph -->|Embeddings| OpenAI
    LangGraph -->|Spatial| Postgres
```

## Data Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API
    participant Queue
    participant AI
    participant DB
    participant Cache

    User->>Frontend: Request Analysis
    Frontend->>API: POST /api/v1/analyze/situation
    API->>Cache: Check cache
    alt Cache Miss
        API->>AI: Invoke LangGraph workflow
        AI->>DB: Query Chroma (RAG)
        AI->>Claude: Extract events
        AI->>DB: PostGIS spatial query
        AI->>Claude: Threat assessment
        AI->>API: Return analysis
        API->>Cache: Store result
    end
    API->>Frontend: Return analysis
    Frontend->>User: Display results

    Note over Queue,DB: Background Jobs
    Queue->>DB: Poll ACLED (hourly)
    Queue->>DB: Poll EIA (daily)
    Queue->>DB: Poll Aviation (5min)
    Queue->>DB: Ingest news (30min)
```

## LangGraph Workflow

```mermaid
graph LR
    START --> News[News Aggregation]
    News --> Geo[Geopolitical Analyst]
    Geo --> Infra[Infrastructure Correlator]
    Infra --> Threat[Threat Assessment]
    Threat --> Output[Output Formatter]
    Output --> END
```

## Component Breakdown

### Frontend Components
- DashboardContainer (main layout)
- ThreatGauge (real-time threat level)
- EventTimeline (geopolitical events)
- InfrastructureRiskMap (Mapbox correlations)
- NewsIntelligence (AI-analyzed articles)
- RecommendationsPanel (AI suggestions)
- AnalysisMetadata (tokens, cost, time)

### Backend Services
- ACLEDService (conflict data)
- EIAService (energy data)
- AviationService (flight data)
- CacheService (Redis operations)
- CorrelationService (spatial analysis)

### AI Agents
- News Aggregation Agent (RAG + Chroma)
- Geopolitical Analyst Agent (Claude 3.5 extraction)
- Infrastructure Correlator Agent (PostGIS spatial)
- Threat Assessment Agent (synthesis)

## Infrastructure

```mermaid
graph TB
    subgraph K8S [Kubernetes Cluster]
        subgraph NS1 [Namespace: app]
            Backend[Backend Pods x3]
            Frontend[Frontend Pods x2]
            AI[AIService Pods x2]
        end
        subgraph NS2 [Namespace: data]
            Postgres[(PostgreSQL)]
            Redis[(Redis)]
            Chroma[(Chroma)]
        end
        subgraph NS3 [Namespace: monitoring]
            Prometheus[Prometheus]
            Grafana[Grafana]
        end
    end

    LB[Load Balancer] --> Backend
    LB --> Frontend
    Backend --> Postgres
    Backend --> Redis
    AI --> Postgres
    AI --> Chroma
```
