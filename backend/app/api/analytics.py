"""Founder analytics: profile views, applicant funnel, and engagement metrics."""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends

from app.core.auth import get_user_id
from app.core.permissions import require_permission
from app.core.supabase import service_supabase

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

DAY_MS = 24 * 60 * 60 * 1000


def _ts(value: str | None) -> float:
    try:
        return datetime.fromisoformat((value or "").replace("Z", "+00:00")).timestamp()
    except Exception:
        return 0


def _days_back(n: int, end: datetime | None = None) -> list[dict]:
    end = end or datetime.now(timezone.utc)
    days: list[dict] = []
    for i in range(n - 1, -1, -1):
        d = end - timedelta(days=i)
        days.append(
            {
                "date": d.strftime("%Y-%m-%d"),
                "label": d.strftime("%b %d"),
                "count": 0,
            }
        )
    return days


def _fill_series(days: list[dict], rows: list[dict], key_field: str) -> list[dict]:
    counts: dict[str, int] = defaultdict(int)
    for row in rows:
        raw = row.get(key_field) or ""
        counts[raw[:10]] += 1
    for day in days:
        day["count"] = counts.get(day["date"], 0)
    return days


@router.get("/founder")
async def founder_analytics(user_id: str = Depends(require_permission("analytics.founder"))):
    """Aggregate analytics for the authenticated founder across all their startups."""

    # ---- Startups owned by this user ----
    try:
        startups_rows = (
            service_supabase.table("startups")
            .select("id, name, founder_id, created_at")
            .eq("founder_id", user_id)
            .execute()
        ).data or []
    except Exception:
        startups_rows = []
    startup_ids = [s["id"] for s in startups_rows]
    startup_lookup = {s["id"]: s for s in startups_rows}

    # ---- Profile views ----
    profile_views_rows: list[dict] = []
    try:
        profile_views_rows = (
            service_supabase.table("profile_views")
            .select("id, viewer_id, viewed_at")
            .eq("profile_id", user_id)
            .order("viewed_at", desc=True)
            .limit(10000)
            .execute()
        ).data or []
    except Exception:
        pass

    profile_total = len(profile_views_rows)
    profile_unique = len({r.get("viewer_id") for r in profile_views_rows if r.get("viewer_id")})
    profile_views_30 = _fill_series(_days_back(30), profile_views_rows, "viewed_at")

    # ---- Startup views across all owned startups ----
    startup_view_rows: list[dict] = []
    if startup_ids:
        try:
            startup_view_rows = (
                service_supabase.table("startup_views")
                .select("startup_id, viewer_id, viewed_at")
                .in_("startup_id", startup_ids)
                .order("viewed_at", desc=True)
                .limit(10000)
                .execute()
            ).data or []
        except Exception:
            pass

    startup_total = len(startup_view_rows)
    startup_unique = len({r.get("viewer_id") for r in startup_view_rows if r.get("viewer_id")})
    startup_views_30 = _fill_series(_days_back(30), startup_view_rows, "viewed_at")

    views_by_startup: dict[str, int] = defaultdict(int)
    for r in startup_view_rows:
        views_by_startup[r.get("startup_id")] += 1

    # ---- Applicant funnel ----
    apps_rows: list[dict] = []
    if startup_ids:
        try:
            apps_rows = (
                service_supabase.table("applications")
                .select("id, startup_id, applicant_id, status, created_at")
                .in_("startup_id", startup_ids)
                .order("created_at", desc=True)
                .limit(10000)
                .execute()
            ).data or []
        except Exception:
            pass

    funnel = {
        "profile_views": profile_total,
        "startup_views": startup_total,
        "applications": len(apps_rows),
        "shortlisted": 0,
        "accepted": 0,
    }
    by_status: dict[str, int] = defaultdict(int)
    for a in apps_rows:
        status = a.get("status") or "pending"
        by_status[status] += 1
        if status == "shortlisted":
            funnel["shortlisted"] += 1
        elif status == "accepted":
            funnel["accepted"] += 1
    funnel["rejected"] = by_status.get("rejected", 0)

    apps_per_startup: dict[str, int] = defaultdict(int)
    for a in apps_rows:
        apps_per_startup[a.get("startup_id")] += 1

    # ---- Engagement metrics ----
    def _count(table: str, col: str, value: str) -> int:
        try:
            rows = (
                service_supabase.table(table)
                .select("id")
                .eq(col, value)
                .limit(10000)
                .execute()
            ).data or []
            return len(rows)
        except Exception:
            return 0

    connections_in = _count("connections", "receiver_id", user_id)
    connections_out = _count("connections", "requester_id", user_id)
    connections_accepted = 0
    try:
        conn_rows = (
            service_supabase.table("connections")
            .select("status")
            .or_(f"requester_id.eq.{user_id},receiver_id.eq.{user_id}")
            .eq("status", "accepted")
            .limit(10000)
            .execute()
        ).data or []
        connections_accepted = len(conn_rows)
    except Exception:
        pass

    sent_messages = _count("messages", "sender_id", user_id)
    meetings = 0
    try:
        meeting_rows = (
            service_supabase.table("meetings")
            .select("id")
            .or_(f"organizer_id.eq.{user_id},participant_id.eq.{user_id}")
            .limit(10000)
            .execute()
        ).data or []
        meetings = len(meeting_rows)
    except Exception:
        pass

    # ---- Per-startup breakdown ----
    startup_stats = []
    for sid in startup_ids:
        startup_stats.append(
            {
                "id": sid,
                "name": (startup_lookup.get(sid) or {}).get("name") or "Untitled",
                "views": views_by_startup.get(sid, 0),
                "applications": apps_per_startup.get(sid, 0),
            }
        )
    startup_stats.sort(key=lambda x: -x["views"])

    conversion_rate = round((funnel["applications"] / funnel["startup_views"] * 100), 1) if funnel["startup_views"] else 0
    response_rate = round((funnel["shortlisted"] / funnel["applications"] * 100), 1) if funnel["applications"] else 0
    acceptance_rate = round((funnel["accepted"] / (funnel["accepted"] + funnel["rejected"]) * 100), 1) if (funnel["accepted"] + funnel["rejected"]) else 0

    return {
        "profile": {
            "views": profile_total,
            "unique_viewers": profile_unique,
            "views_30d": profile_views_30,
        },
        "startups": {
            "total": len(startup_ids),
            "views": startup_total,
            "unique_viewers": startup_unique,
            "views_30d": startup_views_30,
        },
        "funnel": funnel,
        "rates": {
            "conversion_rate": conversion_rate,
            "response_rate": response_rate,
            "acceptance_rate": acceptance_rate,
        },
        "engagement": {
            "connections_received": connections_in,
            "connections_sent": connections_out,
            "connections_accepted": connections_accepted,
            "messages_sent": sent_messages,
            "meetings": meetings,
        },
        "by_startup": startup_stats,
    }
