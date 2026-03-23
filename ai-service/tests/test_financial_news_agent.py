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
