"""APScheduler setup for Tiingo general news ingestion.

start_scheduler() is called from main.py's lifespan context manager.
run_tiingo_ingest() wraps the synchronous tiingo_ingest.ingest() via
asyncio.to_thread so it does not block the FastAPI event loop.
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from services.tiingo_ingest import ingest as _sync_ingest

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()


async def run_tiingo_ingest(tiingo_cfg, tiingo_api_key: str, backend_url: str, internal_key: str):
    """Async wrapper: delegates sync ingest() to a thread pool."""
    inserted, skipped = await asyncio.to_thread(
        _sync_ingest, tiingo_cfg, tiingo_api_key, backend_url, internal_key
    )
    logger.info("Tiingo ingest complete: %d inserted, %d skipped", inserted, skipped)


async def start_scheduler(tiingo_cfg, tiingo_api_key: str, backend_url: str, internal_key: str):
    """Start the APScheduler if Tiingo is enabled and API key is present.

    Adds two jobs:
    - Interval job: fires every poll_interval_minutes (default 15)
    - Date job: fires 5 seconds after startup so articles appear immediately
    """
    if not tiingo_cfg.general_news.enabled:
        logger.info("Tiingo general news disabled (TIINGO_NEWS_ENABLED=false) — scheduler not started")
        return
    if not tiingo_api_key:
        logger.error("TIINGO_API_KEY not set — Tiingo scheduler not started")
        return

    interval = tiingo_cfg.general_news.poll_interval_minutes
    args = [tiingo_cfg, tiingo_api_key, backend_url, internal_key]

    scheduler.add_job(
        run_tiingo_ingest,
        "interval",
        minutes=interval,
        args=args,
        id="tiingo_interval",
    )
    # Initial fetch shortly after startup — no need to wait a full interval
    scheduler.add_job(
        run_tiingo_ingest,
        "date",
        run_date=datetime.now(tz=timezone.utc) + timedelta(seconds=5),
        args=args,
        id="tiingo_startup",
    )
    scheduler.start()
    logger.info("Tiingo scheduler started (interval=%d min)", interval)
