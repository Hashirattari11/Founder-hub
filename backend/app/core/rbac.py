"""Role-Based Access Control (RBAC) helpers for FounderHub.

Roles are resolved from two sources:
  1. `profiles.role` — the user's primary role (legacy, backward compatible).
  2. `user_roles.role` — any number of additional roles.

A user may therefore belong to several roles; a role-less user falls back to
the default `founder` role so nothing silently breaks.
"""
from typing import Optional

from fastapi import Depends, HTTPException

from app.core.auth import get_user_id
from app.core.supabase import service_supabase

# Canonical role slugs (must match the `roles` table seed).
ALL_ROLES = [
    "founder",
    "developer",
    "designer",
    "marketer",
    "investor",
    "legal_advisor",
    "business_analyst",
    "mentor",
    "recruiter",
    "administrator",
]

DEFAULT_ROLE = "founder"

ADMIN_ROLES = {"administrator", "admin"}


def get_user_roles(user_id: str) -> list[str]:
    """Return the full set of role slugs for a user (primary + extra)."""
    roles: list[str] = []
    try:
        profile = (
            service_supabase.table("profiles")
            .select("role")
            .eq("id", user_id)
            .maybe_single()
            .execute()
        )
        primary = (profile.data or {}).get("role") or DEFAULT_ROLE
        if primary:
            roles.append(primary)
    except Exception:
        roles.append(DEFAULT_ROLE)

    try:
        extra = (
            service_supabase.table("user_roles")
            .select("role")
            .eq("user_id", user_id)
            .execute()
        )
        for row in extra.data or []:
            role = row.get("role")
            if role and role not in roles:
                roles.append(role)
    except Exception:
        pass

    if not roles:
        roles.append(DEFAULT_ROLE)
    return roles


def is_admin_user(user_id: str) -> bool:
    """True when the user is an administrator (role or legacy is_admin flag)."""
    roles = get_user_roles(user_id)
    if any(r in ADMIN_ROLES for r in roles):
        return True
    try:
        profile = (
            service_supabase.table("profiles")
            .select("is_admin")
            .eq("id", user_id)
            .maybe_single()
            .execute()
        )
        return bool(profile.data and profile.data.get("is_admin"))
    except Exception:
        return False


def roles_dependency(user_id: str = Depends(get_user_id)) -> list[str]:
    """FastAPI dependency: the current user's role slugs."""
    return get_user_roles(user_id)


def require_roles(*allowed: str):
    """Return a FastAPI dependency that 403s unless the user holds a role."""

    def _check(roles: list[str] = Depends(roles_dependency)) -> list[str]:
        if not any(r in allowed for r in roles):
            raise HTTPException(status_code=403, detail="You don't have permission to access this")
        return roles

    return _check


def require_admin(user_id: str = Depends(get_user_id)) -> str:
    """Return the user id when they are an administrator, else raise 403."""
    if not is_admin_user(user_id):
        raise HTTPException(status_code=403, detail="Admins only")
    return user_id


def get_user_primary_role(user_id: str) -> Optional[str]:
    """Primary role from profiles.role (for display)."""
    try:
        profile = (
            service_supabase.table("profiles")
            .select("role")
            .eq("id", user_id)
            .maybe_single()
            .execute()
        )
        return (profile.data or {}).get("role") or DEFAULT_ROLE
    except Exception:
        return DEFAULT_ROLE
