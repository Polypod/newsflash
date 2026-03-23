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
