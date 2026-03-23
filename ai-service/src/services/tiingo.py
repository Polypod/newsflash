"""Tiingo financial news HTTP client."""
from typing import List
import httpx

TIINGO_NEWS_URL = "https://api.tiingo.com/tiingo/news"


def fetch_tiingo_news(
    tickers: List[str],
    tags: List[str],
    limit: int,
    api_key: str,
) -> List[dict]:
    """Fetch news articles from Tiingo. Returns [] on any error."""
    params: dict = {"token": api_key, "limit": limit}
    if tickers:
        params["tickers"] = ",".join(tickers)
    if tags:
        params["tags"] = ",".join(tags)

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(TIINGO_NEWS_URL, params=params)
            resp.raise_for_status()
            raw = resp.json()
    except Exception:
        return []

    if not isinstance(raw, list):
        return []

    return [
        {
            "id": str(article.get("id", "")),
            "title": article.get("title", ""),
            "url": article.get("url", ""),
            "description": (article.get("description") or "")[:500],
            "published_date": article.get("publishedDate", ""),
            "source": article.get("source", ""),
            "tickers": article.get("tickers") or [],
            "tags": article.get("tags") or [],
        }
        for article in raw
    ]
