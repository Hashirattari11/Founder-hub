"""User-facing role change requests. Approval is handled by the admin panel."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from pydantic import BaseModel, Field

from app.core.auth import get_user_id
from app.core.rbac import ALL_ROLES, get_user_primary_role
from app.core.supabase import service_supabase, single_row

router = APIRouter(prefix="/api/role-requests", tags=["role-requests"])


class CreateRoleRequest(BaseModel):
    requested_role: str = Field(min_length=1, max_length=40)
    reason: str = Field(default="", max_length=2000)


@router.post("")
async def create_role_request(
    payload: CreateRoleRequest,
    user_id: str = Depends(get_user_id),
):
    if payload.requested_role not in ALL_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")

    from_role = get_user_primary_role(user_id)
    if from_role == payload.requested_role:
        raise HTTPException(status_code=400, detail="You already have that role")

    pending = single_row(
        service_supabase.table("role_requests")
        .select("id")
        .eq("user_id", user_id)
        .eq("status", "pending")
        .maybe_single()
        .execute()
    )
    if pending:
        raise HTTPException(status_code=409, detail="You already have a pending role request")

    result = (
        service_supabase.table("role_requests")
        .insert(
            {
                "user_id": user_id,
                "from_role": from_role,
                "requested_role": payload.requested_role,
                "reason": payload.reason,
                "status": "pending",
            }
        )
        .execute()
    )
    return result.data[0]


@router.get("/me")
async def my_role_requests(user_id: str = Depends(get_user_id)):
    result = (
        service_supabase.table("role_requests")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return {"requests": result.data or []}


@router.delete("/{request_id}")
async def cancel_role_request(request_id: str, user_id: str = Depends(get_user_id)):
    row = single_row(
        service_supabase.table("role_requests")
        .select("id, status")
        .eq("id", request_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Role request not found")
    if row.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Only pending requests can be cancelled")

    service_supabase.table("role_requests").update({"status": "cancelled"}).eq("id", request_id).execute()
    return {"success": True}
