"""Phase 9 — Video meetings & scheduling API.

Availability management, time-slot generation, meeting booking, notes,
status transitions, and confirmation/reminder emails.
"""
import logging
import re
from datetime import date, datetime, time, timedelta, timezone
from typing import Optional
from uuid import uuid4
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.auth import get_user_id
from app.core.config import settings
from app.core.supabase import service_supabase
from app.core.users import user_email, user_full_name
from app.services.email_service import send_meeting_confirmation_email
from app.services.google_meet import create_google_meet_link

logger = logging.getLogger("founderhub.meetings")
router = APIRouter(prefix="/api", tags=["meetings"])

DEFAULT_DURATION_MINUTES = 30
MAX_SLOT_RANGE_DAYS = 35


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------
def _notify_user(user_id: str, ntype: str, title: str, body: str, data: Optional[dict] = None) -> bool:
    try:
        row = {"user_id": user_id, "type": ntype, "title": title, "body": body, "data": data or {}}
        service_supabase.table("notifications").insert(row).execute()
        return True
    except Exception as exc:
        logger.warning("Failed to notify %s: %s", user_id, exc)
        return False


def _profile_select():
    return "full_name, avatar_url, username, role, city, bio"


def _tz_for(tzname: str | None) -> ZoneInfo:
    if tzname:
        try:
            return ZoneInfo(tzname)
        except ZoneInfoNotFoundError:
            pass
    return ZoneInfo("UTC")


def _built_in_meet_link() -> str:
    return f"{settings.frontend_url}/meet/{uuid4()}"


def _meeting_public(row: dict) -> dict:
    """Add the other person's profile + emails for the viewing user."""
    return row


def _meeting_with_profiles():
    return (
        "*, organizer:profiles!meetings_organizer_id_fkey(" + _profile_select() + "), "
        "participant:profiles!meetings_participant_id_fkey(" + _profile_select() + ")"
    )


def _extract_room_id(link: str) -> str | None:
    match = re.search(r"([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})", link or "")
    return match.group(1).lower() if match else None


# ---------------------------------------------------------------------------
# availability
# ---------------------------------------------------------------------------
class AvailabilityIn(BaseModel):
    slots: list[dict] = Field(default_factory=list)  # {day_of_week, start_time, end_time, timezone}


@router.get("/availability/{user_id}")
async def get_availability(user_id: str, _uid: str = Depends(get_user_id)):
    rows = (
        service_supabase.table("availability_slots")
        .select("id, user_id, day_of_week, start_time, end_time, timezone, is_active")
        .eq("user_id", user_id)
        .order("day_of_week")
        .execute()
    )
    return {"slots": rows.data or []}


@router.put("/availability")
async def save_availability(payload: AvailabilityIn, user_id: str = Depends(get_user_id)):
    """Replace the current user's weekly availability (best-effort, no strict validation)."""
    service_supabase.table("availability_slots").delete().eq("user_id", user_id).execute()

    inserted = []
    for slot in payload.slots:
        day = int(slot.get("day_of_week", 0))
        start_time = str(slot.get("start_time", "09:00"))
        end_time = str(slot.get("end_time", "17:00"))
        timezone_name = str(slot.get("timezone") or "UTC")
        if day < 0 or day > 6:
            continue
        try:
            st = time.fromisoformat(start_time)
            et = time.fromisoformat(end_time)
        except ValueError:
            continue
        if et <= st:
            continue
        try:
            result = (
                service_supabase.table("availability_slots")
                .insert(
                    {
                        "user_id": user_id,
                        "day_of_week": day,
                        "start_time": st.strftime("%H:%M:%S"),
                        "end_time": et.strftime("%H:%M:%S"),
                        "timezone": timezone_name,
                        "is_active": True,
                    }
                )
                .execute()
            )
            if result.data:
                inserted.append(result.data[0])
        except Exception as exc:
            logger.warning("Failed to insert availability slot: %s", exc)

    return {"saved": len(inserted), "slots": inserted}


@router.get("/availability/{user_id}/time-slots")
async def get_time_slots(
    user_id: str,
    from_date: str = Query(..., alias="from"),
    to_date: str = Query(..., alias="to"),
    _uid: str = Depends(get_user_id),
):
    """Generate concrete 30-minute booking slots from weekly availability.

    Slots are upserted into meeting_time_slots so bookings can reference
    stable ids. Booked slots are returned too (so calendars can render them).
    """
    try:
        start_day = date.fromisoformat(from_date)
        end_day = date.fromisoformat(to_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="from/to must be YYYY-MM-DD dates")
    if (end_day - start_day).days > MAX_SLOT_RANGE_DAYS:
        raise HTTPException(
            status_code=400,
            detail=f"Date range limited to {MAX_SLOT_RANGE_DAYS} days",
        )

    avail_rows = (
        service_supabase.table("availability_slots")
        .select("id, day_of_week, start_time, end_time, timezone, is_active")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .execute()
    )
    avail = avail_rows.data or []

    if not avail:
        return {"slots": [], "generated": 0}

    # Existing booked slots for the user within the range (exclude overlaps).
    existing = (
        service_supabase.table("meeting_time_slots")
        .select(
            "id, availability_slot_id, starts_at, ends_at, is_booked, meeting_id, "
            "meetings(id, title, status)"
        )
        .in_(
            "availability_slot_id",
            [a["id"] for a in avail],
        )
        .execute()
    )
    existing_rows = existing.data or []
    booked_ranges: list[tuple[datetime, datetime]] = []
    for r in existing_rows:
        if r.get("is_booked"):
            try:
                booked_ranges.append(
                    (datetime.fromisoformat(r["starts_at"]), datetime.fromisoformat(r["ends_at"]))
                )
            except (KeyError, ValueError):
                pass

    def _overlaps(s: datetime, e: datetime) -> bool:
        return any(not (e <= bs or s >= be) for bs, be in booked_ranges)

    generated = 0
    day = start_day
    while day <= end_day:
        for a in avail:
            if a["day_of_week"] != day.weekday():
                continue
            tz = _tz_for(a.get("timezone"))
            try:
                local_start = datetime.combine(day, time.fromisoformat(a["start_time"]), tzinfo=tz)
                local_end = datetime.combine(day, time.fromisoformat(a["end_time"]), tzinfo=tz)
            except ValueError:
                continue
            cursor = local_start
            while cursor + timedelta(minutes=DEFAULT_DURATION_MINUTES) <= local_end:
                s = cursor
                e = cursor + timedelta(minutes=DEFAULT_DURATION_MINUTES)
                cursor = e
                if _overlaps(s, e):
                    continue
                try:
                    upsert = (
                        service_supabase.table("meeting_time_slots")
                        .insert(
                            {
                                "availability_slot_id": a["id"],
                                "starts_at": s.isoformat(),
                                "ends_at": e.isoformat(),
                                "is_booked": False,
                            }
                        )
                        .execute()
                    )
                    if upsert.data:
                        generated += 1
                except Exception as exc:
                    logger.warning("Slot insert failed: %s", exc)
        day += timedelta(days=1)

    all_rows = (
        service_supabase.table("meeting_time_slots")
        .select(
            "id, availability_slot_id, starts_at, ends_at, is_booked, meeting_id, "
            "meetings(id, title, status, organizer_id)"
        )
        .in_("availability_slot_id", [a["id"] for a in avail])
        .order("starts_at")
        .execute()
    )
    return {"slots": all_rows.data or [], "generated": generated}


# ---------------------------------------------------------------------------
# meetings
# ---------------------------------------------------------------------------
class BookMeetingIn(BaseModel):
    time_slot_id: str
    title: str = "Intro meeting"
    description: str = ""
    duration_minutes: int = DEFAULT_DURATION_MINUTES


class CreateMeetingIn(BaseModel):
    title: str = Field(..., min_length=1, max_length=120)
    description: str = ""
    scheduled_at: str = Field(..., description="ISO 8601 timestamp")
    duration_minutes: int = DEFAULT_DURATION_MINUTES
    participant_id: Optional[str] = None


@router.post("/meetings")
async def create_meeting(payload: CreateMeetingIn, user_id: str = Depends(get_user_id)):
    """Create a meeting directly (no availability booking needed).

    Generates the invite link immediately so it can be shared before the call.
    participant_id is optional — the meeting works as a standalone room.
    """
    try:
        start_dt = datetime.fromisoformat(payload.scheduled_at.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=400, detail="scheduled_at must be a valid ISO 8601 timestamp")

    if start_dt.tzinfo is None:
        start_dt = start_dt.replace(tzinfo=timezone.utc)
    if start_dt <= datetime.now(timezone.utc) - timedelta(minutes=1):
        raise HTTPException(status_code=400, detail="Meeting time must be in the future")

    duration = payload.duration_minutes or DEFAULT_DURATION_MINUTES
    if duration < 5 or duration > 240:
        raise HTTPException(status_code=400, detail="Duration must be between 5 and 240 minutes")

    participant_id = payload.participant_id or None
    if participant_id and str(participant_id) == str(user_id):
        raise HTTPException(status_code=400, detail="You can't create a meeting with yourself")

    end_dt = start_dt + timedelta(minutes=duration)
    google_link = create_google_meet_link(
        summary=payload.title,
        starts_at=start_dt.isoformat(),
        ends_at=end_dt.isoformat(),
        attendee_emails=[e for e in (user_email(user_id),) + ((user_email(participant_id),) if participant_id else ()) if e],
    )

    meeting_row = {
        "organizer_id": user_id,
        "participant_id": participant_id,
        "title": payload.title,
        "description": payload.description,
        "scheduled_at": start_dt.isoformat(),
        "duration_minutes": duration,
        "status": "scheduled",
        "meet_link": _built_in_meet_link(),
        "google_meet_link": google_link,
    }
    created = service_supabase.table("meetings").insert(meeting_row).execute()
    if not created.data:
        raise HTTPException(status_code=500, detail="Could not create meeting")
    meeting = created.data[0]

    if participant_id:
        organizer_name = user_full_name(user_id) or "A FounderHub user"
        _notify_user(
            participant_id,
            "meeting",
            "You're invited to a meeting",
            f"{organizer_name} invited you: {payload.title}",
            {"meeting_id": meeting["id"], "scheduled_at": start_dt.isoformat()},
        )
        email = user_email(participant_id)
        if email:
            send_meeting_confirmation_email(email, user_full_name(participant_id) or "There", meeting, organizer_name)

    return {"meeting": meeting}


@router.post("/meetings/book")
async def book_meeting(payload: BookMeetingIn, user_id: str = Depends(get_user_id)):
    slot = (
        service_supabase.table("meeting_time_slots")
        .select("*, availability_slots(user_id, timezone)")
        .eq("id", payload.time_slot_id)
        .limit(1)
        .execute()
    )
    if not slot.data:
        raise HTTPException(status_code=404, detail="Time slot not found")
    slot_row = slot.data[0]
    if slot_row.get("is_booked"):
        raise HTTPException(status_code=409, detail="That time slot was just booked")

    host_id = slot_row.get("availability_slots", {}).get("user_id") if slot_row.get("availability_slots") else None
    if not host_id:
        raise HTTPException(status_code=400, detail="Time slot has no owner")
    if str(host_id) == str(user_id):
        raise HTTPException(status_code=400, detail="You can't book a meeting with yourself")

    scheduled_at = slot_row["starts_at"]
    ends_at = slot_row["ends_at"]
    try:
        start_dt = datetime.fromisoformat(scheduled_at)
        end_dt = datetime.fromisoformat(ends_at)
    except (KeyError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid slot times")

    duration = payload.duration_minutes or DEFAULT_DURATION_MINUTES

    organizer_name = user_full_name(user_id) or "A FounderHub user"
    host_name = user_full_name(host_id) or "Your host"
    google_link = create_google_meet_link(
        summary=payload.title,
        starts_at=start_dt.isoformat(),
        ends_at=end_dt.isoformat(),
        attendee_emails=[e for e in (user_email(user_id), user_email(host_id)) if e],
    )

    meeting_row = {
        "organizer_id": user_id,
        "participant_id": host_id,
        "title": payload.title,
        "description": payload.description,
        "scheduled_at": scheduled_at,
        "duration_minutes": duration,
        "status": "scheduled",
        "meet_link": _built_in_meet_link(),
        "google_meet_link": google_link,
    }
    created = service_supabase.table("meetings").insert(meeting_row).execute()
    if not created.data:
        raise HTTPException(status_code=500, detail="Could not create meeting")
    meeting = created.data[0]

    service_supabase.table("meeting_time_slots").update(
        {"is_booked": True, "meeting_id": meeting["id"]}
    ).eq("id", payload.time_slot_id).execute()

    # In-app notification to the host.
    _notify_user(
        host_id,
        "meeting",
        "New meeting booked",
        f"{organizer_name} booked a meeting: {payload.title}",
        {"meeting_id": meeting["id"], "scheduled_at": scheduled_at},
    )

    # Confirmation emails to both sides (best-effort).
    for uid, display_name in ((user_id, organizer_name), (host_id, host_name)):
        email = user_email(uid)
        if email:
            other = host_name if uid == user_id else organizer_name
            send_meeting_confirmation_email(email, display_name, meeting, other)

    return {"meeting": meeting, "host": {"id": host_id, "full_name": host_name}}


class JoinByLinkIn(BaseModel):
    link: str


@router.post("/meetings/join-by-link")
async def join_meeting_by_link(payload: JoinByLinkIn, user_id: str = Depends(get_user_id)):
    """Resolve an invite link to a meeting and open the call.

    The person pasting the link claims the participant slot when it is still
    open (participant_id is null), so the meeting shows up in their list too.
    """
    link = (payload.link or "").strip()
    if not link:
        raise HTTPException(status_code=400, detail="Paste the invite link to join the meeting")

    query = (
        service_supabase.table("meetings")
        .select(_meeting_with_profiles())
        .limit(1)
    )
    exact = query.eq("meet_link", link).execute()
    meeting = exact.data[0] if exact.data else None

    if not meeting:
        room_id = _extract_room_id(link)
        if room_id:
            by_room = (
                service_supabase.table("meetings")
                .select(_meeting_with_profiles())
                .ilike("meet_link", f"%{room_id}%")
                .limit(1)
                .execute()
            )
            meeting = by_room.data[0] if by_room.data else None

    if not meeting:
        raise HTTPException(status_code=404, detail="No meeting found for that invite link")

    if meeting["status"] == "cancelled":
        raise HTTPException(status_code=400, detail="This meeting was cancelled")

    if str(meeting["organizer_id"]) != str(user_id) and not meeting.get("participant_id"):
        claimed = (
            service_supabase.table("meetings")
            .update({"participant_id": user_id})
            .eq("id", meeting["id"])
            .execute()
        )
        if claimed.data:
            meeting["participant_id"] = user_id

    return {"meeting": meeting, "room_id": _extract_room_id(meeting["meet_link"])}


@router.get("/meetings")
async def list_meetings(
    status: str = Query("upcoming"),
    user_id: str = Depends(get_user_id),
):
    now = datetime.now(timezone.utc)
    rows = (
        service_supabase.table("meetings")
        .select(
            "*, organizer:profiles!meetings_organizer_id_fkey(" + _profile_select() + "), "
            "participant:profiles!meetings_participant_id_fkey(" + _profile_select() + ")"
        )
        .or_(f"organizer_id.eq.{user_id},participant_id.eq.{user_id}")
        .execute()
    )
    meetings = rows.data or []
    for m in meetings:
        try:
            m["_at"] = datetime.fromisoformat(m["scheduled_at"])
        except (KeyError, ValueError):
            m["_at"] = now

    if status == "upcoming":
        meetings = [m for m in meetings if m["status"] == "scheduled" and m["_at"] >= now]
        meetings.sort(key=lambda m: m["_at"])
    elif status == "past":
        meetings = [m for m in meetings if m["status"] != "scheduled" or m["_at"] < now]
        meetings.sort(key=lambda m: m["_at"], reverse=True)
    else:
        meetings = [m for m in meetings if m["status"] == status]
        meetings.sort(key=lambda m: m["_at"])

    for m in meetings:
        m.pop("_at", None)
    return {"meetings": meetings}


@router.get("/meetings/{meeting_id}")
async def get_meeting(meeting_id: str, user_id: str = Depends(get_user_id)):
    row = (
        service_supabase.table("meetings")
        .select(
            "*, organizer:profiles!meetings_organizer_id_fkey(" + _profile_select() + "), "
            "participant:profiles!meetings_participant_id_fkey(" + _profile_select() + ")"
        )
        .eq("id", meeting_id)
        .limit(1)
        .execute()
    )
    if not row.data:
        raise HTTPException(status_code=404, detail="Meeting not found")
    meeting = row.data[0]
    if str(meeting["organizer_id"]) != str(user_id) and str(meeting["participant_id"] or "") != str(user_id):
        raise HTTPException(status_code=403, detail="Not your meeting")
    return {"meeting": meeting}


class MeetingUpdateIn(BaseModel):
    status: Optional[str] = None  # scheduled | cancelled | completed
    title: Optional[str] = None
    description: Optional[str] = None
    scheduled_at: Optional[str] = None
    duration_minutes: Optional[int] = None
    participant_id: Optional[str] = None


@router.patch("/meetings/{meeting_id}")
async def update_meeting(
    meeting_id: str,
    payload: MeetingUpdateIn,
    user_id: str = Depends(get_user_id),
):
    meeting = _get_meeting_for_user(meeting_id, user_id)
    updates: dict = {}
    if payload.status:
        if payload.status not in ("scheduled", "cancelled", "completed"):
            raise HTTPException(status_code=400, detail="Invalid status")
        updates["status"] = payload.status
    if payload.title is not None:
        updates["title"] = payload.title
    if payload.description is not None:
        updates["description"] = payload.description
    if payload.scheduled_at is not None:
        try:
            start_dt = datetime.fromisoformat(payload.scheduled_at.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(status_code=400, detail="scheduled_at must be a valid ISO 8601 timestamp")
        if start_dt.tzinfo is None:
            start_dt = start_dt.replace(tzinfo=timezone.utc)
        updates["scheduled_at"] = start_dt.isoformat()
    if payload.duration_minutes is not None:
        if payload.duration_minutes < 5 or payload.duration_minutes > 240:
            raise HTTPException(status_code=400, detail="Duration must be between 5 and 240 minutes")
        updates["duration_minutes"] = payload.duration_minutes
    if payload.participant_id is not None:
        pid = payload.participant_id or None
        if pid and str(pid) == str(user_id):
            raise HTTPException(status_code=400, detail="You can't meet with yourself")
        updates["participant_id"] = pid
    if not updates:
        return {"meeting": meeting}

    result = (
        service_supabase.table("meetings")
        .update(updates)
        .eq("id", meeting_id)
        .execute()
    )
    updated = result.data[0] if result.data else meeting

    # Let the participant know the meeting changed (reschedule/rename).
    pid = updated.get("participant_id")
    if pid and str(pid) != str(user_id) and (
        "scheduled_at" in updates or "title" in updates or "duration_minutes" in updates
    ):
        name = user_full_name(user_id) or "A FounderHub user"
        _notify_user(
            pid,
            "meeting",
            "Meeting updated",
            f"{name} updated the meeting: {updated.get('title', meeting.get('title'))}",
            {"meeting_id": meeting_id, "scheduled_at": updated.get("scheduled_at")},
        )
        email = user_email(pid)
        if email:
            send_meeting_confirmation_email(email, user_full_name(pid) or "There", updated, name)

    return {"meeting": updated}


class NotesIn(BaseModel):
    notes: str = ""


@router.post("/meetings/{meeting_id}/notes")
async def save_meeting_notes(
    meeting_id: str,
    payload: NotesIn,
    user_id: str = Depends(get_user_id),
):
    meeting = _get_meeting_for_user(meeting_id, user_id)
    now = datetime.now(timezone.utc).isoformat()
    result = (
        service_supabase.table("meetings")
        .update({"notes": payload.notes, "notes_updated_at": now})
        .eq("id", meeting_id)
        .execute()
    )
    return {"meeting": result.data[0] if result.data else {**meeting, "notes": payload.notes, "notes_updated_at": now}}


def _get_meeting_for_user(meeting_id: str, user_id: str) -> dict:
    row = (
        service_supabase.table("meetings")
        .select("*")
        .eq("id", meeting_id)
        .limit(1)
        .execute()
    )
    if not row.data:
        raise HTTPException(status_code=404, detail="Meeting not found")
    meeting = row.data[0]
    if str(meeting["organizer_id"]) != str(user_id) and str(meeting["participant_id"] or "") != str(user_id):
        raise HTTPException(status_code=403, detail="Not your meeting")
    return meeting
