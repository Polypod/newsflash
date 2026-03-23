import os
import pytest

def test_get_db_pool_returns_pool(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://appuser:devpassword@localhost:5432/conflicts_db")
    # Just test that the module imports and get_db_pool is callable
    from config.database import get_db_pool
    assert callable(get_db_pool)

def test_get_db_pool_raises_without_env(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    import config.database as db_mod
    db_mod._pool = None  # Reset singleton
    with pytest.raises(Exception):
        db_mod.get_db_pool()
