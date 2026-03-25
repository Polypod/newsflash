"""Load ai-service/settings.yaml and expose typed config."""
import os
import yaml
from pathlib import Path

_SETTINGS_PATH = Path(__file__).parent.parent.parent / "settings.yaml"


def _load() -> dict:
    with open(_SETTINGS_PATH) as f:
        return yaml.safe_load(f)


_cfg = _load()


def get(section: str, *keys):
    """get('models', 'primary', 'model') → value"""
    node = _cfg.get(section, {})
    for key in keys:
        node = node.get(key, {})
    return node


# ── convenience accessors ─────────────────────────────────────────────────────

class _Models:
    @property
    def primary_model(self) -> str:
        return os.getenv("PRIMARY_MODEL") or get("models", "primary", "model")

    @property
    def primary_temperature(self) -> float:
        return float(os.getenv("PRIMARY_TEMPERATURE") or get("models", "primary", "temperature"))

    @property
    def primary_max_tokens(self) -> int:
        return int(os.getenv("PRIMARY_MAX_TOKENS") or get("models", "primary", "max_tokens"))

    @property
    def extraction_model(self) -> str:
        return os.getenv("EXTRACTION_MODEL") or get("models", "extraction", "model")

    @property
    def extraction_temperature(self) -> float:
        return float(os.getenv("EXTRACTION_TEMPERATURE") or get("models", "extraction", "temperature"))

    @property
    def extraction_max_tokens(self) -> int:
        return int(os.getenv("EXTRACTION_MAX_TOKENS") or get("models", "extraction", "max_tokens"))

    @property
    def embeddings_model(self) -> str:
        return os.getenv("EMBEDDINGS_MODEL") or get("models", "embeddings", "model")


class _Workflow:
    @property
    def news_retrieval_k(self) -> int:
        return int(os.getenv("NEWS_RETRIEVAL_K") or get("workflow", "news_retrieval_k"))

    @property
    def infrastructure_radius_m(self) -> int:
        return int(os.getenv("INFRASTRUCTURE_RADIUS_KM") or get("workflow", "infrastructure_radius_km")) * 1000

    @property
    def correlation_threshold(self) -> float:
        return float(os.getenv("CORRELATION_THRESHOLD") or get("workflow", "correlation_threshold"))


class _Cost:
    @property
    def cost_per_token_usd(self) -> float:
        return float(os.getenv("COST_PER_TOKEN_USD") or get("cost", "cost_per_token_usd"))

    @property
    def monthly_budget_usd(self) -> float:
        return float(os.getenv("MONTHLY_BUDGET_USD") or get("cost", "monthly_budget_usd"))


class _TiingoGeneralNews:
    @property
    def enabled(self) -> bool:
        v = os.getenv("TIINGO_NEWS_ENABLED")
        if v is not None:
            return v.lower() not in ("false", "0", "no")
        return bool(get("tiingo", "general_news", "enabled"))

    @property
    def poll_interval_minutes(self) -> int:
        return int(
            os.getenv("TIINGO_NEWS_POLL_INTERVAL")
            or get("tiingo", "general_news", "poll_interval_minutes")
            or 15
        )

    @property
    def limit(self) -> int:
        return int(get("tiingo", "general_news", "limit") or 50)

    @property
    def tags(self) -> list:
        raw = os.getenv("TIINGO_NEWS_TAGS")
        if raw:
            return [t.strip() for t in raw.split(",")]
        return get("tiingo", "general_news", "tags") or []


class _Tiingo:
    @property
    def news_limit(self) -> int:
        return int(os.getenv("TIINGO_NEWS_LIMIT") or get("tiingo", "news_limit"))

    @property
    def max_tickers(self) -> int:
        return int(os.getenv("TIINGO_MAX_TICKERS") or get("tiingo", "max_tickers"))

    @property
    def general_news(self) -> _TiingoGeneralNews:
        return _TiingoGeneralNews()


tiingo = _Tiingo()

models = _Models()
workflow = _Workflow()
cost = _Cost()
