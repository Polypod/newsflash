"""
Situational Awareness Workflow - LangGraph Implementation
Six-node sequential LangGraph workflow for geopolitical situational awareness analysis.
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

class UCDPEvent(TypedDict):
    external_id: str
    conflict_name: str
    dyad_name: str
    type_of_violence: int           # 1=state-based, 2=non-state, 3=one-sided
    violence_label: str             # "state-based" | "non-state" | "one-sided"
    country: str
    region: str
    event_date: str
    fatalities_best: int
    fatalities_low: int
    fatalities_high: int
    source_headline: str

class UCDPConflict(TypedDict):
    dyad_id: str
    side_a: str
    side_b: str
    location: str
    intensity_level: int            # 1=minor, 2=war
    intensity_label: str            # "minor" | "war"
    year: int
    incompatibility: str            # "territory" | "government" | "both"

class CastForecast(TypedDict):
    country: str
    admin1: str
    year: int
    month: int
    period_label: str          # e.g. "Apr 2026"
    total_forecast: float
    battles_forecast: float
    erv_forecast: float        # Explosions / Remote violence
    vac_forecast: float        # Violence against civilians

class SituationalAwarenessState(TypedDict):
    query: str
    news_articles: Annotated[list[NewsArticle], operator.add]
    geopolitical_events: Annotated[list[GeopoliticalEvent], operator.add]
    ucdp_events: Annotated[list[UCDPEvent], operator.add]
    ucdp_conflicts: Annotated[list[UCDPConflict], operator.add]
    infrastructure_impacts: Annotated[list[InfrastructureCorrelation], operator.add]
    cast_forecasts: Annotated[list[CastForecast], operator.add]
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


_VIOLENCE_LABELS = {1: "state-based", 2: "non-state", 3: "one-sided"}
_INCOMPATIBILITY_LABELS = {"1": "territory", "2": "government", "3": "both"}
_INTENSITY_LABELS = {1: "minor", 2: "war"}


def ucdp_context_agent(state: SituationalAwarenessState):
    """NODE 3: Fetch UCDP verified conflict data for countries in geopolitical events.

    Queries the ucdp_events and ucdp_dyadic_conflicts tables for:
    - Recent GED events (georeferenced violence, source-cited, best/low/high fatalities)
    - Active dyadic conflicts (which state-vs-actor pairs are in armed conflict)

    UCDP data is academically verified with source citations — it provides ground-truth
    historical context and a cross-check against the LLM-extracted geopolitical events.
    The threat_assessment agent uses this to anchor its analysis in verified data.
    """
    from config.database import get_db_pool

    if not state.get("geopolitical_events"):
        return {"ucdp_events": [], "ucdp_conflicts": []}

    # Extract country names from events
    countries: set[str] = set()
    for event in state["geopolitical_events"]:
        loc = event.get("location", "")
        if loc:
            parts = [p.strip() for p in loc.split(",")]
            countries.add(parts[-1])
            if len(parts) > 1:
                countries.add(parts[0])
        for actor in event.get("actors", []):
            for prefix in ("Government of ", "Republic of ", "State of ", "Forces of "):
                if actor.startswith(prefix):
                    countries.add(actor[len(prefix):].strip())

    countries.discard("")
    if not countries:
        return {"ucdp_events": [], "ucdp_conflicts": []}

    db_pool = get_db_pool()
    conn = db_pool.getconn()
    ucdp_evts = []
    ucdp_conflicts = []

    try:
        with conn.cursor() as cur:
            # Recent GED events for matched countries (last 2 years of available data)
            cur.execute("""
                SELECT external_id, conflict_name, dyad_name, type_of_violence,
                       country, region, event_date,
                       fatalities_best, fatalities_low, fatalities_high,
                       source_headline
                FROM ucdp_events
                WHERE country = ANY(%s)
                  AND event_date >= NOW() - INTERVAL '2 years'
                ORDER BY event_date DESC
                LIMIT 50
            """, (list(countries),))
            for row in cur.fetchall():
                (ext_id, conflict_name, dyad_name, viol_type,
                 country, region, event_date, best, low, high, headline) = row
                ucdp_evts.append({
                    "external_id": str(ext_id),
                    "conflict_name": conflict_name or "",
                    "dyad_name": dyad_name or "",
                    "type_of_violence": viol_type or 0,
                    "violence_label": _VIOLENCE_LABELS.get(viol_type, "unknown"),
                    "country": country or "",
                    "region": region or "",
                    "event_date": str(event_date) if event_date else "",
                    "fatalities_best": int(best or 0),
                    "fatalities_low": int(low or 0),
                    "fatalities_high": int(high or 0),
                    "source_headline": headline or "",
                })

            # Active dyadic conflicts for matched countries (most recent 3 years)
            cur.execute("""
                SELECT dyad_id, side_a, side_b, location,
                       intensity_level, year, incompatibility
                FROM ucdp_dyadic_conflicts
                WHERE location = ANY(%s)
                  AND year >= EXTRACT(YEAR FROM NOW())::int - 3
                ORDER BY year DESC, intensity_level DESC
                LIMIT 30
            """, (list(countries),))
            for row in cur.fetchall():
                dyad_id, side_a, side_b, location, intensity, year, incomp = row
                ucdp_conflicts.append({
                    "dyad_id": str(dyad_id or ""),
                    "side_a": side_a or "",
                    "side_b": side_b or "",
                    "location": location or "",
                    "intensity_level": int(intensity or 0),
                    "intensity_label": _INTENSITY_LABELS.get(int(intensity or 0), "unknown"),
                    "year": int(year or 0),
                    "incompatibility": _INCOMPATIBILITY_LABELS.get(str(incomp or ""), str(incomp or "")),
                })
    finally:
        db_pool.putconn(conn)

    logger.info(
        f"UCDP: {len(ucdp_evts)} events + {len(ucdp_conflicts)} active conflicts "
        f"for {len(countries)} candidate countries"
    )
    return {"ucdp_events": ucdp_evts, "ucdp_conflicts": ucdp_conflicts}


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


def cast_forecast_agent(state: SituationalAwarenessState):
    """NODE 4: Fetch ACLED CAST rolling forecasts for countries in current events.

    CAST provides 6 rolling 4-week period predictions per country (total events,
    battles, explosions/remote violence, violence against civilians). We query
    the cast_forecasts table for countries appearing in the geopolitical events
    and return upcoming periods, ordered nearest-first.
    """
    from config.database import get_db_pool

    if not state.get("geopolitical_events"):
        return {"cast_forecasts": []}

    # Extract candidate country strings from event locations and actors.
    # Location strings: "Khartoum, Sudan" → "Sudan"; "Middle East" → kept as-is.
    # Actors: "Government of Sudan" → "Sudan"; "Hamas" → kept (no country match needed).
    country_candidates: set[str] = set()
    for event in state["geopolitical_events"]:
        loc = event.get("location", "")
        if loc:
            parts = [p.strip() for p in loc.split(",")]
            # Last part is most likely the country
            country_candidates.add(parts[-1])
            if len(parts) > 1:
                country_candidates.add(parts[0])
        for actor in event.get("actors", []):
            # "Government of X" / "X Military" / "X Army" patterns
            for prefix in ("Government of ", "Republic of ", "State of "):
                if actor.startswith(prefix):
                    country_candidates.add(actor[len(prefix):].strip())

    country_candidates.discard("")

    db_pool = get_db_pool()
    now = datetime.datetime.now()

    # Query upcoming CAST periods for matched countries, plus top-5 globally
    # for broader threat context (helps the LLM see the global picture).
    conn = db_pool.getconn()
    try:
        with conn.cursor() as cur:
            if country_candidates:
                cur.execute("""
                    SELECT country, admin1, year, month,
                           total_forecast, battles_forecast, erv_forecast, vac_forecast
                    FROM cast_forecasts
                    WHERE country = ANY(%s)
                      AND (year > %s OR (year = %s AND month >= %s))
                    ORDER BY country, year, month
                    LIMIT 120
                """, (list(country_candidates), now.year, now.year, now.month))
                matched = cur.fetchall()
            else:
                matched = []

            # Top-5 highest-forecast countries globally for the nearest period
            cur.execute("""
                SELECT DISTINCT ON (country) country, admin1, year, month,
                       total_forecast, battles_forecast, erv_forecast, vac_forecast
                FROM cast_forecasts
                WHERE admin1 IS NULL
                  AND (year > %s OR (year = %s AND month >= %s))
                ORDER BY country, year, month, total_forecast DESC
                LIMIT 5
            """, (now.year, now.year, now.month))
            top_global = cur.fetchall()
    finally:
        db_pool.putconn(conn)

    seen = set()
    forecasts = []
    for rows in (matched, top_global):
        for row in rows:
            country, admin1, year, month, total, battles, erv, vac = row
            key = (country, admin1, year, month)
            if key in seen:
                continue
            seen.add(key)
            forecasts.append({
                "country": country,
                "admin1": admin1,
                "year": year,
                "month": month,
                "period_label": datetime.date(year, month, 1).strftime("%b %Y"),
                "total_forecast": float(total or 0),
                "battles_forecast": float(battles or 0),
                "erv_forecast": float(erv or 0),
                "vac_forecast": float(vac or 0),
            })

    forecasts.sort(key=lambda f: (f["country"], f["year"], f["month"]))
    logger.info(f"CAST: {len(forecasts)} forecast records for {len(country_candidates)} candidate countries")
    return {"cast_forecasts": forecasts}


import logging
logger = logging.getLogger(__name__)


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
    """NODE 5: Synthesize all data into threat assessment"""
    llm = get_llm_primary()
    
    class ThreatAssessment(BaseModel):
        overall_threat_level: Literal["low", "medium", "high", "critical"]
        executive_summary: str
        key_risks: list[str]
        recommended_actions: list[str]
        monitoring_priorities: list[str]
    
    structured_llm = llm.with_structured_output(ThreatAssessment)
    
    # Summarise CAST: per country, show period_label + total_forecast (sorted by forecast desc)
    cast_summary = {}
    for f in state.get("cast_forecasts", []):
        c = f["country"]
        cast_summary.setdefault(c, []).append(f)
    cast_context = {
        country: [
            {"period": f["period_label"], "total": f["total_forecast"],
             "battles": f["battles_forecast"], "erv": f["erv_forecast"],
             "vac": f["vac_forecast"]}
            for f in sorted(periods, key=lambda x: (x["year"], x["month"]))
        ]
        for country, periods in cast_summary.items()
    }

    # Summarise UCDP events by country: total events, death ranges, conflict types
    ucdp_summary: dict = {}
    for e in state.get("ucdp_events", []):
        c = e["country"]
        entry = ucdp_summary.setdefault(c, {
            "events": 0, "deaths_best": 0, "deaths_range": [0, 0],
            "conflict_names": set(), "violence_types": set(),
        })
        entry["events"] += 1
        entry["deaths_best"] += e["fatalities_best"]
        entry["deaths_range"][0] += e["fatalities_low"]
        entry["deaths_range"][1] += e["fatalities_high"]
        if e["conflict_name"]:
            entry["conflict_names"].add(e["conflict_name"])
        if e["violence_label"]:
            entry["violence_types"].add(e["violence_label"])
    # Serialise sets for JSON
    ucdp_json = {
        c: {**v, "conflict_names": list(v["conflict_names"]),
            "violence_types": list(v["violence_types"])}
        for c, v in ucdp_summary.items()
    }

    # Active dyadic conflicts formatted for readability
    active_conflicts_text = "\n".join(
        f"  [{d['year']}] {d['side_a']} vs {d['side_b']} in {d['location']} "
        f"({d['intensity_label']} intensity, {d['incompatibility']} incompatibility)"
        for d in state.get("ucdp_conflicts", [])[:15]
    ) or "  None in DB (table may be empty on first run)"

    context = f"""
    GEOPOLITICAL SITUATION REPORT

    EVENTS (LLM-extracted from news): {json.dumps(state['geopolitical_events'], indent=2)}

    UCDP VERIFIED CONFLICT DATA (Uppsala Conflict Data Program — academically verified,
    source-cited, annual release covering events through 2024):

    GED EVENTS BY COUNTRY (recent, georeferenced violence):
    {json.dumps(ucdp_json, indent=2) if ucdp_json else "  No UCDP data in DB yet (populate via ucdp-ged job)."}
    Note: fatalities shown as best estimate (low–high range). type_of_violence:
      state-based = government vs armed group, non-state = group vs group, one-sided = targeting civilians.

    ACTIVE DYADIC CONFLICTS (state-based armed conflicts, most recent years):
{active_conflicts_text}
    Note: intensity 'war' = 1000+ battle deaths/year; 'minor' = 25–999/year.

    INFRASTRUCTURE AT RISK: {json.dumps(state['infrastructure_impacts'], indent=2)}

    ACLED CAST FORECASTS — rolling 4-week political violence predictions (next 6 periods):
    {json.dumps(cast_context, indent=2) if cast_context else "No CAST data available (DB may need initial sync)."}
    Interpret: higher total_forecast = more predicted violence. Battles, ERV (explosions/remote
    violence), VAC (violence against civilians) are sub-categories. Use as forward-looking
    risk multipliers — countries with rising forecasts warrant elevated concern.

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

    Generate a concise threat assessment for decision-makers. Use UCDP data as a verified
    ground-truth anchor — cross-reference LLM-extracted events with UCDP records to confirm
    or qualify severity. Use CAST forecasts as forward-looking risk signals. Flag any conflict
    where UCDP shows 'war' intensity dyads AND CAST forecasts are rising — that combination
    indicates serious escalation risk.
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
    """NODE 6: Format results for frontend"""
    token_usage = state.get("token_usage", 0)
    financial_signals = state.get("financial_signals", [])
    final_report = {
        "timestamp": str(datetime.datetime.now()),
        "threat_level": state.get("threat_level", "unknown"),
        "total_articles": len(state["news_articles"]),
        "geopolitical_events": state["geopolitical_events"],
        "ucdp_events": state.get("ucdp_events", []),
        "ucdp_conflicts": state.get("ucdp_conflicts", []),
        "infrastructure_at_risk": state["infrastructure_impacts"],
        "cast_forecasts": state.get("cast_forecasts", []),
        "financial_signals": financial_signals,
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
    workflow.add_node("ucdp_context", ucdp_context_agent)
    workflow.add_node("infrastructure_correlator", infrastructure_correlator_agent)
    workflow.add_node("cast_forecast", cast_forecast_agent)
    workflow.add_node("financial_news", financial_news_agent)
    workflow.add_node("threat_assessment", threat_assessment_agent)
    workflow.add_node("output_formatter", output_formatter)

    # Sequential pipeline:
    # news → events → UCDP verified data → infrastructure → CAST forecasts → financial → assessment → output
    # UCDP runs after event extraction so it can use the identified countries as query keys.
    workflow.add_edge(START, "news_aggregation")
    workflow.add_edge("news_aggregation", "geopolitical_analyst")
    workflow.add_edge("geopolitical_analyst", "ucdp_context")
    workflow.add_edge("ucdp_context", "infrastructure_correlator")
    workflow.add_edge("infrastructure_correlator", "cast_forecast")
    workflow.add_edge("cast_forecast", "financial_news")
    workflow.add_edge("financial_news", "threat_assessment")
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
        "ucdp_events": [],
        "ucdp_conflicts": [],
        "infrastructure_impacts": [],
        "cast_forecasts": [],
        "financial_signals": [],
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
