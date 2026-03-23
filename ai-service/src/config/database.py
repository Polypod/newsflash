import os
import psycopg2
from psycopg2 import pool as psycopg2_pool

_pool: psycopg2_pool.ThreadedConnectionPool | None = None


def _init_pool() -> psycopg2_pool.ThreadedConnectionPool:
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL environment variable is not set")
    return psycopg2_pool.ThreadedConnectionPool(
        minconn=1,
        maxconn=5,
        dsn=database_url,
    )


def get_db_pool() -> psycopg2_pool.ThreadedConnectionPool:
    """Return the shared connection pool, initialising it on first call."""
    global _pool
    if _pool is None:
        _pool = _init_pool()
    return _pool
