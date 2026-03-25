"""Sync ingest function: fetch Tiingo general news and push to backend.

This module is designed to run inside asyncio.to_thread(), so it uses
synchronous httpx.Client — do NOT use httpx.AsyncClient here.
"""
import logging
import os

import httpx
from openai import OpenAI

from services.tiingo import fetch_tiingo_news

logger = logging.getLogger(__name__)


def _classify_category(
    title: str,
    description: str,
    article_tags: list[str],
    taxonomy: list[str],
) -> str | None:
    """Return the best-matching taxonomy tag for an article.

    Step 1: intersection — return the first of the article's own Tiingo tags
    that appears in the taxonomy list (case-insensitive). No network call.

    Step 2: LLM fallback — if no intersection found, call GPT-4o-mini at
    temperature=0.0 to pick one taxonomy tag from title + description.
    Validates the response is in the taxonomy before returning.

    Returns None on any failure. Never raises.
    """
    taxonomy_set = {t.lower() for t in taxonomy}

    # Step 1: intersection — canonical form is always lowercase
    for tag in article_tags:
        if tag.lower() in taxonomy_set:
            return tag.lower()

    # Step 2: LLM fallback
    openai_api_key = os.getenv("OPENAI_API_KEY")
    if not openai_api_key:
        return None
    try:
        client = OpenAI(api_key=openai_api_key)
        tag_list = ", ".join(taxonomy)
        prompt = (
            f"Classify the following news article into exactly one of these categories: {tag_list}.\n"
            f"Reply with just the category name, nothing else.\n\n"
            f"Title: {(title or '')}\n"
            f"Summary: {(description or '')[:200]}"
        )
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0.0,
            max_tokens=20,
            messages=[{"role": "user", "content": prompt}],
        )
        result = resp.choices[0].message.content.strip().lower()
        if result in taxonomy_set:
            return result
        return None
    except Exception as exc:
        logger.warning("category LLM fallback failed: %s", exc)
        return None


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
                "category": _classify_category(
                    article["title"],
                    article["description"],
                    article["tags"],
                    tiingo_cfg.general_news.tags,
                ),
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
