"""In-memory sliding-window rate limiter.

The per-minute limit is read from `system_settings.rate_limit` (cached for a
minute) and defaults to 120 requests/minute when the row is missing.
"""
from __future__ import annotations

import time
from collections import defaultdict, deque

from fastapi import Depends, HTTPException

from app.core.auth import get_user_id
from app.core.supabase import service_supabase

DEFAULT_PER_MINUTE = 120

_buckets: dict[str, deque] = defaultdict(deque)
_config_cache: dict = {"at": 0.0, "limit": DEFAULT_PER_MINUTE, "enabled": True}


def _load_config() -> tuple[int, bool]:
    now = time.monotonic()
    if now - _config_cache["at"] < 60:
        return _config_cache["limit"], _config_cache["enabled"]
    limit, enabled = DEFAULT_PER_MINUTE, True
    try:
        row = (
            service_supabase.table("system_settings")
            .select("value")
            .eq("key", "rate_limit")
            .maybe_single()
            .execute()
        )
        value = (row.data or {}).get("value") or {}
        limit = int(value.get("requests_per_minute") or DEFAULT_PER_MINUTE)
        enabled = bool(value.get("enabled", True))
    except Exception:
        pass
    _config_cache.update({"at": now, "limit": limit, "enabled": enabled})
    return limit, enabled


def rate_limited(user_id: str = Depends(get_user_id)) -> str:
    limit, enabled = _load_config()
    if not enabled or limit <= 0:
        return user_id

    now = time.monotonic()
    window = _buckets[user_id]
    while window and now - window[0] > 60:
        window.popleft()
    if len(window) >= limit:
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Try again shortly.")
    window.append(now)
    return user_id
