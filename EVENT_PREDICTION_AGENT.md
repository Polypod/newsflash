1. We have threat assesment already - verify this is working
2. We would also like to enhance the results throug event prediction (similar to what is done at ACLED) - see below:

┌─────────────────────────────────────────────────────────────┐
│                    EVENT PREDICTION AGENT                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ INPUT LAYER: Multi-Source Data Aggregation          │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │ • News APIs (NewsAPI, GDELT, MediaCloud)            │   │
│  │ • Scraped content (Firecrawl, news sites)           │   │
│  │ • Conflict databases (UCDP, ACLED, SCAD)           │   │
│  │ • Weather/Environmental (NOAA, OpenWeatherMap)     │   │
│  │ • Economic indicators (IMF, World Bank APIs)       │   │
│  │ • Geospatial data (satellite, shipping, flights)   │   │
│  └──────────────────────────────────────────────────────┘   │
│                           ↓                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ EXTRACTION & NORMALIZATION LAYER                     │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │ • LLM-based event extraction (entities, dates)      │   │
│  │ • Temporal normalization & alignment               │   │
│  │ • Geographic standardization (geocoding)           │   │
│  │ • Source credibility scoring                       │   │
│  └──────────────────────────────────────────────────────┘   │
│                           ↓                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ CORRELATION & PATTERN DETECTION LAYER               │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │ • Multi-source event correlation engine            │   │
│  │ • Causal inference models                          │   │
│  │ • Evolutionary event ontology matching             │   │
│  │ • Anomaly detection                                │   │
│  └──────────────────────────────────────────────────────┘   │
│                           ↓                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ REASONING LAYER: Predictive Inference               │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │ • LLM-based reasoning agent (few-shot learning)    │   │
│  │ • Machine learning risk models                     │   │
│  │ • Sequential event forecasting                     │   │
│  │ • Confidence calibration                           │   │
│  └──────────────────────────────────────────────────────┘   │
│                           ↓                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ OUTPUT LAYER: Risk Scoring & Explanations           │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │ • Risk scores (0-100) with confidence intervals    │   │
│  │ • Causal explanation chains                        │   │
│  │ • Contributing signals with weights                │   │
│  │ • Validation & contradiction detection             │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘

async def predict_event_risk(
    target_region: str,
    event_type: str,  # "military_conflict", "humanitarian_crisis", etc.
    time_horizon: str = "30_days",  # "7_days", "30_days", "90_days"
    include_explanation: bool = True,
    confidence_threshold: float = 0.65,
) -> EventPredictionResult:
    """
    Predicts likelihood of significant geopolitical events using 
    multi-source data correlation and agentic reasoning.
    
    Args:
        target_region: Geographic region (country/region ISO code)
        event_type: Type of event to predict
        time_horizon: Prediction window
        include_explanation: Return detailed causal chain
        confidence_threshold: Only return if confidence >= threshold
    
    Returns:
        EventPredictionResult with risk_score, confidence, 
        contributing_signals, and reasoning_chain
    """


from the project exploration:

Threat assessment — already built and substantial. The existing 7-node LangGraph pipeline already covers:

News aggregation (Chroma semantic search)
Geopolitical event extraction (Claude)
UCDP verified conflict data (PostGIS DB queries)
Infrastructure risk (spatial 200km radius)
ACLED CAST rolling violence forecasts (6 upcoming 4-week periods)
Financial signals (Tiingo + LLM-selected tickers)
Threat synthesis (Claude → low/medium/high/critical)
So "verify it's working" means running it end-to-end and checking the output quality, not building from scratch.

Event prediction — the new part. The CAST forecasts are already forward-looking, but the spec describes a richer dedicated prediction layer: explicit risk scores (0-100), confidence intervals, causal chains, multiple time horizons (7/30/90 days), and specific event-type targeting.

First clarifying question: The CAST forecasts in the existing workflow already give rolling 4-week violence predictions per country. What should the new event prediction agent add that CAST doesn't already cover?

a) A unified risk score (0-100) synthesized across all signals (CAST + UCDP trends + news + financial) with confidence intervals

b) Specific event-type predictions ("military escalation", "coup", "humanitarian crisis") rather than generic violence counts

c) Longer time horizons (30/90 days) with causal reasoning chains explaining why an event might occur

d) All of the above — treat CAST as one input signal among many, build a full reasoning layer on top

