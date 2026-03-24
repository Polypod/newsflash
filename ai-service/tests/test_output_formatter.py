import json
import pytest
from workflows.situational_awareness import output_formatter


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
