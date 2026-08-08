"""Centralized role → permission mapping and permission checks.

This is the SINGLE source of truth for what each role may do. Frontend
visibility and backend authorization both read from here so a role change
propagates everywhere automatically.

Permission strings follow a `domain.action` convention, e.g.
``startup.create``. A user holds every permission listed under every role
they have (primary role + extra `user_roles`).
"""
from __future__ import annotations

from typing import Iterable

from fastapi import Depends, HTTPException

from app.core.rbac import get_user_roles

# ---------------------------------------------------------------------------
# Canonical permission catalog (domain.action)
# ---------------------------------------------------------------------------

# Startup lifecycle (founder-only by default)
STARTUP_PERMISSIONS = {
    "startup.create",
    "startup.edit",
    "startup.publish",
    "startup.manage",
    "startup.data_room",
    "startup.funding_requests",
}

# Investment-side
INVESTOR_PERMISSIONS = {
    "investor.discover",
    "investor.preferences",
    "investor.pipeline",
    "investor.saved",
    "investor.data_room_request",
    "investor.meetings",
    "investor.compare",
    "investor.notes",
    "investor.portfolio_tracker",
}

# Talent-side (developers, designers, marketers)
TALENT_PERMISSIONS = {
    "talent.apply",
    "talent.portfolio",
    "talent.resume",
    "talent.invitations",
    "talent.opportunities",
}

# Design work (designers)
DESIGNER_PERMISSIONS = TALENT_PERMISSIONS | {
    "designer.portfolio",
    "designer.opportunities",
    "designer.projects",
    "designer.branding",
    "designer.collaboration",
    "designer.brief_generator",
}

# Growth & marketing (marketers)
MARKETER_PERMISSIONS = TALENT_PERMISSIONS | {
    "marketer.opportunities",
    "marketer.requests",
    "marketer.seo_audit",
    "marketer.competitor_analysis",
    "marketer.content_planner",
    "marketer.campaigns",
    "marketer.growth_strategy",
    "marketer.social_planner",
    "marketer.analytics",
}

# Mentorship
MENTOR_PERMISSIONS = {
    "mentor.profile",
    "mentor.requests",
    "mentor.sessions",
    "mentor.matching",
}

# Recruitment
RECRUITER_PERMISSIONS = {
    "recruiter.candidates",
    "recruiter.jobs",
    "recruiter.pipeline",
    "recruiter.discovery",
}

# Business analysis
ANALYST_PERMISSIONS = {
    "analyst.tools",
    "analyst.startup_analysis",
    "analyst.market_analysis",
    "analyst.financial_analysis",
    "analyst.reports",
}

# Legal
LEGAL_PERMISSIONS = {
    "legal.requests",
    "legal.documents",
    "legal.compliance",
    "legal.sessions",
    "legal.cases",
}

# Shared / platform-wide
COMMON_PERMISSIONS = {
    "startup.discover",
    "jobs.discover",
    "jobs.apply",
    "community.engage",
    "connections.manage",
    "meetings.manage",
    "chat.message",
    "ai.studio",
    "cofounder.match",
}

# Administrator console
ADMIN_PERMISSIONS = {
    "admin.manage",
    "admin.users",
    "admin.startups",
    "admin.meetings",
    "admin.role_requests",
    "admin.reports",
    "admin.analytics",
    "admin.emails",
    "admin.audit_logs",
    "admin.health",
    "admin.notifications",
    "admin.cms",
    "admin.ai",
    "admin.settings",
    "admin.security",
    "admin.subscriptions",
}

# ---------------------------------------------------------------------------
# Role → permissions
# ---------------------------------------------------------------------------

ROLE_PERMISSIONS: dict[str, set[str]] = {
    "founder": COMMON_PERMISSIONS | STARTUP_PERMISSIONS | {"business_plan", "team.manage", "analytics.founder"},
    "investor": COMMON_PERMISSIONS | INVESTOR_PERMISSIONS,
    "developer": COMMON_PERMISSIONS | TALENT_PERMISSIONS,
    "designer": COMMON_PERMISSIONS | DESIGNER_PERMISSIONS,
    "marketer": COMMON_PERMISSIONS | MARKETER_PERMISSIONS,
    "mentor": COMMON_PERMISSIONS | MENTOR_PERMISSIONS,
    "recruiter": COMMON_PERMISSIONS | RECRUITER_PERMISSIONS,
    "business_analyst": COMMON_PERMISSIONS | ANALYST_PERMISSIONS,
    "legal_advisor": COMMON_PERMISSIONS | LEGAL_PERMISSIONS,
    "administrator": (COMMON_PERMISSIONS | STARTUP_PERMISSIONS | INVESTOR_PERMISSIONS
                      | TALENT_PERMISSIONS | MENTOR_PERMISSIONS | RECRUITER_PERMISSIONS
                      | ANALYST_PERMISSIONS | LEGAL_PERMISSIONS | ADMIN_PERMISSIONS
                      | {"business_plan", "team.manage", "analytics.founder"}),
    "admin": (COMMON_PERMISSIONS | ADMIN_PERMISSIONS),
}


def permissions_for_roles(roles: Iterable[str]) -> set[str]:
    """Union of every permission granted by the given role slugs."""
    out: set[str] = set()
    for role in roles:
        out |= ROLE_PERMISSIONS.get(role, set())
    return out


def has_permission(user_id: str, permission: str) -> bool:
    """True when the user holds the permission (any of their roles grant it)."""
    return permission in permissions_for_roles(get_user_roles(user_id))


def user_permissions(user_id: str) -> set[str]:
    """All permissions a user currently holds (from the DB, never the client)."""
    return permissions_for_roles(get_user_roles(user_id))


def require_permission(permission: str):
    """FastAPI dependency: 403 unless the user holds ``permission``.

    The permission is resolved server-side from the database every request,
    so a just-approved role change takes effect immediately.
    """
    from app.core.auth import get_user_id

    def _check(user_id: str = Depends(get_user_id)) -> str:
        if not has_permission(user_id, permission):
            raise HTTPException(
                status_code=403,
                detail=f"You don't have permission to do this (requires '{permission}')",
            )
        return user_id

    return _check
