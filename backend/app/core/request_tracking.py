"""Pure-ASGI middleware that records per-day request counts, error counts and
average latency into `request_stats` (flushed to the DB at most every 5s).
"""
from __future__ import annotations

import asyncio
import datetime
import time

from app.core.supabase import service_supabase

FLUSH_INTERVAL = 5.0


class RequestTrackingMiddleware:
    def __init__(self, app):
        self.app = app
        self._counters: dict = {"requests": 0, "errors": 0, "latency_ms": 0.0}
        self._last_flush = time.monotonic()

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        start = time.monotonic()
        status = 500

        async def send_wrapper(message):
            nonlocal status
            if message["type"] == "http.response.start":
                status = message["status"]
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        except Exception:
            status = 500
            raise
        finally:
            latency_ms = (time.monotonic() - start) * 1000
            self._counters["requests"] += 1
            self._counters["latency_ms"] += latency_ms
            if status >= 500:
                self._counters["errors"] += 1
            self._maybe_flush()

    def _maybe_flush(self) -> None:
        if time.monotonic() - self._last_flush < FLUSH_INTERVAL:
            return
        if self._counters["requests"] == 0:
            self._last_flush = time.monotonic()
            return
        self._last_flush = time.monotonic()
        counters = self._counters
        self._counters = {"requests": 0, "errors": 0, "latency_ms": 0.0}
        avg = counters["latency_ms"] / counters["requests"]
        asyncio.get_running_loop().run_in_executor(
            None,
            _flush_to_db,
            datetime.date.today().isoformat(),
            counters["requests"],
            counters["errors"],
            avg,
        )


def _flush_to_db(day: str, requests: int, errors: int, avg_latency_ms: float) -> None:
    try:
        service_supabase.rpc(
            "upsert_request_stats",
            {
                "stats_day": day,
                "latency_ms": avg_latency_ms,
                "is_error": False,
            },
        ).execute()
        # Reflect the whole aggregate batch (not just one row) so the day totals
        # stay accurate even when the middleware only flushes every 5 seconds.
        if requests > 1:
            row = (
                service_supabase.table("request_stats")
                .select("requests, errors, avg_latency_ms")
                .eq("day", day)
                .maybe_single()
                .execute()
            )
            if row.data:
                prev_r = row.data.get("requests", 0)
                prev_e = row.data.get("errors", 0)
                prev_avg = row.data.get("avg_latency_ms", 0.0)
                new_r = prev_r + (requests - 1)
                new_e = prev_e + errors
                new_avg = (prev_avg * prev_r + avg_latency_ms * (requests - 1)) / new_r if new_r else 0.0
                service_supabase.table("request_stats").update(
                    {
                        "requests": new_r,
                        "errors": new_e,
                        "avg_latency_ms": round(new_avg, 3),
                    }
                ).eq("day", day).execute()
    except Exception as exc:
        print(f"[request_tracking] flush failed: {exc}")
