"""Security & admin-gating helpers for the FounderHub admin platform.

Admin access is granted when ANY of these hold:
  1. `profiles.is_admin` is true (legacy flag), or
  2. the user holds an `administrator`/`admin` role, or
  3. the authenticated email matches `SUPER_ADMIN_EMAIL` (env).

Rule 3 is the "bootstrap" path: the matching user is auto-promoted
(idempotently) to super admin so no credentials are ever hardcoded.
"""
import hashlib
import hmac
from typing import Optional

from fastapi import Depends, HTTPException, Request

from app.core.auth import get_user_id
from app.core.config import settings
from app.core.rbac import ADMIN_ROLES, get_user_roles
from app.core.supabase import service_supabase, single_row
from app.core.users import user_email


def hash_secret(value: str) -> str:
    """Deterministic, non-reversible hash used to compare secret env values."""
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def secrets_equal(a: Optional[str], b: Optional[str]) -> bool:
    if not a or not b:
        return False
    return hmac.compare_digest(str(a), str(b))


def is_super_admin_email(email: Optional[str]) -> bool:
    if not email or not settings.super_admin_email:
        return False
    return secrets_equal(email.strip().lower(), settings.super_admin_email.strip().lower())


def _get_profile(user_id: str) -> Optional[dict]:
    try:
        return single_row(
            service_supabase.table("profiles")
            .select("*")
            .eq("id", user_id)
            .maybe_single()
            .execute()
        )
    except Exception:
        return None


def promote_profile(user_id: str, email: Optional[str] = None) -> None:
    """Idempotently promote a profile to super admin / administrator."""
    updates = {
        "is_super_admin": True,
        "is_admin": True,
        "is_verified": True,
        "role": "administrator",
    }
    try:
        service_supabase.table("profiles").update(updates).eq("id", user_id).execute()
    except Exception as exc:
        print(f"[security] failed to promote {user_id}: {exc}")


def is_admin_user_full(user_id: str) -> bool:
    """Resolve whether a user has admin access, auto-promoting the env super admin."""
    profile = _get_profile(user_id)
    if not profile:
        return False

    # Env super-admin bootstrap: matching email always (re)promotes so the
    # account keeps the administrator role even after other role changes.
    if settings.super_admin_email:
        email = user_email(user_id)
        if is_super_admin_email(email):
            promote_profile(user_id, email)
            return True

    if profile.get("is_admin") or profile.get("is_super_admin"):
        return True
    return any(r in ADMIN_ROLES for r in get_user_roles(user_id))


def is_super_admin_user(user_id: str) -> bool:
    profile = _get_profile(user_id)
    if profile and profile.get("is_super_admin"):
        return True
    if settings.super_admin_email:
        email = user_email(user_id)
        if is_super_admin_email(email):
            promote_profile(user_id, email)
            return True
    return False


class RequireAdmin:
    """FastAPI dependency factory: `Depends(RequireAdmin())` or `Depends(RequireAdmin(super_admin=True))`."""

    def __init__(self, super_admin: bool = False):
        self.super_admin = super_admin

    def __call__(
        self,
        request: Request,
        user_id: str = Depends(get_user_id),
    ) -> str:
        if self.super_admin:
            if not is_super_admin_user(user_id):
                raise HTTPException(status_code=403, detail="Super admin only")
            return user_id
        if not is_admin_user_full(user_id):
            raise HTTPException(status_code=403, detail="Admins only")
        return user_id


def bootstrap_super_admin() -> None:
    """Provision the env-configured super admin account at startup (if configured)."""
    email = (settings.super_admin_email or "").strip().lower()
    password = settings.super_admin_password or ""
    if not email or not password:
        return
    if not service_supabase.available:
        print("[security] service supabase unavailable; skipping super-admin bootstrap")
        return

    user = None
    try:
        res = service_supabase.auth.admin.list_users()
        users = res.users if hasattr(res, "users") else (res or [])
        for u in users:
            if u.email and u.email.strip().lower() == email:
                user = u
                break
    except Exception as exc:
        print(f"[security] super-admin lookup failed: {exc}")

    if user is None:
        try:
            created = service_supabase.auth.admin.create_user(
                {"email": email, "password": password, "email_confirm": True}
            )
            user = getattr(created, "user", None) or created
            print(f"[security] created super admin account for {email}")
        except Exception as exc:
            print(f"[security] super-admin create failed: {exc}")
            return

    if user is not None:
        promote_profile(user.id, email)
