from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI(title="Situational Awareness AI Service", version="1.0.0")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
async def analyze_situation(request: AnalysisRequest):
    """
    Analyze a situation using LangGraph workflow
    """
    try:
        # Import workflow here to avoid circular imports
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
            cost_usd=result.get("cost_usd", 0.0)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
