"""
Situational Awareness Workflow - LangGraph Implementation
Four Parallel AI Agents for Geopolitical Analysis
"""

from typing import Annotated, TypedDict, Literal, List, Dict, Any
from langgraph.graph import StateGraph, START, END
from langgraph.types import Send
from langchain_anthropic import ChatAnthropic
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_chroma import Chroma
from pydantic import BaseModel, Field
import operator
import json
import datetime
import os
from config.settings import models as model_cfg, workflow as wf_cfg, cost as cost_cfg, tiingo as tiingo_cfg

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

class FinancialNewsItem(TypedDict):
    id: str
    title: str
    url: str
    description: str
    published_date: str
    source: str
    tickers: list[str]
    tags: list[str]

class SituationalAwarenessState(TypedDict):
    query: str
    news_articles: Annotated[list[NewsArticle], operator.add]
    geopolitical_events: Annotated[list[GeopoliticalEvent], operator.add]
    infrastructure_impacts: Annotated[list[InfrastructureCorrelation], operator.add]
    financial_signals: Annotated[list[FinancialNewsItem], operator.add]
    threat_assessment: str
    threat_level: str                           # "low"|"medium"|"high"|"critical"
    token_usage: Annotated[int, operator.add]   # accumulated across agent nodes
    recommendations: list[str]
    final_report: str

# ============= INITIALIZE LLMs =============

def get_llm_primary():
    """Initialize primary LLM from settings.yaml"""
    return ChatAnthropic(
        model=model_cfg.primary_model,
        temperature=model_cfg.primary_temperature,
        max_tokens=model_cfg.primary_max_tokens,
        anthropic_api_key=os.getenv("ANTHROPIC_API_KEY")
    )

def get_llm_extraction():
    """Initialize extraction LLM from settings.yaml"""
    return ChatOpenAI(
        model=model_cfg.extraction_model,
        temperature=model_cfg.extraction_temperature,
        max_tokens=model_cfg.extraction_max_tokens,
        openai_api_key=os.getenv("OPENAI_API_KEY")
    )

def get_embeddings():
    """Initialize embeddings model from settings.yaml"""
    return OpenAIEmbeddings(
        model=model_cfg.embeddings_model,
        openai_api_key=os.getenv("OPENAI_API_KEY")
    )

# ============= AGENT NODES =============

def news_aggregation_agent(state: SituationalAwarenessState):
    """NODE 1: Semantic search for relevant articles"""
    embeddings = get_embeddings()
    
    vectorstore = Chroma(
        collection_name="news_articles",
        embedding_function=embeddings,
        persist_directory=os.getenv("CHROMA_DB_PATH", "./chroma_db")
    )
    
    retriever = vectorstore.as_retriever(search_kwargs={"k": wf_cfg.news_retrieval_k})
    docs = retriever.invoke(state["query"])
    
    articles = []
    for doc in docs:
        articles.append({
            "id": doc.metadata.get("id", "unknown"),
            "title": doc.metadata.get("title", "Untitled"),
            "content": doc.page_content,
            "source": doc.metadata.get("source", "Unknown"),
            "published_at": doc.metadata.get("published_at", ""),
            "url": doc.metadata.get("url", ""),
            "embedding": doc.metadata.get("embedding", []),
            "relevance_score": doc.metadata.get("relevance_score", 0.8)
        })
    
    return {"news_articles": articles}


def geopolitical_analyst_agent(state: SituationalAwarenessState):
    """NODE 2: Extract geopolitical events with LLM"""
    llm = get_llm_primary()
    
    class EventExtraction(BaseModel):
        events: list[dict] = Field(description="List of geopolitical events")
        analysis: str = Field(description="Contextual analysis")
    
    structured_llm = llm.with_structured_output(EventExtraction)
    
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
    usage = getattr(result, "usage_metadata", None) or {}
    tokens = usage.get("input_tokens", 0) + usage.get("output_tokens", 0)

    events = [
        {
            "event_type": e.get("event_type", "unknown"),
            "actors": e.get("actors", []),
            "location": e.get("location", "Unknown"),
            "date": e.get("date", ""),
            "severity": e.get("severity", "low"),
            "description": e.get("description", "")
        }
        for e in result.events
    ]

    return {
        "geopolitical_events": events,
        "token_usage": tokens,
    }


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
        WHERE ST_DWithin(f.location::geography, ep.geom::geography, %s)
        ORDER BY distance_km ASC
        LIMIT 10
        """

        radius_km = wf_cfg.infrastructure_radius_m // 1000
        conn = db_pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(sql, (event["location"], wf_cfg.infrastructure_radius_m))
                rows = cur.fetchall()
        finally:
            db_pool.putconn(conn)

        multiplier = severity_multiplier.get(event["severity"], 0.3)

        for row in rows:
            facility_id, facility_type, distance_km, status, capacity = row
            correlation_score = max(0, 1.0 - (distance_km / radius_km)) * multiplier

            if correlation_score > wf_cfg.correlation_threshold:
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


def threat_assessment_agent(state: SituationalAwarenessState):
    """NODE 4: Synthesize all data into threat assessment"""
    llm = get_llm_primary()
    
    class ThreatAssessment(BaseModel):
        overall_threat_level: Literal["low", "medium", "high", "critical"]
        executive_summary: str
        key_risks: list[str]
        recommended_actions: list[str]
        monitoring_priorities: list[str]
    
    structured_llm = llm.with_structured_output(ThreatAssessment)
    
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
    usage = getattr(assessment, "usage_metadata", None) or {}
    tokens = usage.get("input_tokens", 0) + usage.get("output_tokens", 0)

    return {
        "threat_assessment": assessment.executive_summary,
        "threat_level": assessment.overall_threat_level,
        "recommendations": assessment.recommended_actions,
        "token_usage": tokens,
    }


_COST_PER_TOKEN_USD = cost_cfg.cost_per_token_usd


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


# ============= BUILD WORKFLOW =============

def build_situational_awareness_workflow():
    """Build the LangGraph workflow"""
    workflow = StateGraph(SituationalAwarenessState)
    
    # Add nodes
    workflow.add_node("news_aggregation", news_aggregation_agent)
    workflow.add_node("geopolitical_analyst", geopolitical_analyst_agent)
    workflow.add_node("infrastructure_correlator", infrastructure_correlator_agent)
    workflow.add_node("threat_assessment", threat_assessment_agent)
    workflow.add_node("output_formatter", output_formatter)
    
    # Define edges
    workflow.add_edge(START, "news_aggregation")
    workflow.add_edge("news_aggregation", "geopolitical_analyst")
    workflow.add_edge("geopolitical_analyst", "infrastructure_correlator")
    workflow.add_edge("infrastructure_correlator", "threat_assessment")
    workflow.add_edge("threat_assessment", "output_formatter")
    workflow.add_edge("output_formatter", END)
    
    return workflow.compile()


# ============= INVOKE =============

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


# ============= COST OPTIMIZER =============

class CostOptimizer:
    def __init__(self, monthly_budget_usd: float = None):
        self.monthly_budget = monthly_budget_usd or cost_cfg.monthly_budget_usd
        self.daily_limit = self.monthly_budget / 30
    
    async def get_today_spend(self) -> float:
        """Get today's spending from database"""
        # TODO: Implement database query
        return 0.0
    
    async def run_with_budget(self, workflow_fn):
        """Run workflow with budget constraints"""
        today_spend = await self.get_today_spend()
        remaining_today = self.daily_limit - today_spend
        
        if remaining_today < 1.0:
            # Use cached analysis
            return await self.run_cached_analysis()
        
        try:
            result = await workflow_fn()
            token_cost = result.get('cost_usd', 0)
            
            if today_spend + token_cost > self.daily_limit:
                return await self.run_with_fallback_model(workflow_fn)
            
            return result
        except Exception as e:
            raise
    
    async def run_cached_analysis(self):
        """Run analysis using cached results"""
        # TODO: Implement cached analysis
        return {"status": "cached", "message": "Using cached analysis"}
    
    async def run_with_fallback_model(self, workflow_fn):
        """Run analysis with fallback model"""
        # TODO: Implement fallback model
        return await workflow_fn()


cost_optimizer = CostOptimizer(monthly_budget_usd=5000)
