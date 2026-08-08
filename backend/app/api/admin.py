"""Enterprise admin API for FounderHub.

Everything lives under `/api/admin` and every route requires an admin session
(`RequireAdmin`). The most sensitive operations (changing a user's primary
role, resetting passwords, system settings) additionally require the super
admin from the environment bootstrap.
"""
import datetime
import time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.core.admin_events import insert_admin_notification, log_audit
from app.core.auth import get_user_id
from app.core.rbac import ALL_ROLES, ADMIN_ROLES
from app.core.rate_limit import rate_limited
from app.core.security import RequireAdmin
from app.core.supabase import service_supabase, single_row
from app.core.users import user_email

router = APIRouter(prefix="/api/admin", tags=["admin"])

BOOT_TIME = time.time()

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _client_info(request: Request) -> tuple[Optional[str], Optional[str]]:
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    return ip, ua


def _now() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def _email(user_id: str) -> Optional[str]:
    return user_email(user_id)


def _ts(value) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            dt = datetime.datetime.fromisoformat(value.replace("Z", "+00:00"))
            return dt.timestamp()
        except Exception:
            return 0.0
    return 0.0


def _page_query(limit: int, offset: int):
    return max(1, min(limit, 500)), max(0, offset)


def _mask(value: dict, secret_paths: list[list[str]]) -> dict:
    """Deep-copy a settings value, masking secret leaves."""
    result = dict(value)

    def walk(node: dict, path: list[str]):
        for key, val in list(node.items()):
            p = path + [key]
            if isinstance(val, dict):
                walk(val, p)
            elif any(p == s for s in secret_paths) and val:
                node[key] = "••••••••"

    walk(result, [])
    return result


# ---------------------------------------------------------------------------
# Me + overview
# ---------------------------------------------------------------------------


@router.get("/me")
async def admin_me(
    request: Request,
    admin_id: str = Depends(RequireAdmin()),
    user_id: str = Depends(get_user_id),
):
    profile = single_row(
        service_supabase.table("profiles")
        .select(
            "id, full_name, username, role, is_admin, is_super_admin, is_verified, is_premium, avatar_url, created_at"
        )
        .eq("id", admin_id)
        .maybe_single()
        .execute()
    )
    data = profile or {"id": admin_id}
    data["email"] = _email(admin_id)
    data["is_super_admin"] = bool(data.get("is_super_admin"))
    data["is_admin"] = bool(data.get("is_admin"))

    unread = 0
    try:
        res = (
            service_supabase.table("admin_notifications")
            .select("id", count="exact")
            .eq("is_read", False)
            .execute()
        )
        unread = res.count or 0
    except Exception:
        pass

    permissions = []
    try:
        perms = service_supabase.table("permissions").select("code, name, module").execute()
        permissions = perms.data or []
    except Exception:
        pass

    return {"profile": data, "unread_notifications": unread, "permissions": permissions}


@router.get("/overview")
async def admin_overview(
    request: Request,
    admin_id: str = Depends(RequireAdmin()),
):
    def count(table: str, **filters) -> int:
        try:
            query = service_supabase.table(table).select("id", count="exact")
            for col, val in filters.items():
                if col.endswith("__gte"):
                    query = query.gte(col[:-5], val)
                elif col.endswith("__lt"):
                    query = query.lt(col[:-4], val)
                else:
                    query = query.eq(col, val)
            return query.execute().count or 0
        except Exception:
            return 0

    week_ago = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=7)).isoformat()
    total_users = count("profiles")
    new_users = count("profiles", created_at__gte=week_ago)
    total_startups = count("startups")
    published = count("startups", is_published=True)
    investors = count("profiles", role="investor")
    pending_roles = count("role_requests", status="pending")
    open_reports = count("reports", status="open")
    unread = count("admin_notifications", is_read=False)

    subscriptions = {"active": 0, "mrr_cents": 0}
    try:
        subs = (
            service_supabase.table("subscriptions")
            .select("status, amount_cents")
            .eq("status", "active")
            .execute()
        )
        rows = subs.data or []
        subscriptions["active"] = len(rows)
        subscriptions["mrr_cents"] = sum(int(r.get("amount_cents") or 0) for r in rows)
    except Exception:
        pass

    stats = {"today": {"requests": 0, "errors": 0, "avg_latency_ms": 0}}
    try:
        row = single_row(
            service_supabase.table("request_stats")
            .select("*")
            .eq("day", datetime.date.today().isoformat())
            .maybe_single()
            .execute()
        )
        if row:
            stats["today"] = row
    except Exception:
        pass

    return {
        "users": {"total": total_users, "new_7d": new_users},
        "startups": {"total": total_startups, "published": published},
        "investors": investors,
        "role_requests": {"pending": pending_roles},
        "reports": {"open": open_reports},
        "notifications": {"unread": unread},
        "subscriptions": subscriptions,
        "request_stats": stats,
    }


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------


@router.get("/users")
async def admin_users(
    request: Request,
    search: Optional[str] = None,
    role: Optional[str] = None,
    verified: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    admin_id: str = Depends(RequireAdmin()),
):
    limit, offset = _page_query(limit, offset)
    query = (
        service_supabase.table("profiles")
        .select(
            "id, full_name, username, role, is_admin, is_super_admin, is_verified, is_premium, "
            "suspended_at, banned_at, created_at"
        )
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
    )
    if search:
        query = query.or_(f"full_name.ilike.%{search}%,username.ilike.%{search}%,email.ilike.%{search}%")
    if role:
        query = query.eq("role", role)
    if verified == "true":
        query = query.eq("is_verified", True)
    elif verified == "false":
        query = query.eq("is_verified", False)

    result = query.execute()
    rows = result.data or []

    ids = [r["id"] for r in rows]
    emails: dict[str, Optional[str]] = {}
    for rid in ids:
        emails[rid] = _email(rid)

    users = []
    for r in rows:
        users.append(
            {
                "id": r["id"],
                "full_name": r.get("full_name"),
                "username": r.get("username"),
                "email": r.get("email") or emails.get(r["id"]),
                "role": r.get("role") or "founder",
                "is_admin": bool(r.get("is_admin")),
                "is_super_admin": bool(r.get("is_super_admin")),
                "is_verified": bool(r.get("is_verified")),
                "is_premium": bool(r.get("is_premium")),
                "is_suspended": bool(r.get("suspended_at")),
                "is_banned": bool(r.get("banned_at")),
                "created_at": r.get("created_at"),
            }
        )
    return {"users": users}


class UpdateUserRequest(BaseModel):
    full_name: Optional[str] = None
    username: Optional[str] = None
    bio: Optional[str] = None
    location: Optional[str] = None
    company: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    is_verified: Optional[bool] = None
    is_premium: Optional[bool] = None
    is_open_to_work: Optional[bool] = None
    skills: Optional[list[str]] = None
    investor_interests: Optional[list[str]] = None
    investment_range_min: Optional[int] = None
    investment_range_max: Optional[int] = None
    investment_stage: Optional[list[str]] = None
    portfolio_companies: Optional[list[str]] = None


@router.patch("/users/{user_id}")
async def admin_update_user(
    user_id: str,
    payload: UpdateUserRequest,
    request: Request,
    admin_id: str = Depends(RequireAdmin()),
):
    profile = single_row(
        service_supabase.table("profiles").select("id").eq("id", user_id).maybe_single().execute()
    )
    if not profile:
        raise HTTPException(status_code=404, detail="User not found")

    updates = {k: v for k, v in payload.dict().items() if v is not None}
    if not updates:
        return {"success": True, "updated": {}}

    service_supabase.table("profiles").update(updates).eq("id", user_id).execute()
    ip, ua = _client_info(request)
    log_audit(
        admin_id, _email(admin_id), "user.update", "user", user_id,
        new_value=updates, ip=ip, user_agent=ua,
    )
    return {"success": True, "updated": updates}


@router.post("/users/{user_id}/verify")
async def admin_verify_user(
    user_id: str,
    request: Request,
    admin_id: str = Depends(RequireAdmin()),
):
    service_supabase.table("profiles").update({"is_verified": True}).eq("id", user_id).execute()
    ip, ua = _client_info(request)
    log_audit(admin_id, _email(admin_id), "user.verify", "user", user_id, ip=ip, user_agent=ua)
    return {"success": True}


class SuspendRequest(BaseModel):
    reason: str = Field(default="", max_length=1000)


@router.post("/users/{user_id}/suspend")
async def admin_suspend_user(
    user_id: str,
    payload: SuspendRequest,
    request: Request,
    admin_id: str = Depends(RequireAdmin()),
):
    service_supabase.table("profiles").update(
        {"suspended_at": _now(), "suspension_reason": payload.reason}
    ).eq("id", user_id).execute()
    ip, ua = _client_info(request)
    log_audit(admin_id, _email(admin_id), "user.suspend", "user", user_id, ip=ip, user_agent=ua)
    insert_admin_notification("user_suspended", "User suspended", "A user was suspended.")
    return {"success": True}


@router.post("/users/{user_id}/unsuspend")
async def admin_unsuspend_user(
    user_id: str,
    request: Request,
    admin_id: str = Depends(RequireAdmin()),
):
    service_supabase.table("profiles").update(
        {"suspended_at": None, "suspension_reason": None}
    ).eq("id", user_id).execute()
    ip, ua = _client_info(request)
    log_audit(admin_id, _email(admin_id), "user.unsuspend", "user", user_id, ip=ip, user_agent=ua)
    return {"success": True}


@router.post("/users/{user_id}/ban")
async def admin_ban_user(
    user_id: str,
    payload: SuspendRequest,
    request: Request,
    admin_id: str = Depends(RequireAdmin()),
):
    service_supabase.table("profiles").update(
        {"banned_at": _now(), "ban_reason": payload.reason, "is_admin": False}
    ).eq("id", user_id).execute()
    ip, ua = _client_info(request)
    log_audit(admin_id, _email(admin_id), "user.ban", "user", user_id, ip=ip, user_agent=ua)
    return {"success": True}


@router.post("/users/{user_id}/unban")
async def admin_unban_user(
    user_id: str,
    request: Request,
    admin_id: str = Depends(RequireAdmin()),
):
    service_supabase.table("profiles").update(
        {"banned_at": None, "ban_reason": None}
    ).eq("id", user_id).execute()
    ip, ua = _client_info(request)
    log_audit(admin_id, _email(admin_id), "user.unban", "user", user_id, ip=ip, user_agent=ua)
    return {"success": True}


class ChangeRoleRequest(BaseModel):
    role: str = Field(min_length=1, max_length=40)


@router.post("/users/{user_id}/change-role")
async def admin_change_role(
    user_id: str,
    payload: ChangeRoleRequest,
    request: Request,
    admin_id: str = Depends(RequireAdmin(super_admin=True)),
):
    """Change a user's single primary role (super admin only)."""
    if payload.role not in ALL_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")

    profile = single_row(
        service_supabase.table("profiles")
        .select("id, role")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    if not profile:
        raise HTTPException(status_code=404, detail="User not found")
    old = profile.get("role")
    updates = {"role": payload.role}
    if payload.role in ADMIN_ROLES:
        updates["is_admin"] = True
    else:
        updates["is_admin"] = False
    service_supabase.table("profiles").update(updates).eq("id", user_id).execute()

    try:
        service_supabase.table("user_roles").delete().eq("user_id", user_id).execute()
    except Exception:
        pass

    ip, ua = _client_info(request)
    log_audit(
        admin_id, _email(admin_id), "user.change_role", "user", user_id,
        old_value={"role": old}, new_value={"role": payload.role}, ip=ip, user_agent=ua,
    )
    return {"success": True, "previous_role": old, "role": payload.role}


class ResetPasswordRequest(BaseModel):
    new_password: str = Field(min_length=8, max_length=128)


@router.post("/users/{user_id}/reset-password")
async def admin_reset_password(
    user_id: str,
    payload: ResetPasswordRequest,
    request: Request,
    admin_id: str = Depends(RequireAdmin(super_admin=True)),
):
    """Force a password reset for a user (super admin only)."""
    try:
        service_supabase.auth.admin.update_user_by_id(user_id, {"password": payload.new_password})
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to reset password: {exc}") from exc
    ip, ua = _client_info(request)
    log_audit(admin_id, _email(admin_id), "user.reset_password", "user", user_id, ip=ip, user_agent=ua)
    return {"success": True}


@router.delete("/users/{user_id}")
async def admin_delete_user(
    user_id: str,
    request: Request,
    admin_id: str = Depends(RequireAdmin(super_admin=True)),
):
    """Permanently delete a user (super admin only)."""
    if str(user_id) == str(admin_id):
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    try:
        service_supabase.auth.admin.delete_user(user_id)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to delete user: {exc}") from exc
    ip, ua = _client_info(request)
    log_audit(admin_id, _email(admin_id), "user.delete", "user", user_id, ip=ip, user_agent=ua)
    return {"success": True}


# ---------------------------------------------------------------------------
# Startups
# ---------------------------------------------------------------------------


@router.get("/startups")
async def admin_startups(
    request: Request,
    search: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    admin_id: str = Depends(RequireAdmin()),
):
    limit, offset = _page_query(limit, offset)
    query = (
        service_supabase.table("startups")
        .select(
            "id, name, tagline, industry, stage, location, is_published, is_featured, is_verified, "
            "is_hidden, founder_id, created_at"
        )
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
    )
    if search:
        query = query.or_(f"name.ilike.%{search}%,tagline.ilike.%{search}%,industry.ilike.%{search}%")
    if status == "published":
        query = query.eq("is_published", True)
    elif status == "draft":
        query = query.eq("is_published", False)
    elif status == "featured":
        query = query.eq("is_featured", True)
    elif status == "hidden":
        query = query.eq("is_hidden", True)

    rows = (query.execute().data) or []
    founder_ids = list(dict.fromkeys(r.get("founder_id") for r in rows if r.get("founder_id")))
    names: dict[str, str] = {}
    if founder_ids:
        try:
            founders = (
                service_supabase.table("profiles")
                .select("id, full_name")
                .in_("id", founder_ids)
                .execute()
            )
            for f in founders.data or []:
                names[f["id"]] = f.get("full_name") or f["id"]
        except Exception:
            pass

    return {
        "startups": [
            {
                **{k: r.get(k) for k in r.keys()},
                "founder_name": names.get(r.get("founder_id")) or r.get("founder_id"),
            }
            for r in rows
        ]
    }


class UpdateStartupRequest(BaseModel):
    is_featured: Optional[bool] = None
    is_verified: Optional[bool] = None
    is_hidden: Optional[bool] = None
    is_published: Optional[bool] = None


@router.patch("/startups/{startup_id}")
async def admin_update_startup(
    startup_id: str,
    payload: UpdateStartupRequest,
    request: Request,
    admin_id: str = Depends(RequireAdmin()),
):
    row = single_row(
        service_supabase.table("startups")
        .select("id, name")
        .eq("id", startup_id)
        .maybe_single()
        .execute()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Startup not found")
    updates = {k: v for k, v in payload.dict().items() if v is not None}
    if not updates:
        return {"success": True, "updated": {}}
    service_supabase.table("startups").update(updates).eq("id", startup_id).execute()
    ip, ua = _client_info(request)
    log_audit(
        admin_id, _email(admin_id), "startup.update", "startup", startup_id,
        new_value=updates, ip=ip, user_agent=ua,
    )
    return {"success": True, "updated": updates}


@router.delete("/startups/{startup_id}")
async def admin_delete_startup(
    startup_id: str,
    request: Request,
    admin_id: str = Depends(RequireAdmin(super_admin=True)),
):
    service_supabase.table("startups").delete().eq("id", startup_id).execute()
    ip, ua = _client_info(request)
    log_audit(admin_id, _email(admin_id), "startup.delete", "startup", startup_id, ip=ip, user_agent=ua)
    return {"success": True}


# ---------------------------------------------------------------------------
# Meetings moderation
# ---------------------------------------------------------------------------


@router.get("/meetings")
async def admin_meetings(
    request: Request,
    search: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    admin_id: str = Depends(RequireAdmin()),
):
    limit, offset = _page_query(limit, offset)
    query = (
        service_supabase.table("meetings")
        .select(
            "id, title, description, scheduled_at, status, duration_minutes, meet_link, "
            "organizer_id, participant_id, startup_id, created_at, started_at, ended_at, "
            "transcript, ai_summary, recording_url"
        )
        .order("scheduled_at", desc=True)
        .range(offset, offset + limit - 1)
    )
    if search:
        query = query.or_(f"title.ilike.%{search}%")
    if status in ("scheduled", "completed", "cancelled", "in_progress"):
        query = query.eq("status", status)

    rows = (query.execute().data) or []
    user_ids = list(
        dict.fromkeys(
            str(r.get("organizer_id")) for r in rows if r.get("organizer_id")
        )
        + [str(r.get("participant_id")) for r in rows if r.get("participant_id")]
    )
    names: dict[str, str] = {}
    if user_ids:
        try:
            users = (
                service_supabase.table("profiles")
                .select("id, full_name, username, role")
                .in_("id", user_ids)
                .execute()
            )
            for u in users.data or []:
                names[u["id"]] = u.get("full_name") or u.get("username") or u["id"]
        except Exception:
            pass

    return {
        "meetings": [
            {
                **{k: r.get(k) for k in r.keys()},
                "organizer_name": names.get(str(r.get("organizer_id"))) or r.get("organizer_id"),
                "participant_name": names.get(str(r.get("participant_id"))) or r.get("participant_id"),
                "has_transcript": bool((r.get("transcript") or "").strip()),
                "has_summary": bool(r.get("ai_summary")),
            }
            for r in rows
        ]
    }


@router.patch("/meetings/{meeting_id}")
async def admin_update_meeting(
    meeting_id: str,
    payload: dict,
    request: Request,
    admin_id: str = Depends(RequireAdmin()),
):
    row = single_row(
        service_supabase.table("meetings")
        .select("id, title")
        .eq("id", meeting_id)
        .maybe_single()
        .execute()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Meeting not found")
    allowed = {"status", "title", "description", "scheduled_at", "duration_minutes", "startup_id"}
    updates = {k: v for k, v in payload.items() if k in allowed and v is not None}
    if not updates:
        return {"success": True, "updated": {}}
    if "status" in updates and updates["status"] not in ("scheduled", "completed", "cancelled"):
        raise HTTPException(status_code=400, detail="Invalid status")
    service_supabase.table("meetings").update(updates).eq("id", meeting_id).execute()
    ip, ua = _client_info(request)
    log_audit(
        admin_id, _email(admin_id), "meeting.update", "meeting", meeting_id,
        new_value=updates, ip=ip, user_agent=ua,
    )
    return {"success": True, "updated": updates}


@router.delete("/meetings/{meeting_id}")
async def admin_delete_meeting(
    meeting_id: str,
    request: Request,
    admin_id: str = Depends(RequireAdmin(super_admin=True)),
):
    row = single_row(
        service_supabase.table("meetings")
        .select("id")
        .eq("id", meeting_id)
        .maybe_single()
        .execute()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Meeting not found")
    service_supabase.table("meetings").delete().eq("id", meeting_id).execute()
    ip, ua = _client_info(request)
    log_audit(admin_id, _email(admin_id), "meeting.delete", "meeting", meeting_id, ip=ip, user_agent=ua)
    return {"success": True}


# ---------------------------------------------------------------------------
# Investors
# ---------------------------------------------------------------------------


@router.get("/investors")
async def admin_investors(
    request: Request,
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    admin_id: str = Depends(RequireAdmin()),
):
    limit, offset = _page_query(limit, offset)
    query = (
        service_supabase.table("profiles")
        .select(
            "id, full_name, username, company, role, investment_range_min, investment_range_max, "
            "investment_stage, portfolio_companies, is_verified, is_premium, created_at"
        )
        .eq("role", "investor")
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
    )
    if search:
        query = query.or_(f"full_name.ilike.%{search}%,company.ilike.%{search}%,username.ilike.%{search}%")
    rows = query.execute().data or []
    investors = []
    for r in rows:
        investors.append(
            {
                **r,
                "email": r.get("email") or _email(r["id"]),
                "is_verified": bool(r.get("is_verified")),
                "is_premium": bool(r.get("is_premium")),
            }
        )
    return {"investors": investors}


# ---------------------------------------------------------------------------
# Role requests (admin side)
# ---------------------------------------------------------------------------


@router.get("/role-requests")
async def admin_role_requests(
    request: Request,
    status: Optional[str] = None,
    limit: int = 50,
    admin_id: str = Depends(RequireAdmin()),
):
    query = (
        service_supabase.table("role_requests")
        .select("*")
        .order("created_at", desc=True)
        .limit(min(limit, 200))
    )
    if status:
        query = query.eq("status", status)
    rows = query.execute().data or []
    user_ids = list(dict.fromkeys(r.get("user_id") for r in rows))
    names: dict[str, str] = {}
    if user_ids:
        try:
            profs = (
                service_supabase.table("profiles")
                .select("id, full_name")
                .in_("id", user_ids)
                .execute()
            )
            for p in profs.data or []:
                names[p["id"]] = p.get("full_name") or p["id"]
        except Exception:
            pass
    return {
        "requests": [
            {**r, "user_name": names.get(r.get("user_id")) or r.get("user_id")}
            for r in rows
        ]
    }


class ReviewRoleRequest(BaseModel):
    note: Optional[str] = None


@router.post("/role-requests/{request_id}/approve")
async def admin_approve_role_request(
    request_id: str,
    payload: ReviewRoleRequest,
    request: Request,
    admin_id: str = Depends(RequireAdmin(super_admin=True)),
):
    row = single_row(
        service_supabase.table("role_requests")
        .select("*")
        .eq("id", request_id)
        .maybe_single()
        .execute()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Role request not found")
    req = row
    if req.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Request already reviewed")

    new_role = req.get("requested_role")
    updates = {"role": new_role}
    if new_role in ADMIN_ROLES:
        updates["is_admin"] = True
    else:
        updates["is_admin"] = False
    service_supabase.table("profiles").update(updates).eq("id", req["user_id"]).execute()
    try:
        service_supabase.table("user_roles").delete().eq("user_id", req["user_id"]).execute()
    except Exception:
        pass
    service_supabase.table("role_requests").update(
        {"status": "approved", "admin_id": admin_id, "admin_note": payload.note, "reviewed_at": _now()}
    ).eq("id", request_id).execute()

    ip, ua = _client_info(request)
    log_audit(
        admin_id, _email(admin_id), "role_request.approve", "role_request", request_id,
        old_value={"from_role": req.get("from_role")}, new_value={"requested_role": new_role},
        ip=ip, user_agent=ua,
    )
    insert_admin_notification(
        "role_approved", "Role change approved",
        f"Your {new_role} role request was approved.",
        {"request_id": request_id, "user_id": req["user_id"]},
    )
    from app.services.notification_service import notify

    notify(
        req["user_id"],
        "role_approved",
        "Role request approved",
        f"Your {new_role} role request was approved.",
        {"request_id": request_id},
        template="role_approved",
        template_data={"role": new_role},
        dedupe_key=f"role_approved:{request_id}",
    )
    return {"success": True}


@router.post("/role-requests/{request_id}/reject")
async def admin_reject_role_request(
    request_id: str,
    payload: ReviewRoleRequest,
    request: Request,
    admin_id: str = Depends(RequireAdmin(super_admin=True)),
):
    row = single_row(
        service_supabase.table("role_requests")
        .select("*")
        .eq("id", request_id)
        .maybe_single()
        .execute()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Role request not found")
    req = row
    if req.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Request already reviewed")
    service_supabase.table("role_requests").update(
        {"status": "rejected", "admin_id": admin_id, "admin_note": payload.note, "reviewed_at": _now()}
    ).eq("id", request_id).execute()

    ip, ua = _client_info(request)
    log_audit(
        admin_id, _email(admin_id), "role_request.reject", "role_request", request_id,
        new_value={"status": "rejected"}, ip=ip, user_agent=ua,
    )
    from app.services.notification_service import notify

    notify(
        req["user_id"],
        "role_rejected",
        "Role request not approved",
        f"Your {req.get('requested_role')} role request was not approved.",
        {"request_id": request_id},
        template="role_rejected",
        template_data={"role": req.get("requested_role")},
        dedupe_key=f"role_rejected:{request_id}",
    )
    return {"success": True}


# ---------------------------------------------------------------------------
# Reports (admin side)
# ---------------------------------------------------------------------------


@router.get("/reports")
async def admin_reports(
    request: Request,
    status: Optional[str] = None,
    limit: int = 50,
    admin_id: str = Depends(RequireAdmin()),
):
    query = (
        service_supabase.table("reports")
        .select("*")
        .order("created_at", desc=True)
        .limit(min(limit, 200))
    )
    if status:
        query = query.eq("status", status)
    rows = query.execute().data or []
    reporter_ids = list(dict.fromkeys(r.get("reporter_id") for r in rows if r.get("reporter_id")))
    names: dict[str, str] = {}
    if reporter_ids:
        try:
            profs = (
                service_supabase.table("profiles")
                .select("id, full_name")
                .in_("id", reporter_ids)
                .execute()
            )
            for p in profs.data or []:
                names[p["id"]] = p.get("full_name") or p["id"]
        except Exception:
            pass
    return {
        "reports": [
            {**r, "reporter_name": names.get(r.get("reporter_id")) or r.get("reporter_id")}
            for r in rows
        ]
    }


class ResolveReportRequest(BaseModel):
    note: Optional[str] = None


@router.post("/reports/{report_id}/resolve")
async def admin_resolve_report(
    report_id: str,
    payload: ResolveReportRequest,
    request: Request,
    admin_id: str = Depends(RequireAdmin()),
):
    service_supabase.table("reports").update(
        {"status": "resolved", "admin_id": admin_id, "admin_note": payload.note, "resolved_at": _now()}
    ).eq("id", report_id).execute()
    ip, ua = _client_info(request)
    log_audit(admin_id, _email(admin_id), "report.resolve", "report", report_id, ip=ip, user_agent=ua)
    return {"success": True}


@router.post("/reports/{report_id}/dismiss")
async def admin_dismiss_report(
    report_id: str,
    payload: ResolveReportRequest,
    request: Request,
    admin_id: str = Depends(RequireAdmin()),
):
    service_supabase.table("reports").update(
        {"status": "dismissed", "admin_id": admin_id, "admin_note": payload.note, "resolved_at": _now()}
    ).eq("id", report_id).execute()
    ip, ua = _client_info(request)
    log_audit(admin_id, _email(admin_id), "report.dismiss", "report", report_id, ip=ip, user_agent=ua)
    return {"success": True}


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------


@router.get("/analytics")
async def admin_analytics(
    request: Request,
    admin_id: str = Depends(RequireAdmin()),
):
    now = time.time()
    day_sec = 86400
    week_ago = now - 7 * day_sec
    month_ago = now - 30 * day_sec

    try:
        profiles = service_supabase.table("profiles").select("id, role, created_at").execute()
        profile_rows = profiles.data or []
    except Exception:
        profile_rows = []

    roles: dict[str, int] = {}
    for p in profile_rows:
        r = p.get("role") or "founder"
        roles[r] = roles.get(r, 0) + 1

    last30 = [p for p in profile_rows if _ts(p.get("created_at")) >= month_ago]
    registrations_by_day: dict[str, int] = {}
    for p in last30:
        d = (p.get("created_at") or "")[:10]
        registrations_by_day[d] = registrations_by_day.get(d, 0) + 1

    dau_today = 0
    mau = 0
    events_total = 0
    try:
        events = (
            service_supabase.table("analytics_events")
            .select("event_type, user_id, created_at")
            .order("created_at", desc=True)
            .limit(5000)
            .execute()
        )
        ev = events.data or []
        events_total = len(ev)
        users_today = set()
        users_30 = set()
        for e in ev:
            uid = e.get("user_id")
            if not uid:
                continue
            t = _ts(e.get("created_at"))
            if t >= now - day_sec:
                users_today.add(uid)
            if t >= month_ago:
                users_30.add(uid)
        dau_today = len(users_today)
        mau = len(users_30)
    except Exception:
        pass

    try:
        stats_rows = (
            service_supabase.table("request_stats")
            .select("*")
            .order("day", desc=True)
            .limit(30)
            .execute()
        ).data or []
    except Exception:
        stats_rows = []

    return {
        "users": {
            "total": len(profile_rows),
            "by_role": sorted(({"role": r, "count": c} for r, c in roles.items()), key=lambda x: -x["count"]),
            "registrations_by_day": registrations_by_day,
        },
        "activity": {"dau": dau_today, "mau": mau, "events_total": events_total},
        "request_stats": stats_rows,
    }


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


@router.get("/health")
async def admin_health(
    request: Request,
    admin_id: str = Depends(RequireAdmin()),
):
    started = time.time()
    db_ok, db_ms = False, 0
    try:
        service_supabase.table("request_stats").select("day").limit(1).execute()
        db_ok = True
        db_ms = int((time.time() - started) * 1000)
    except Exception:
        db_ms = int((time.time() - started) * 1000)

    auth_ok, auth_ms = False, 0
    a0 = time.time()
    try:
        service_supabase.auth.admin.list_users(per_page=1)
        auth_ok = True
        auth_ms = int((time.time() - a0) * 1000)
    except Exception:
        auth_ms = int((time.time() - a0) * 1000)

    tables = {}
    for t in ["profiles", "startups", "applications", "meetings", "posts", "messages", "notifications", "reports"]:
        try:
            tables[t] = (
                service_supabase.table(t).select("id", count="exact").execute().count or 0
            )
        except Exception:
            tables[t] = -1

    return {
        "status": "ok" if db_ok and auth_ok else "degraded",
        "service": "FounderHub API",
        "time": _now(),
        "uptime_seconds": int(time.time() - BOOT_TIME),
        "database": {"ok": db_ok, "latency_ms": db_ms},
        "auth": {"ok": auth_ok, "latency_ms": auth_ms},
        "tables": tables,
    }


# ---------------------------------------------------------------------------
# Audit logs
# ---------------------------------------------------------------------------


@router.get("/audit-logs")
async def admin_audit_logs(
    request: Request,
    action: Optional[str] = None,
    limit: int = 100,
    admin_id: str = Depends(RequireAdmin()),
):
    query = (
        service_supabase.table("audit_logs")
        .select("*")
        .order("created_at", desc=True)
        .limit(min(limit, 500))
    )
    if action:
        query = query.eq("action", action)
    return {"logs": (query.execute().data) or []}


# ---------------------------------------------------------------------------
# Admin notifications
# ---------------------------------------------------------------------------


@router.get("/notifications")
async def admin_notifications(
    request: Request,
    unread: Optional[str] = None,
    limit: int = 50,
    admin_id: str = Depends(RequireAdmin()),
):
    query = (
        service_supabase.table("admin_notifications")
        .select("*")
        .order("created_at", desc=True)
        .limit(min(limit, 200))
    )
    if unread == "true":
        query = query.eq("is_read", False)
    return {"notifications": (query.execute().data) or []}


@router.post("/notifications/{notification_id}/read")
async def admin_notification_read(
    notification_id: str,
    request: Request,
    admin_id: str = Depends(RequireAdmin()),
):
    service_supabase.table("admin_notifications").update({"is_read": True}).eq("id", notification_id).execute()
    return {"success": True}


@router.post("/notifications/read-all")
async def admin_notification_read_all(
    request: Request,
    admin_id: str = Depends(RequireAdmin()),
):
    service_supabase.table("admin_notifications").update({"is_read": True}).eq("is_read", False).execute()
    return {"success": True}


@router.delete("/notifications/{notification_id}")
async def admin_notification_delete(
    notification_id: str,
    request: Request,
    admin_id: str = Depends(RequireAdmin()),
):
    service_supabase.table("admin_notifications").delete().eq("id", notification_id).execute()
    return {"success": True}


# ---------------------------------------------------------------------------
# CMS
# ---------------------------------------------------------------------------


@router.get("/cms/site-content")
async def admin_site_content(
    request: Request,
    admin_id: str = Depends(RequireAdmin()),
):
    rows = service_supabase.table("site_content").select("*").execute().data or []
    return {"content": rows}


class SiteContentRequest(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    meta: Optional[dict] = None


@router.put("/cms/site-content/{key}")
async def admin_put_site_content(
    key: str,
    payload: SiteContentRequest,
    request: Request,
    admin_id: str = Depends(RequireAdmin()),
):
    data = {"key": key, "updated_by": admin_id}
    if payload.title is not None:
        data["title"] = payload.title
    if payload.content is not None:
        data["content"] = payload.content
    if payload.meta is not None:
        data["meta"] = payload.meta
    service_supabase.table("site_content").upsert(data, on_conflict="key").execute()
    ip, ua = _client_info(request)
    log_audit(admin_id, _email(admin_id), "cms.update", "site_content", key, ip=ip, user_agent=ua)
    return {"success": True}


class BlogPostRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    slug: str = Field(min_length=1, max_length=200)
    excerpt: Optional[str] = None
    content: Optional[str] = None
    cover_url: Optional[str] = None
    status: Optional[str] = "draft"


@router.get("/cms/blog")
async def admin_blog_list(
    request: Request,
    admin_id: str = Depends(RequireAdmin()),
    limit: int = 100,
):
    rows = (
        service_supabase.table("blog_posts")
        .select("*")
        .order("created_at", desc=True)
        .limit(min(limit, 500))
        .execute()
    ).data or []
    return {"posts": rows}


@router.post("/cms/blog")
async def admin_blog_create(
    payload: BlogPostRequest,
    request: Request,
    admin_id: str = Depends(RequireAdmin()),
):
    data = payload.dict()
    data["author_id"] = admin_id
    if data.get("status") == "published":
        data["published_at"] = _now()
    result = service_supabase.table("blog_posts").insert(data).execute()
    return result.data[0]


@router.patch("/cms/blog/{post_id}")
async def admin_blog_update(
    post_id: str,
    payload: BlogPostRequest,
    request: Request,
    admin_id: str = Depends(RequireAdmin()),
):
    data = {k: v for k, v in payload.dict().items() if v is not None}
    if "status" in data and data["status"] == "published":
        data["published_at"] = _now()
    service_supabase.table("blog_posts").update(data).eq("id", post_id).execute()
    return {"success": True}


@router.delete("/cms/blog/{post_id}")
async def admin_blog_delete(
    post_id: str,
    request: Request,
    admin_id: str = Depends(RequireAdmin()),
):
    service_supabase.table("blog_posts").delete().eq("id", post_id).execute()
    return {"success": True}


class AnnouncementRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    body: Optional[str] = None
    audience: Optional[str] = "all"
    is_active: Optional[bool] = True


@router.get("/cms/announcements")
async def admin_announcements_list(
    request: Request,
    admin_id: str = Depends(RequireAdmin()),
):
    rows = (
        service_supabase.table("announcements")
        .select("*")
        .order("created_at", desc=True)
        .execute()
    ).data or []
    return {"announcements": rows}


@router.post("/cms/announcements")
async def admin_announcement_create(
    payload: AnnouncementRequest,
    request: Request,
    admin_id: str = Depends(RequireAdmin()),
):
    result = (
        service_supabase.table("announcements")
        .insert(payload.dict())
        .execute()
    )
    return result.data[0]


@router.patch("/cms/announcements/{announcement_id}")
async def admin_announcement_update(
    announcement_id: str,
    payload: AnnouncementRequest,
    request: Request,
    admin_id: str = Depends(RequireAdmin()),
):
    data = {k: v for k, v in payload.dict().items() if v is not None}
    service_supabase.table("announcements").update(data).eq("id", announcement_id).execute()
    return {"success": True}


@router.delete("/cms/announcements/{announcement_id}")
async def admin_announcement_delete(
    announcement_id: str,
    request: Request,
    admin_id: str = Depends(RequireAdmin()),
):
    service_supabase.table("announcements").delete().eq("id", announcement_id).execute()
    return {"success": True}


# ---------------------------------------------------------------------------
# AI
# ---------------------------------------------------------------------------


@router.get("/ai/usage")
async def admin_ai_usage(
    request: Request,
    admin_id: str = Depends(RequireAdmin()),
    limit: int = 100,
):
    limit = max(1, min(limit, 500))
    rows = (
        service_supabase.table("ai_usage_logs")
        .select("*")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    ).data or []
    ids = list(dict.fromkeys(r.get("user_id") for r in rows if r.get("user_id")))
    names: dict[str, str] = {}
    if ids:
        try:
            profs = (
                service_supabase.table("profiles")
                .select("id, full_name")
                .in_("id", ids)
                .execute()
            )
            for p in profs.data or []:
                names[p["id"]] = p.get("full_name") or p["id"]
        except Exception:
            pass
    return {
        "logs": [
            {**r, "user_name": names.get(r.get("user_id")) or r.get("user_id")}
            for r in rows
        ]
    }


@router.get("/ai/analytics")
async def admin_ai_analytics(
    request: Request,
    admin_id: str = Depends(RequireAdmin()),
):
    rows = (
        service_supabase.table("ai_usage_logs")
        .select("*")
        .order("created_at", desc=True)
        .limit(5000)
        .execute()
    ).data or []
    total = len(rows)
    successes = [r for r in rows if r.get("status") == "success"]
    now = time.time()
    by_tool: dict[str, int] = {}
    by_provider: dict[str, int] = {}
    last24 = 0
    for r in rows:
        slug = r.get("tool_slug") or "unknown"
        by_tool[slug] = by_tool.get(slug, 0) + 1
        prov = r.get("provider") or "unknown"
        by_provider[prov] = by_provider.get(prov, 0) + 1
        if _ts(r.get("created_at")) >= now - 86400:
            last24 += 1
    return {
        "total_runs": total,
        "successful_runs": len(successes),
        "failed_runs": total - len(successes),
        "last_24h": last24,
        "by_tool": sorted(({"tool": t, "runs": c} for t, c in by_tool.items()), key=lambda x: -x["runs"])[:20],
        "by_provider": sorted(({"provider": p, "runs": c} for p, c in by_provider.items()), key=lambda x: -x["runs"]),
    }


# ---------------------------------------------------------------------------
# Settings (super admin writes)
# ---------------------------------------------------------------------------

SECRET_PATHS: list[list[str]] = [
    ["stripe", "secret_key"],
    ["stripe", "webhook_secret"],
    ["smtp", "password"],
    ["ai_providers", "openai"],
    ["ai_providers", "gemini"],
    ["ai_providers", "claude"],
    ["ai_providers", "deepseek"],
    ["ai_providers", "groq"],
]


@router.get("/settings")
async def admin_settings(
    request: Request,
    admin_id: str = Depends(RequireAdmin()),
):
    rows = service_supabase.table("system_settings").select("*").execute().data or []
    settings = {}
    for r in rows:
        val = r.get("value") or {}
        if isinstance(val, dict):
            val = _mask(val, SECRET_PATHS)
        settings[r["key"]] = val
    return {"settings": settings}


class PutSettingsRequest(BaseModel):
    settings: dict


@router.put("/settings")
async def admin_put_settings(
    payload: PutSettingsRequest,
    request: Request,
    admin_id: str = Depends(RequireAdmin(super_admin=True)),
):
    """Upsert settings. Secret leaves sent back masked are preserved."""
    rows = service_supabase.table("system_settings").select("key, value").execute().data or []
    existing = {r["key"]: r.get("value") or {} for r in rows}

    for key, value in payload.settings.items():
        if not isinstance(value, dict):
            value = {"value": value}
        if isinstance(existing.get(key), dict) and isinstance(value, dict):
            for path in SECRET_PATHS:
                if path[0] != key:
                    continue
                leaf_key = path[1]
                incoming = value.get(leaf_key)
                if isinstance(incoming, str) and incoming in ("", "••••••••", "*", "masked"):
                    value[leaf_key] = existing[key].get(leaf_key)
        service_supabase.table("system_settings").upsert(
            {"key": key, "value": value, "updated_by": admin_id},
            on_conflict="key",
        ).execute()

    ip, ua = _client_info(request)
    log_audit(admin_id, _email(admin_id), "settings.update", "system_settings", None, ip=ip, user_agent=ua)
    return {"success": True, "updated_keys": list(payload.settings.keys())}


# ---------------------------------------------------------------------------
# Security
# ---------------------------------------------------------------------------


@router.get("/security/login-logs")
async def admin_login_logs(
    request: Request,
    limit: int = 100,
    admin_id: str = Depends(RequireAdmin()),
):
    rows = (
        service_supabase.table("login_logs")
        .select("*")
        .order("created_at", desc=True)
        .limit(min(limit, 500))
        .execute()
    ).data or []
    return {"logs": rows}


@router.post("/security/settings")
async def admin_security_settings(
    payload: PutSettingsRequest,
    request: Request,
    admin_id: str = Depends(RequireAdmin(super_admin=True)),
):
    """Update the `security` settings key (2FA, lockout policy)."""
    row = single_row(
        service_supabase.table("system_settings")
        .select("value")
        .eq("key", "security")
        .maybe_single()
        .execute()
    )
    current = (row or {}).get("value") or {}
    merged = {**current, **(payload.settings or {})}
    service_supabase.table("system_settings").upsert(
        {"key": "security", "value": merged, "updated_by": admin_id},
        on_conflict="key",
    ).execute()
    ip, ua = _client_info(request)
    log_audit(admin_id, _email(admin_id), "security.settings", "system_settings", "security", ip=ip, user_agent=ua)
    return {"success": True}


# ---------------------------------------------------------------------------
# Subscriptions
# ---------------------------------------------------------------------------


@router.get("/subscriptions")
async def admin_subscriptions(
    request: Request,
    status: Optional[str] = None,
    limit: int = 100,
    admin_id: str = Depends(RequireAdmin()),
):
    query = (
        service_supabase.table("subscriptions")
        .select("*")
        .order("started_at", desc=True)
        .limit(min(limit, 500))
    )
    if status:
        query = query.eq("status", status)
    return {"subscriptions": (query.execute().data) or []}


# ---------------------------------------------------------------------------
# Startup members
# ---------------------------------------------------------------------------


class MemberRequest(BaseModel):
    startup_id: str
    user_id: str
    permission: str = Field(default="viewer", pattern=r"^(owner|admin|editor|viewer)$")


@router.get("/startup-members")
async def admin_startup_members(
    request: Request,
    startup_id: Optional[str] = None,
    admin_id: str = Depends(RequireAdmin()),
):
    query = service_supabase.table("startup_members").select("*")
    if startup_id:
        query = query.eq("startup_id", startup_id)
    rows = (query.order("created_at", desc=True).limit(500).execute()).data or []

    ids = list(dict.fromkeys(r.get("user_id") for r in rows))
    names: dict[str, str] = {}
    if ids:
        try:
            profs = (
                service_supabase.table("profiles")
                .select("id, full_name")
                .in_("id", ids)
                .execute()
            )
            for p in profs.data or []:
                names[p["id"]] = p.get("full_name") or p["id"]
        except Exception:
            pass
    return {
        "members": [
            {**r, "user_name": names.get(r.get("user_id")) or r.get("user_id")}
            for r in rows
        ]
    }


@router.post("/startup-members")
async def admin_add_member(
    payload: MemberRequest,
    request: Request,
    admin_id: str = Depends(RequireAdmin()),
):
    startup = single_row(
        service_supabase.table("startups")
        .select("id")
        .eq("id", payload.startup_id)
        .maybe_single()
        .execute()
    )
    if not startup:
        raise HTTPException(status_code=404, detail="Startup not found")
    profile = single_row(
        service_supabase.table("profiles")
        .select("id")
        .eq("id", payload.user_id)
        .maybe_single()
        .execute()
    )
    if not profile:
        raise HTTPException(status_code=404, detail="User not found")
    result = (
        service_supabase.table("startup_members")
        .upsert(
            {
                "startup_id": payload.startup_id,
                "user_id": payload.user_id,
                "permission": payload.permission,
            },
            on_conflict="startup_id,user_id",
        )
        .execute()
    )
    return result.data[0]


@router.delete("/startup-members/{startup_id}/{user_id}")
async def admin_remove_member(
    startup_id: str,
    user_id: str,
    request: Request,
    admin_id: str = Depends(RequireAdmin()),
):
    service_supabase.table("startup_members").delete().eq("startup_id", startup_id).eq("user_id", user_id).execute()
    return {"success": True}
