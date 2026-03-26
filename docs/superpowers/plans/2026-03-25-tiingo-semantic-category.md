# Tiingo Semantic Category Classification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `article["tags"][0][:50]` stopgap in `tiingo_ingest.py` with a two-step semantic classifier that maps each article to a taxonomy tag via tag intersection first, GPT-4o-mini fallback second.

**Architecture:** `_classify_category(title, description, article_tags, taxonomy)` is a private module-level function added before `ingest()`. Step 1 checks the article's own Tiingo tags against the taxonomy set (case-insensitive, no network call). Step 2 calls GPT-4o-mini with `temperature=0.0` only if Step 1 misses, then validates the response is in the taxonomy before returning it. Returns `None` on any failure; never raises.

**Tech Stack:** Python stdlib `os`, `openai==2.29.0` (already in `requirements.txt`), `unittest.mock.patch` / `patch.dict` for tests.

---

## File Map

| File | Change |
|------|--------|
| `ai-service/src/services/tiingo_ingest.py` | Add `import os`; add `_classify_category()` before `ingest()`; replace `article["tags"][0][:50]` with `_classify_category(...)` call |
| `ai-service/tests/test_tiingo_ingest.py` | Add 5 new tests for `_classify_category`; update stale `# first tag` comment to `# intersection match` on existing shape test |

---

## Task 1: Add `_classify_category` with TDD

**Files:**
- Modify: `ai-service/tests/test_tiingo_ingest.py`
- Modify: `ai-service/src/services/tiingo_ingest.py`

---

- [ ] **Step 1: Write the 5 failing tests and update the stale comment**

Add these 5 tests to the end of `ai-service/tests/test_tiingo_ingest.py`, and find the line `assert article["category"] == "energy"   # first tag` in `test_ingest_transforms_article_to_correct_shape` and update its comment from `# first tag` to `# intersection match`:

```python
# ── _classify_category tests ─────────────────────────────────────────────────

def test_classify_category_intersection_hit():
    """Article tag found in taxonomy → return it lowercase, no LLM call."""
    from services.tiingo_ingest import _classify_category

    result = _classify_category(
        "Oil surges", "Brent crude rises sharply.", ["Energy", "Oil"], ["energy", "geopolitics"]
    )
    assert result == "energy"


def test_classify_category_llm_success():
    """No intersection match, LLM returns valid taxonomy tag → returned."""
    from services.tiingo_ingest import _classify_category

    mock_resp = MagicMock()
    mock_resp.choices[0].message.content = "geopolitics"
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = mock_resp

    with patch.dict("os.environ", {"OPENAI_API_KEY": "test-key"}):
        with patch("openai.OpenAI", return_value=mock_client):
            result = _classify_category(
                "NATO summit", "Alliance leaders meet.", ["nato", "diplomacy"], ["energy", "geopolitics"]
            )

    assert result == "geopolitics"
    mock_client.chat.completions.create.assert_called_once()


def test_classify_category_llm_out_of_taxonomy():
    """LLM returns a string not in the taxonomy → None."""
    from services.tiingo_ingest import _classify_category

    mock_resp = MagicMock()
    mock_resp.choices[0].message.content = "sports"
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = mock_resp

    with patch.dict("os.environ", {"OPENAI_API_KEY": "test-key"}):
        with patch("openai.OpenAI", return_value=mock_client):
            result = _classify_category(
                "Some article", "Some description.", ["xyz"], ["energy", "geopolitics"]
            )

    assert result is None


def test_classify_category_llm_exception():
    """LLM call raises an exception → returns None, no crash."""
    from services.tiingo_ingest import _classify_category

    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = Exception("quota exceeded")

    with patch.dict("os.environ", {"OPENAI_API_KEY": "test-key"}):
        with patch("openai.OpenAI", return_value=mock_client):
            result = _classify_category(
                "Some article", "Some description.", ["xyz"], ["energy", "geopolitics"]
            )

    assert result is None


def test_classify_category_empty_tags():
    """Empty article_tags list → intersection skipped, LLM fallback fires."""
    from services.tiingo_ingest import _classify_category

    mock_resp = MagicMock()
    mock_resp.choices[0].message.content = "energy"
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = mock_resp

    with patch.dict("os.environ", {"OPENAI_API_KEY": "test-key"}):
        with patch("openai.OpenAI", return_value=mock_client):
            result = _classify_category(
                "Oil rises", "Crude surges.", [], ["energy", "geopolitics"]
            )

    assert result == "energy"
    mock_client.chat.completions.create.assert_called_once()
```

`patch.dict` is an attribute of `patch` — no import change needed. The existing `from unittest.mock import MagicMock, patch` is sufficient.

- [ ] **Step 2: Run the new tests to verify they fail**

```bash
cd ai-service && python -m pytest tests/test_tiingo_ingest.py::test_classify_category_intersection_hit tests/test_tiingo_ingest.py::test_classify_category_llm_success tests/test_tiingo_ingest.py::test_classify_category_llm_out_of_taxonomy tests/test_tiingo_ingest.py::test_classify_category_llm_exception tests/test_tiingo_ingest.py::test_classify_category_empty_tags -v
```

Expected: all 5 FAIL with `ImportError: cannot import name '_classify_category' from 'services.tiingo_ingest'`

- [ ] **Step 3: Add `import os` and implement `_classify_category` in `tiingo_ingest.py`**

Change the imports block from:

```python
import logging

import httpx

from services.tiingo import fetch_tiingo_news
```

To:

```python
import logging
import os

import httpx

from services.tiingo import fetch_tiingo_news
```

Then add `_classify_category` immediately before the `ingest()` function:

```python
def _classify_category(
    title: str,
    description: str,
    article_tags: list,
    taxonomy: list,
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
        from openai import OpenAI
        client = OpenAI(api_key=openai_api_key)
        tag_list = ", ".join(taxonomy)
        prompt = (
            f"Classify the following news article into exactly one of these categories: {tag_list}.\n"
            f"Reply with just the category name, nothing else.\n\n"
            f"Title: {title}\n"
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
```

- [ ] **Step 4: Replace the `article["tags"][0][:50]` line in `ingest()`**

In `ingest()`, replace:

```python
"category": article["tags"][0][:50] if article["tags"] else None,
```

With:

```python
"category": _classify_category(
    article["title"],
    article["description"],
    article["tags"],
    tiingo_cfg.general_news.tags,
),
```

- [ ] **Step 5: Run the full test file and verify all 11 tests pass**

```bash
cd ai-service && python -m pytest tests/test_tiingo_ingest.py -v
```

Expected output:
```
tests/test_tiingo_ingest.py::test_ingest_returns_inserted_skipped_counts PASSED
tests/test_tiingo_ingest.py::test_ingest_transforms_article_to_correct_shape PASSED
tests/test_tiingo_ingest.py::test_ingest_posts_with_correct_url_and_header PASSED
tests/test_tiingo_ingest.py::test_ingest_skips_articles_with_empty_id PASSED
tests/test_tiingo_ingest.py::test_ingest_returns_zero_zero_on_http_error PASSED
tests/test_tiingo_ingest.py::test_ingest_returns_zero_zero_when_no_articles PASSED
tests/test_tiingo_ingest.py::test_classify_category_intersection_hit PASSED
tests/test_tiingo_ingest.py::test_classify_category_llm_success PASSED
tests/test_tiingo_ingest.py::test_classify_category_llm_out_of_taxonomy PASSED
tests/test_tiingo_ingest.py::test_classify_category_llm_exception PASSED
tests/test_tiingo_ingest.py::test_classify_category_empty_tags PASSED

11 passed in ...
```

- [ ] **Step 6: Commit**

```bash
git add ai-service/src/services/tiingo_ingest.py ai-service/tests/test_tiingo_ingest.py
git commit -m "feat(ai-service): semantic category classifier for Tiingo articles

Replace article[tags][0][:50] stopgap with _classify_category():
- Step 1: tag intersection against settings.yaml taxonomy (no network call)
- Step 2: GPT-4o-mini fallback if no match, validates response is in taxonomy
- Returns lowercase canonical form; returns None on any failure; never raises"
```
