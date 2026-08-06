"""Role-Based AI Studio API.

Serves the dynamic AI studio catalog for a user based on their roles, runs
role-scoped AI tools, and exposes admin endpoints to manage tools, roles and
usage analytics.
"""
from __future__ import annotations

import asyncio
import time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.ai import _resolve_user_provider, generate_text_sync
from app.core.auth import get_user_id
from app.core.rbac import ALL_ROLES, get_user_primary_role, get_user_roles, require_admin
from app.core.supabase import service_supabase
from app.services.ai_studio_catalog import (
    CATEGORY_ORDER,
    ROLE_STUDIO_LABELS,
    TOOL_BY_SLUG,
    TOOLS,
    ToolField,
)

router = APIRouter(prefix="/api/ai-studio", tags=["ai-studio"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _catalog_overrides() -> dict[str, dict]:
    """Every row in ai_tools (builtin overrides + custom tools), by slug."""
    try:
        result = service_supabase.table("ai_tools").select("*").execute()
        return {row["slug"]: row for row in result.data or []}
    except Exception:
        return {}


def _field_payload(field: ToolField) -> dict:
    return {
        "key": field.key,
        "label": field.label,
        "type": field.type,
        "required": field.required,
        "placeholder": field.placeholder,
        "options": field.options,
    }


def _builtin_payload(tool, db_row: Optional[dict]) -> dict:
    return {
        "slug": tool.slug,
        "name": tool.name,
        "description": tool.description,
        "category": tool.category,
        "icon": tool.icon,
        "roles": tool.roles,
        "prompt": tool.prompt,
        "fields": [_field_payload(f) for f in tool.fields],
        "output_format": tool.output_format,
        "is_builtin": True,
        "is_enabled": bool(db_row.get("is_enabled", True)) if db_row else True,
    }


def _custom_payload(db_row: dict) -> dict:
    fields = []
    for item in db_row.get("input_fields") or []:
        fields.append({
            "key": item.get("key", ""),
            "label": item.get("label", item.get("key", "")),
            "type": item.get("type", "text"),
            "required": bool(item.get("required", False)),
            "placeholder": item.get("placeholder", ""),
            "options": item.get("options"),
        })
    return {
        "slug": db_row["slug"],
        "name": db_row.get("name", db_row["slug"]),
        "description": db_row.get("description") or "",
        "category": db_row.get("category") or "General",
        "icon": db_row.get("icon") or "Sparkles",
        "roles": list(db_row.get("roles") or []),
        "prompt": db_row.get("prompt_template") or "",
        "fields": fields,
        "output_format": db_row.get("output_format") or "markdown",
        "is_builtin": False,
        "is_enabled": bool(db_row.get("is_enabled", True)),
    }


def _denied_pairs(roles: list[str]) -> set[tuple[str, str]]:
    """role_permissions rows where a role was explicitly denied a tool."""
    denied: set[tuple[str, str]] = set()
    try:
        result = (
            service_supabase.table("role_permissions")
            .select("role, tool_slug, is_enabled")
            .in_("role", roles)
            .execute()
        )
        for row in result.data or []:
            if not row.get("is_enabled", True):
                denied.add((row["role"], row["tool_slug"]))
    except Exception:
        pass
    return denied


def _tool_payload_admin(slug: str) -> dict:
    """Return tool payload for admin views — includes disabled tools."""
    overrides = _catalog_overrides()
    tool = TOOL_BY_SLUG.get(slug)
    if tool:
        return _builtin_payload(tool, overrides.get(slug))
    db_row = overrides.get(slug)
    if db_row:
        return _custom_payload(db_row)
    raise HTTPException(status_code=404, detail="AI tool not found")


def _resolve_tool(slug: str) -> dict:
    """Catalog or custom tool. Raises 403/404 when unavailable to anyone."""
    overrides = _catalog_overrides()
    tool = TOOL_BY_SLUG.get(slug)
    if tool:
        db_row = overrides.get(slug)
        if db_row is not None and not db_row.get("is_enabled", True):
            raise HTTPException(status_code=403, detail="This tool is currently disabled")
        return _builtin_payload(tool, db_row)
    db_row = overrides.get(slug)
    if db_row and not db_row.get("is_builtin", False):
        if not db_row.get("is_enabled", True):
            raise HTTPException(status_code=403, detail="This tool is currently disabled")
        return _custom_payload(db_row)
    raise HTTPException(status_code=404, detail="AI tool not found")


def _log_usage(user_id: str, tool_slug: str, provider, status: str, error: Optional[str]):
    try:
        service_supabase.table("ai_usage_logs").insert({
            "user_id": user_id,
            "tool_slug": tool_slug,
            "provider": provider,
            "status": status,
            "error": (error or "")[:1000],
        }).execute()
    except Exception:
        pass


# ---------------------------------------------------------------------------
# User-facing config + run
# ---------------------------------------------------------------------------

@router.get("/config")
async def get_config(user_id: str = Depends(get_user_id)):
    roles = get_user_roles(user_id)
    primary_role = get_user_primary_role(user_id)
    overrides = _catalog_overrides()
    denied = _denied_pairs(roles)

    tools: list[dict] = []
    seen: set[str] = set()

    for tool in TOOLS:
        if "common" in tool.roles:
            if any((r, tool.slug) in denied for r in roles):
                continue
        else:
            matched = [r for r in roles if r in tool.roles]
            if not matched:
                continue
            if any((r, tool.slug) in denied for r in matched):
                continue
        db_row = overrides.get(tool.slug)
        if db_row is not None and not db_row.get("is_enabled", True):
            continue
        seen.add(tool.slug)
        tools.append(_builtin_payload(tool, db_row))

    for slug, db_row in overrides.items():
        if slug in seen or db_row.get("is_builtin", False):
            continue
        if not db_row.get("is_enabled", True):
            continue
        tool_roles = list(db_row.get("roles") or [])
        if "common" in tool_roles:
            if any((r, slug) in denied for r in roles):
                continue
        else:
            matched = [r for r in roles if r in tool_roles]
            if not matched:
                continue
            if any((r, slug) in denied for r in matched):
                continue
        seen.add(slug)
        tools.append(_custom_payload(db_row))

    categories = [c for c in CATEGORY_ORDER if any(t["category"] == c for t in tools)]
    present = {t["category"] for t in tools}
    categories.extend(sorted(present - set(categories)))

    tools.sort(
        key=lambda t: (
            categories.index(t["category"]) if t["category"] in categories else 999,
            t["name"].lower(),
        )
    )

    studios = [
        {"role": r, "label": ROLE_STUDIO_LABELS[r]}
        for r in roles
        if r in ROLE_STUDIO_LABELS
    ]

    return {
        "roles": roles,
        "primary_role": primary_role,
        "studios": studios,
        "tools": tools,
        "categories": categories,
    }


class RunToolRequest(BaseModel):
    inputs: dict = Field(default_factory=dict)


@router.post("/tools/{slug}/run")
async def run_tool(slug: str, payload: RunToolRequest, user_id: str = Depends(get_user_id)):
    tool = _resolve_tool(slug)
    roles = get_user_roles(user_id)

    if "common" not in tool["roles"] and not any(r in roles for r in tool["roles"]):
        raise HTTPException(
            status_code=403,
            detail="You don't have access to this AI tool for your role",
        )

    missing = [
        f["label"]
        for f in tool["fields"]
        if f["required"] and not str(payload.inputs.get(f["key"], "") or "").strip()
    ]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Missing required field: {', '.join(missing)}",
        )

    try:
        prompt = tool["prompt"].format(**payload.inputs)
    except KeyError as exc:
        raise HTTPException(status_code=400, detail=f"Missing input: {exc}") from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Invalid inputs: {exc}") from exc

    started = time.monotonic()
    try:
        output = await asyncio.to_thread(generate_text_sync, user_id, prompt)
    except RuntimeError as exc:
        _log_usage(user_id, slug, None, "error", str(exc))
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        _log_usage(user_id, slug, None, "error", str(exc))
        raise HTTPException(status_code=502, detail=f"AI provider error: {exc}") from exc

    latency_ms = int((time.monotonic() - started) * 1000)
    try:
        resolved = _resolve_user_provider(user_id)
        provider = resolved[0] if resolved else "platform"
    except Exception:
        provider = "platform"
    _log_usage(user_id, slug, provider, "success", None)

    return {
        "tool": slug,
        "title": tool["name"],
        "output": output,
        "provider": provider,
        "latency_ms": latency_ms,
    }


# ---------------------------------------------------------------------------
# Admin: tool management
# ---------------------------------------------------------------------------

class CreateToolRequest(BaseModel):
    slug: str = Field(min_length=2, max_length=60, pattern=r"^[a-z0-9_]+$")
    name: str = Field(min_length=2, max_length=120)
    description: Optional[str] = None
    category: str = "General"
    icon: Optional[str] = "Sparkles"
    roles: list[str] = Field(default_factory=list)
    prompt_template: str = Field(min_length=10, max_length=20000)
    output_format: str = "markdown"
    input_fields: list[dict] = Field(default_factory=list)
    is_enabled: bool = True


class UpdateToolRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    description: Optional[str] = None
    category: Optional[str] = None
    icon: Optional[str] = None
    roles: Optional[list[str]] = None
    prompt_template: Optional[str] = Field(default=None, min_length=10, max_length=20000)
    output_format: Optional[str] = None
    input_fields: Optional[list[dict]] = None
    is_enabled: Optional[bool] = None


def _validate_role_tags(roles: list[str]) -> None:
    invalid = [r for r in roles if r not in ALL_ROLES and r != "common"]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Invalid roles: {', '.join(invalid)}")


@router.get("/admin/tools")
async def admin_list_tools(
    admin_id: str = Depends(require_admin),
    category: Optional[str] = None,
    role: Optional[str] = None,
):
    overrides = _catalog_overrides()
    items: list[dict] = []
    for tool in TOOLS:
        db_row = overrides.get(tool.slug)
        item = _builtin_payload(tool, db_row)
        items.append(item)
    for db_row in overrides.values():
        if db_row.get("is_builtin"):
            continue
        items.append(_custom_payload(db_row))

    if category:
        items = [i for i in items if i["category"].lower() == category.lower()]
    if role:
        items = [i for i in items if role in i["roles"] or "common" in i["roles"]]

    items.sort(key=lambda i: (i["category"], i["name"].lower()))
    return {"tools": items, "total": len(items)}


@router.post("/admin/tools")
async def admin_create_tool(payload: CreateToolRequest, admin_id: str = Depends(require_admin)):
    if payload.slug in TOOL_BY_SLUG:
        raise HTTPException(status_code=400, detail="A built-in tool with that slug already exists")
    _validate_role_tags(payload.roles)
    overrides = _catalog_overrides()
    if payload.slug in overrides:
        raise HTTPException(status_code=409, detail="A tool with that slug already exists")
    row = {
        "slug": payload.slug,
        "name": payload.name,
        "description": payload.description,
        "category": payload.category,
        "icon": payload.icon,
        "roles": payload.roles,
        "is_builtin": False,
        "is_enabled": payload.is_enabled,
        "prompt_template": payload.prompt_template,
        "output_format": payload.output_format,
        "input_fields": payload.input_fields,
        "created_by": admin_id,
    }
    result = service_supabase.table("ai_tools").insert(row).execute()
    return _custom_payload(result.data[0])


@router.patch("/admin/tools/{slug}")
async def admin_update_tool(slug: str, payload: UpdateToolRequest, admin_id: str = Depends(require_admin)):
    overrides = _catalog_overrides()
    updates = {k: v for k, v in payload.dict().items() if v is not None}
    if payload.roles is not None:
        _validate_role_tags(payload.roles)

    if slug in TOOL_BY_SLUG:
        # Seed a row for built-in tools so toggles persist, then apply updates.
        tool = TOOL_BY_SLUG[slug]
        if slug not in overrides:
            service_supabase.table("ai_tools").insert({
                "slug": slug,
                "name": tool.name,
                "description": tool.description,
                "category": tool.category,
                "icon": tool.icon,
                "roles": tool.roles,
                "is_builtin": True,
                "is_enabled": True,
                "prompt_template": tool.prompt,
                "output_format": tool.output_format,
                "input_fields": [
                    {"key": f.key, "label": f.label, "type": f.type, "required": f.required,
                     "placeholder": f.placeholder, "options": f.options}
                    for f in tool.fields
                ],
                "created_by": admin_id,
            }).execute()
    elif slug not in overrides:
        raise HTTPException(status_code=404, detail="AI tool not found")

    if not updates:
        return _tool_payload_admin(slug)

    mapped = {}
    if "name" in updates:
        mapped["name"] = updates["name"]
    if "description" in updates:
        mapped["description"] = updates["description"]
    if "category" in updates:
        mapped["category"] = updates["category"]
    if "icon" in updates:
        mapped["icon"] = updates["icon"]
    if "roles" in updates:
        mapped["roles"] = updates["roles"]
    if "prompt_template" in updates:
        mapped["prompt_template"] = updates["prompt_template"]
    if "output_format" in updates:
        mapped["output_format"] = updates["output_format"]
    if "input_fields" in updates:
        mapped["input_fields"] = updates["input_fields"]
    if "is_enabled" in updates:
        mapped["is_enabled"] = updates["is_enabled"]

    service_supabase.table("ai_tools").update(mapped).eq("slug", slug).execute()
    return _tool_payload_admin(slug)


@router.delete("/admin/tools/{slug}")
async def admin_delete_tool(slug: str, admin_id: str = Depends(require_admin)):
    if slug in TOOL_BY_SLUG:
        raise HTTPException(status_code=400, detail="Built-in tools can't be deleted, only disabled")
    overrides = _catalog_overrides()
    if slug not in overrides:
        raise HTTPException(status_code=404, detail="AI tool not found")
    service_supabase.table("ai_tools").delete().eq("slug", slug).execute()
    return {"success": True}


# ---------------------------------------------------------------------------
# Admin: user roles
# ---------------------------------------------------------------------------

class SetRolesRequest(BaseModel):
    roles: list[str] = Field(default_factory=list)


@router.get("/admin/users")
async def admin_list_users(
    admin_id: str = Depends(require_admin),
    search: Optional[str] = None,
    limit: int = 100,
):
    limit = max(1, min(limit, 500))
    query = (
        service_supabase.table("profiles")
        .select("id, full_name, username, role, is_admin, created_at")
        .order("created_at", desc=True)
        .limit(limit)
    )
    if search:
        query = query.or_(f"full_name.ilike.%{search}%,username.ilike.%{search}%")
    result = query.execute()
    rows = result.data or []
    if not rows:
        return {"users": []}

    ids = [r["id"] for r in rows]
    extra_by_user: dict[str, list[str]] = {}
    try:
        extras = (
            service_supabase.table("user_roles")
            .select("user_id, role")
            .in_("user_id", ids)
            .execute()
        )
        for row in extras.data or []:
            extra_by_user.setdefault(row["user_id"], []).append(row["role"])
    except Exception:
        pass

    users = []
    for row in rows:
        primary = row.get("role") or "founder"
        extra = [r for r in extra_by_user.get(row["id"], []) if r != primary]
        users.append({
            "id": row["id"],
            "full_name": row.get("full_name"),
            "username": row.get("username"),
            "role": primary,
            "extra_roles": extra,
            "is_admin": bool(row.get("is_admin")),
        })
    return {"users": users}


@router.put("/admin/users/{user_id}/roles")
async def admin_set_user_roles(user_id: str, payload: SetRolesRequest, admin_id: str = Depends(require_admin)):
    _validate_role_tags(payload.roles)
    profile = (
        service_supabase.table("profiles")
        .select("id, role")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    if not profile.data:
        raise HTTPException(status_code=404, detail="User not found")
    primary = profile.data.get("role") or "founder"

    extras = list(dict.fromkeys(r for r in payload.roles if r != primary))
    service_supabase.table("user_roles").delete().eq("user_id", user_id).execute()
    for role in extras:
        try:
            service_supabase.table("user_roles").insert(
                {"user_id": user_id, "role": role}
            ).execute()
        except Exception:
            pass

    full = list(dict.fromkeys([primary] + extras))
    return {"user_id": user_id, "roles": full}


# ---------------------------------------------------------------------------
# Admin: usage analytics
# ---------------------------------------------------------------------------

@router.get("/admin/usage")
async def admin_usage(admin_id: str = Depends(require_admin), limit: int = 100):
    limit = max(1, min(limit, 500))
    result = (
        service_supabase.table("ai_usage_logs")
        .select("*")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    rows = result.data or []
    ids = list(dict.fromkeys(r.get("user_id") for r in rows if r.get("user_id")))
    names: dict[str, dict] = {}
    if ids:
        try:
            profiles = (
                service_supabase.table("profiles")
                .select("id, full_name, username, role")
                .in_("id", ids)
                .execute()
            )
            for p in profiles.data or []:
                names[p["id"]] = p
        except Exception:
            pass

    logs = []
    for row in rows:
        user = names.get(row.get("user_id")) or {}
        logs.append({
            "id": row.get("id"),
            "user_id": row.get("user_id"),
            "user_name": user.get("full_name") or user.get("username") or row.get("user_id"),
            "tool_slug": row.get("tool_slug"),
            "provider": row.get("provider"),
            "status": row.get("status"),
            "error": row.get("error"),
            "created_at": row.get("created_at"),
        })
    return {"logs": logs}


@router.get("/admin/analytics")
async def admin_analytics(admin_id: str = Depends(require_admin)):
    result = (
        service_supabase.table("ai_usage_logs")
        .select("*")
        .order("created_at", desc=True)
        .limit(2000)
        .execute()
    )
    rows = result.data or []

    total = len(rows)
    now = time.time()
    last_7d = [r for r in rows if _ts(r.get("created_at")) >= now - 7 * 86400]
    last_24h = [r for r in rows if _ts(r.get("created_at")) >= now - 86400]
    successful = [r for r in rows if r.get("status") == "success"]
    failed = total - len(successful)

    tool_counts: dict[str, int] = {}
    category_counts: dict[str, int] = {}
    overrides = _catalog_overrides()
    for row in rows:
        slug = row.get("tool_slug") or "unknown"
        tool_counts[slug] = tool_counts.get(slug, 0) + 1
        cat = None
        tool = TOOL_BY_SLUG.get(slug)
        if tool:
            cat = tool.category
        elif slug in overrides:
            cat = overrides[slug].get("category") or "General"
        category_counts[cat or "General"] = category_counts.get(cat or "General", 0) + 1

    user_ids = list(dict.fromkeys(r.get("user_id") for r in rows if r.get("user_id")))
    role_counts: dict[str, int] = {}
    active_users = len(user_ids)
    if user_ids:
        try:
            profiles = (
                service_supabase.table("profiles")
                .select("id, role")
                .in_("id", user_ids)
                .execute()
            )
            for p in profiles.data or []:
                role = p.get("role") or "founder"
                role_counts[role] = role_counts.get(role, 0) + 1
        except Exception:
            pass

    top_tools = sorted(
        ({"tool": slug, "runs": count} for slug, count in tool_counts.items()),
        key=lambda x: x["runs"],
        reverse=True,
    )[:10]

    return {
        "total_runs": total,
        "successful_runs": len(successful),
        "failed_runs": failed,
        "last_24h": len(last_24h),
        "last_7d": len(last_7d),
        "active_users": active_users,
        "top_tools": top_tools,
        "runs_by_category": sorted(
            ({"category": c, "runs": n} for c, n in category_counts.items()),
            key=lambda x: x["runs"],
            reverse=True,
        ),
        "runs_by_primary_role": sorted(
            ({"role": r, "users": n} for r, n in role_counts.items()),
            key=lambda x: x["users"],
            reverse=True,
        ),
    }


def _ts(value) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return time.mktime(time.strptime(value[:19], "%Y-%m-%dT%H:%M:%S")) + _tz_offset(value)
        except Exception:
            return 0.0
    return 0.0


def _tz_offset(value: str) -> float:
    if len(value) >= 25 and value[19] in ("+", "-"):
        try:
            sign = 1 if value[19] == "+" else -1
            return sign * (int(value[20:22]) * 3600 + int(value[23:25]) * 60)
        except Exception:
            return 0.0
    return 0.0
