from unittest.mock import MagicMock, patch


def _make_tiingo_cfg(tags=None, limit=50):
    cfg = MagicMock()
    cfg.general_news.tags = tags or ["energy", "geopolitics"]
    cfg.general_news.limit = limit
    return cfg


SAMPLE_ARTICLES = [
    {
        "id": "12345",
        "title": "Oil price surge",
        "description": "Brent crude rises sharply.",
        "url": "https://reuters.com/oil",
        "published_date": "2026-03-25T10:00:00+00:00",
        "source": "reuters.com",
        "tickers": [],
        "tags": ["energy", "oil"],
    }
]


def test_ingest_returns_inserted_skipped_counts():
    """Happy path: one new article → (1, 0) returned."""
    from services.tiingo_ingest import ingest

    mock_resp = MagicMock()
    mock_resp.json.return_value = {"inserted": 1, "skipped": 0}

    with patch("services.tiingo_ingest.fetch_tiingo_news", return_value=SAMPLE_ARTICLES):
        with patch("httpx.Client") as MockClient:
            MockClient.return_value.__enter__.return_value.post.return_value = mock_resp
            result = ingest(_make_tiingo_cfg(), "api-key", "http://backend:3000", "internal-key")

    assert result == (1, 0)


def test_ingest_transforms_article_to_correct_shape():
    """POST body has correct external_id, source_type, and author=None."""
    from services.tiingo_ingest import ingest

    mock_resp = MagicMock()
    mock_resp.json.return_value = {"inserted": 1, "skipped": 0}
    mock_post = MagicMock(return_value=mock_resp)

    with patch("services.tiingo_ingest.fetch_tiingo_news", return_value=SAMPLE_ARTICLES):
        with patch("httpx.Client") as MockClient:
            MockClient.return_value.__enter__.return_value.post = mock_post
            ingest(_make_tiingo_cfg(), "api-key", "http://backend:3000", "secret")

    call_args = mock_post.call_args
    article = call_args.kwargs["json"]["articles"][0]
    assert article["external_id"] == "tiingo-12345"
    assert article["source_type"] == "tiingo"
    assert article["author"] is None
    assert article["category"] == "energy"   # first tag
    assert article["content"] == "Brent crude rises sharply."


def test_ingest_posts_with_correct_url_and_header():
    """POST goes to /api/v1/ingest/articles with X-Internal-Key header."""
    from services.tiingo_ingest import ingest

    mock_resp = MagicMock()
    mock_resp.json.return_value = {"inserted": 1, "skipped": 0}
    mock_post = MagicMock(return_value=mock_resp)

    with patch("services.tiingo_ingest.fetch_tiingo_news", return_value=SAMPLE_ARTICLES):
        with patch("httpx.Client") as MockClient:
            MockClient.return_value.__enter__.return_value.post = mock_post
            ingest(_make_tiingo_cfg(), "api-key", "http://backend:3000", "my-secret")

    url = mock_post.call_args.args[0]
    headers = mock_post.call_args.kwargs["headers"]
    assert url == "http://backend:3000/api/v1/ingest/articles"
    assert headers["X-Internal-Key"] == "my-secret"


def test_ingest_skips_articles_with_empty_id():
    """Articles with id='' produce external_id 'tiingo-' — must be skipped."""
    from services.tiingo_ingest import ingest

    bad_articles = [{**SAMPLE_ARTICLES[0], "id": ""}]

    with patch("services.tiingo_ingest.fetch_tiingo_news", return_value=bad_articles):
        with patch("httpx.Client") as MockClient:
            result = ingest(_make_tiingo_cfg(), "api-key", "http://backend:3000", "key")
            MockClient.return_value.__enter__.return_value.post.assert_not_called()

    assert result == (0, 0)


def test_ingest_returns_zero_zero_on_http_error():
    """Any exception (network, 4xx, 5xx) → (0, 0), no crash."""
    from services.tiingo_ingest import ingest

    with patch("services.tiingo_ingest.fetch_tiingo_news", return_value=SAMPLE_ARTICLES):
        with patch("httpx.Client") as MockClient:
            MockClient.return_value.__enter__.return_value.post.side_effect = Exception("timeout")
            result = ingest(_make_tiingo_cfg(), "api-key", "http://backend:3000", "key")

    assert result == (0, 0)


def test_ingest_returns_zero_zero_when_no_articles():
    """fetch_tiingo_news returns [] → no POST, (0, 0)."""
    from services.tiingo_ingest import ingest

    with patch("services.tiingo_ingest.fetch_tiingo_news", return_value=[]):
        with patch("httpx.Client") as MockClient:
            result = ingest(_make_tiingo_cfg(), "api-key", "http://backend:3000", "key")
            MockClient.return_value.__enter__.return_value.post.assert_not_called()

    assert result == (0, 0)
