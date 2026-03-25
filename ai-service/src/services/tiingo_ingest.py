"""Sync ingest function: fetch Tiingo general news and push to backend.

This module is designed to run inside asyncio.to_thread(), so it uses
synchronous httpx.Client — do NOT use httpx.AsyncClient here.
"""
import logging

import httpx

from services.tiingo import fetch_tiingo_news

logger = logging.getLogger(__name__)


def ingest(tiingo_cfg, tiingo_api_key: str, backend_url: str, internal_key: str) -> tuple:
    """Fetch Tiingo general news and POST to the backend ingest endpoint.

    Returns (inserted, skipped). Never raises — returns (0, 0) on any error.
    tiingo_cfg is the _Tiingo settings instance (has .general_news.tags, .limit).
    Uses synchronous httpx.Client — safe to call from asyncio.to_thread().
    """
    try:
        articles_raw = fetch_tiingo_news(
            tickers=[],
            tags=tiingo_cfg.general_news.tags,
            limit=tiingo_cfg.general_news.limit,
            api_key=tiingo_api_key,
        )

        articles = []
        for article in articles_raw:
            # tiingo.py coerces missing ids to ""; "tiingo-" would collide for all such articles
            if not article["id"]:
                continue
            articles.append({
                "external_id": f"tiingo-{article['id']}",
                "title": article["title"],
                "content": article["description"],   # already truncated to 500 chars by tiingo.py
                "url": article["url"],
                "published_at": article["published_date"],
                "source": article["source"],
                "category": article["tags"][0][:50] if article["tags"] else None,
                "author": None,
                "source_type": "tiingo",
            })

        if not articles:
            return (0, 0)

        with httpx.Client(timeout=15.0) as client:
            resp = client.post(
                f"{backend_url}/api/v1/ingest/articles",
                json={"articles": articles},
                headers={"X-Internal-Key": internal_key},
            )
            resp.raise_for_status()
            data = resp.json()

        return (data.get("inserted", 0), data.get("skipped", 0))

    except Exception as exc:
        logger.warning("Tiingo ingest failed: %s", exc)
        return (0, 0)
