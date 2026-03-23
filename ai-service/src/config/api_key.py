import os
from fastapi import Header, HTTPException


async def require_internal_key(x_internal_key: str = Header(default="")):
    """FastAPI dependency: validates X-Internal-Key against INTERNAL_API_KEY env var."""
    expected = os.getenv("INTERNAL_API_KEY", "")
    if not expected:
        raise HTTPException(status_code=500, detail="INTERNAL_API_KEY not configured")
    if x_internal_key != expected:
        raise HTTPException(status_code=403, detail="Invalid internal API key")
