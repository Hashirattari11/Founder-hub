"""Presence staleness sweep.

Clients flip `profiles.is_online` on connect/disconnect, but a hard crash or
closed tab can leave `is_online = true` forever. This background task marks
any online profile whose `last_seen` is older than STALE_SECONDS as offline so
chat presence and profile badges stay honest.
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone

from app.core.supabase import service_supabase

logger = logging.getLogger("founderhub.presence")

STALE_SECONDS = 120
POLL_SECONDS = 30


def sweep_stale_presence() -> int:
    if not service_supabase.available:
        return 0
    cutoff = (datetime.now(timezone.utc) - timedelta(seconds=STALE_SECONDS)).isoformat()
    try:
        result = (
            service_supabase.table("profiles")
            .update({"is_online": False})
            .eq("is_online", True)
            .lt("last_seen", cutoff)
            .execute()
        )
        rows = result.data or []
        if rows:
            logger.info("Marked %d stale profiles offline", len(rows))
        return len(rows)
    except Exception as exc:  # pragma: no cover
        logger.warning("presence sweep failed: %s", exc)
        return 0


async def presence_loop(stop_event: asyncio.Event) -> None:
    logger.info("Presence sweep loop started")
    while not stop_event.is_set():
        try:
            sweep_stale_presence()
        except Exception as exc:  # pragma: no cover
            logger.warning("presence tick failed: %s", exc)
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=POLL_SECONDS)
        except asyncio.TimeoutError:
            continue
    logger.info("Presence sweep loop stopped")
