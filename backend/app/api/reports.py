"""User-facing moderation reports. Review is handled by the admin panel."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from pydantic import BaseModel, Field

from app.core.auth import get_user_id
from app.core.supabase import service_supabase

router = APIRouter(prefix="/api/reports", tags=["reports"])

REPORT_TYPES = {
    "spam",
    "fake_startup",
    "fake_investor",
    "fake_founder",
    "harassment",
    "scam",
    "other",
}
TARGET_TYPES = {
    "startup",
    "investor",
    "founder",
    "user",
    "post",
    "job",
    "message",
    "profile",
    "other",
}


class CreateReportRequest(BaseModel):
    report_type: str = Field(min_length=1, max_length=40)
    target_type: str = Field(min_length=1, max_length=40)
    target_id: str = Field(default="", max_length=200)
    description: str = Field(default="", max_length=4000)


@router.post("")
async def create_report(
    payload: CreateReportRequest,
    user_id: str = Depends(get_user_id),
):
    if payload.report_type not in REPORT_TYPES:
        raise HTTPException(status_code=400, detail="Invalid report type")
    if payload.target_type not in TARGET_TYPES:
        raise HTTPException(status_code=400, detail="Invalid target type")

    result = (
        service_supabase.table("reports")
        .insert(
            {
                "reporter_id": user_id,
                "report_type": payload.report_type,
                "target_type": payload.target_type,
                "target_id": payload.target_id,
                "description": payload.description,
                "status": "open",
            }
        )
        .execute()
    )
    return result.data[0]


@router.get("/me")
async def my_reports(user_id: str = Depends(get_user_id)):
    result = (
        service_supabase.table("reports")
        .select("*")
        .eq("reporter_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return {"reports": result.data or []}
