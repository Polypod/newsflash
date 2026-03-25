# Tiingo Semantic Category Classification — Design Spec

## Goal

Replace the current `article["tags"][0][:50]` category assignment in `tiingo_ingest.py` with a two-step semantic classifier that maps each ingested Tiingo article to one of the taxonomy tags defined in `settings.yaml tiingo.general_news.tags`.

## Architecture

The change is contained entirely within the AI service:

```text
tiingo_ingest.ingest()
  → _classify_category(title, description, article_tags, taxonomy)
      Step 1: intersection — check article's own Tiingo tags against taxonomy set
        → match found → return tag (no network call)
      Step 2: LLM fallback — call GPT-4o-mini with title + description
        → valid taxonomy tag returned → return it
        → failure / out-of-taxonomy response → return None
```

## Components

### `ai-service/src/services/tiingo_ingest.py` — modified

Add a private function before `ingest()`:

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

    # Step 1: intersection — return lowercase for consistent storage
    for tag in article_tags:
        if tag.lower() in taxonomy_set:
            return tag.lower()  # canonical form is always lowercase

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

Replace the current `category` field in `ingest()`:

```python
# Before:
"category": article["tags"][0][:50] if article["tags"] else None,

# After:
"category": _classify_category(
    article["title"],
    article["description"],
    article["tags"],
    tiingo_cfg.general_news.tags,
),
```

Add `import os` to the module-level imports (not currently present). The `openai` package is already in `requirements.txt`.

### `ai-service/tests/test_tiingo_ingest.py` — modified

Add five tests for `_classify_category` directly:

1. **Intersection hit** — article tag in taxonomy → returns lowercase matched tag, no OpenAI call
2. **Intersection miss → LLM success** — no matching tag, LLM returns valid taxonomy value → returned
3. **LLM returns out-of-taxonomy string** → returns `None`
4. **LLM raises exception** → returns `None`, no crash
5. **Empty tags list** — `article_tags=[]` → intersection skipped, LLM fallback fires

The existing `test_ingest_transforms_article_to_correct_shape` uses `SAMPLE_ARTICLES` with `tags: ["energy", "oil"]` and the default taxonomy includes `"energy"` — the intersection already fires and `category == "energy"` passes. **No fixture change needed.** Update only the stale inline comment on the assertion from `# first tag` to `# intersection match`.

## Data Flow

```text
Tiingo article { tags: ["Crude Oil", "energy", "commodities"] }
  Step 1: "crude oil" not in taxonomy, "energy" in taxonomy → return "energy"

Tiingo article { tags: ["Mergers & Acquisitions", "Corporate Strategy"] }
  Step 1: no match
  Step 2: LLM("Title: XYZ acquires ABC... → pick from: geopolitics, conflict, ...") → "economics"
  → validate "economics" in taxonomy? No → return None

Tiingo article { tags: ["Mergers & Acquisitions", "Corporate Strategy"] }
  Step 2: LLM → "finance" → validate → return "finance"
```

## Error Handling

| Scenario | Behaviour |
|---|---|
| Article tags include taxonomy match | Return match, no LLM call |
| No taxonomy match, OPENAI_API_KEY missing | Return `None` |
| LLM returns valid taxonomy tag | Return it |
| LLM returns string not in taxonomy | Return `None` |
| LLM call raises (network, quota, etc.) | Log warning, return `None` |
| Any other exception | Return `None`, never raises |

## Out of Scope

- Caching LLM responses (articles are fetched once and deduplicated by `external_id`)
- Using Claude instead of GPT-4o-mini (extraction model is already GPT-4o-mini by convention)
- Changing the `category` column type or length
- Classifying articles from other sources (NewsAPI)
- Caching or reusing the `OpenAI` client across calls (instantiated per-article on the LLM path; acceptable for the current batch size)
