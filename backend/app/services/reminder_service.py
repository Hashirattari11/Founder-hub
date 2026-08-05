"""Background reminder loop for scheduled meetings.

A lightweight asyncio task (no external scheduler) that wakes up every
REMINDER_INTERVAL_SECONDS and emails both participants about meetings that
start within REMINDER_LEAD_MINUTES, marking them with reminder_sent_at so
each meeting only triggers once.
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone

from app.core.email import send_email
from app.core.supabase import service_supabase
from app.core.users import user_email, user_full_name
from app.services.email_service import send_meeting_reminder_email

logger = logging.getLogger("founderhub.reminders")

REMINDER_INTERVAL_SECONDS = 60
REMINDER_LEAD_MINUTES = 30


def _fetch_due_meetings(now: datetime) -> list[dict]:
    if not service_supabase.available:
        return []
    window_start = now + timedelta(minutes=REMINDER_LEAD_MINUTES - 15)
    window_end = now + timedelta(minutes=REMINDER_LEAD_MINUTES + 15)
    try:
        rows = (
            service_supabase.table("meetings")
            .select("*")
            .eq("status", "scheduled")
            .is_("reminder_sent_at", "null")
            .gte("scheduled_at", window_start.isoformat())
            .lte("scheduled_at", window_end.isoformat())
            .execute()
        )
        return rows.data or []
    except Exception as exc:  # pragma: no cover
        logger.warning("Reminder fetch failed: %s", exc)
        return []


def _mark_reminded(meeting_id: str, now: datetime) -> None:
    try:
        service_supabase.table("meetings").update({"reminder_sent_at": now.isoformat()}).eq(
            "id", meeting_id
        ).execute()
    except Exception as exc:  # pragma: no cover
        logger.warning("Could not mark meeting %s reminded: %s", meeting_id, exc)


async def _reminder_tick() -> None:
    now = datetime.now(timezone.utc)
    for meeting in _fetch_due_meetings(now):
        for uid in (meeting.get("organizer_id"), meeting.get("participant_id")):
            email = user_email(uid)
            if not email:
                continue
            name = user_full_name(uid) or "there"
            other_id = meeting.get("participant_id") if uid == meeting.get("organizer_id") else meeting.get("organizer_id")
            other_name = user_full_name(other_id) or "your partner"
            send_meeting_reminder_email(
                email,
                name,
                meeting.get("title") or "Your meeting",
                meeting.get("scheduled_at"),
                meeting.get("meet_link") or "",
                other_name,
            )
        _mark_reminded(meeting.get("id"), now)
        logger.info("Reminder sent for meeting %s", meeting.get("id"))


async def reminder_loop(stop_event: asyncio.Event) -> None:
    logger.info("Meeting reminder loop started")
    while not stop_event.is_set():
        try:
            await _reminder_tick()
        except Exception as exc:  # pragma: no cover
            logger.warning("Reminder tick error: %s", exc)
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=REMINDER_INTERVAL_SECONDS)
        except asyncio.TimeoutError:
            continue
    logger.info("Meeting reminder loop stopped")
