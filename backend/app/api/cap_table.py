"""Equity & Cap Table Management."""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.data_room import _access_valid, _get_access, _get_data_room_by_startup, _get_startup
from app.core.auth import get_user_id
from app.core.supabase import service_supabase

router = APIRouter(prefix="/api/cap-table", tags=["cap-table"])

HOLDER_TYPES = {"founder", "investor", "employee", "advisor", "esop", "other"}
SHARE_CLASSES = {"common", "preferred", "options", "warrants"}
ROUND_TYPES = {"pre_seed", "seed", "series_a", "series_b", "bridge", "angel", "grant"}
ROUND_STATUSES = {"open", "closed", "cancelled"}


class CapTableIn(BaseModel):
    total_shares: Optional[int] = None
    currency: Optional[str] = None


class EntryIn(BaseModel):
    holder_name: str
    holder_type: str = "other"
    holder_user_id: Optional[str] = None
    shares: int
    share_class: str = "common"
    investment_amount: Optional[int] = 0
    investment_date: Optional[str] = None
    vesting_start: Optional[str] = None
    vesting_cliff_months: Optional[int] = 12
    vesting_total_months: Optional[int] = 48
    notes: Optional[str] = None


class EntryUpdate(BaseModel):
    holder_name: Optional[str] = None
    holder_type: Optional[str] = None
    holder_user_id: Optional[str] = None
    shares: Optional[int] = None
    share_class: Optional[str] = None
    investment_amount: Optional[int] = None
    investment_date: Optional[str] = None
    vesting_start: Optional[str] = None
    vesting_cliff_months: Optional[int] = None
    vesting_total_months: Optional[int] = None
    notes: Optional[str] = None


class RoundIn(BaseModel):
    round_name: str
    round_type: str = "seed"
    target_amount: Optional[int] = None
    raised_amount: Optional[int] = 0
    pre_money_valuation: Optional[int] = None
    post_money_valuation: Optional[int] = None
    share_price: Optional[float] = None
    status: str = "open"
    open_date: Optional[str] = None
    close_date: Optional[str] = None


class RoundUpdate(BaseModel):
    round_name: Optional[str] = None
    round_type: Optional[str] = None
    target_amount: Optional[int] = None
    raised_amount: Optional[int] = None
    pre_money_valuation: Optional[int] = None
    post_money_valuation: Optional[int] = None
    share_price: Optional[float] = None
    status: Optional[str] = None
    open_date: Optional[str] = None
    close_date: Optional[str] = None


def _get_cap_table(startup_id: str) -> dict | None:
    try:
        result = (
            service_supabase.table("cap_tables")
            .select("*")
            .eq("startup_id", startup_id)
            .maybe_single()
            .execute()
        )
        return result.data or None
    except Exception:
        return None


def _ensure_founder(user_id: str, startup_id: str) -> None:
    startup = _get_startup(startup_id)
    if not startup:
        raise HTTPException(status_code=404, detail="Startup not found")
    if startup.get("founder_id") != user_id:
        raise HTTPException(status_code=403, detail="Only the startup founder can manage the cap table")


def _ensure_cap_table(startup_id: str, user_id: str) -> dict:
    cap = _get_cap_table(startup_id)
    if not cap:
        result = (
            service_supabase.table("cap_tables")
            .insert({"startup_id": startup_id, "created_by": user_id})
            .execute()
        )
        cap = result.data[0]
    return cap


def _can_view(user_id: str, startup_id: str) -> bool:
    startup = _get_startup(startup_id)
    if not startup:
        return False
    if startup.get("founder_id") == user_id:
        return True
    room = _get_data_room_by_startup(startup_id)
    if not room:
        return False
    access = _get_access(room["id"], user_id)
    return bool(_access_valid(room, access))


@router.get("/{startup_id}")
async def get_cap_table(startup_id: str, user_id: str = Depends(get_user_id)):
    startup = _get_startup(startup_id)
    if not startup:
        raise HTTPException(status_code=404, detail="Startup not found")
    can_manage = startup.get("founder_id") == user_id
    if not can_manage and not _can_view(user_id, startup_id):
        raise HTTPException(status_code=403, detail="You need data room access to view the cap table")

    cap = _get_cap_table(startup_id)
    entries = []
    rounds = []
    if cap:
        entries = (
            service_supabase.table("cap_table_entries")
            .select("*")
            .eq("cap_table_id", cap["id"])
            .order("shares", desc=True)
            .execute()
        ).data or []
    rounds = (
        service_supabase.table("funding_rounds")
        .select("*")
        .eq("startup_id", startup_id)
        .order("created_at", desc=True)
        .execute()
    ).data or []

    return {
        "startup": startup,
        "can_manage": can_manage,
        "cap_table": cap,
        "entries": entries,
        "rounds": rounds,
    }


@router.post("/{startup_id}")
async def upsert_cap_table(startup_id: str, payload: CapTableIn, user_id: str = Depends(get_user_id)):
    _ensure_founder(user_id, startup_id)
    cap = _get_cap_table(startup_id)
    updates = {k: v for k, v in payload.dict().items() if v is not None}
    updates["last_updated"] = datetime.now(timezone.utc).isoformat()
    if cap:
        result = (
            service_supabase.table("cap_tables")
            .update(updates)
            .eq("id", cap["id"])
            .execute()
        )
        return result.data[0]
    result = (
        service_supabase.table("cap_tables")
        .insert({"startup_id": startup_id, "created_by": user_id, **{k: v for k, v in updates.items() if k != "last_updated"}})
        .execute()
    )
    return result.data[0]


@router.post("/{startup_id}/entry")
async def add_entry(startup_id: str, payload: EntryIn, user_id: str = Depends(get_user_id)):
    _ensure_founder(user_id, startup_id)
    if payload.holder_type not in HOLDER_TYPES:
        raise HTTPException(status_code=400, detail="Invalid holder type")
    if payload.share_class not in SHARE_CLASSES:
        raise HTTPException(status_code=400, detail="Invalid share class")
    if payload.shares <= 0:
        raise HTTPException(status_code=400, detail="Shares must be greater than zero")

    cap = _ensure_cap_table(startup_id, user_id)
    data = payload.dict()
    data["cap_table_id"] = cap["id"]
    result = service_supabase.table("cap_table_entries").insert(data).execute()
    service_supabase.table("cap_tables").update({"last_updated": datetime.now(timezone.utc).isoformat()}).eq("id", cap["id"]).execute()
    return result.data[0]


@router.patch("/entry/{entry_id}")
async def update_entry(entry_id: str, payload: EntryUpdate, user_id: str = Depends(get_user_id)):
    try:
        entry = (
            service_supabase.table("cap_table_entries")
            .select("*")
            .eq("id", entry_id)
            .maybe_single()
            .execute()
        ).data
    except Exception:
        entry = None
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    cap = (
        service_supabase.table("cap_tables")
        .select("startup_id, created_by")
        .eq("id", entry["cap_table_id"])
        .maybe_single()
        .execute()
    ).data
    if not cap or cap.get("created_by") != user_id:
        raise HTTPException(status_code=403, detail="Only the founder can edit entries")

    updates = {k: v for k, v in payload.dict().items() if v is not None}
    if payload.holder_type is not None and payload.holder_type not in HOLDER_TYPES:
        raise HTTPException(status_code=400, detail="Invalid holder type")
    if payload.share_class is not None and payload.share_class not in SHARE_CLASSES:
        raise HTTPException(status_code=400, detail="Invalid share class")
    if "shares" in updates and updates["shares"] <= 0:
        raise HTTPException(status_code=400, detail="Shares must be greater than zero")

    if updates:
        service_supabase.table("cap_table_entries").update(updates).eq("id", entry_id).execute()
    service_supabase.table("cap_tables").update({"last_updated": datetime.now(timezone.utc).isoformat()}).eq("id", entry["cap_table_id"]).execute()
    return {"success": True}


@router.delete("/entry/{entry_id}")
async def delete_entry(entry_id: str, user_id: str = Depends(get_user_id)):
    try:
        entry = (
            service_supabase.table("cap_table_entries")
            .select("id, cap_table_id")
            .eq("id", entry_id)
            .maybe_single()
            .execute()
        ).data
    except Exception:
        entry = None
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    cap = (
        service_supabase.table("cap_tables")
        .select("startup_id, created_by")
        .eq("id", entry["cap_table_id"])
        .maybe_single()
        .execute()
    ).data
    if not cap or cap.get("created_by") != user_id:
        raise HTTPException(status_code=403, detail="Only the founder can delete entries")
    service_supabase.table("cap_table_entries").delete().eq("id", entry_id).execute()
    service_supabase.table("cap_tables").update({"last_updated": datetime.now(timezone.utc).isoformat()}).eq("id", entry["cap_table_id"]).execute()
    return {"success": True}


@router.post("/{startup_id}/round")
async def add_round(startup_id: str, payload: RoundIn, user_id: str = Depends(get_user_id)):
    _ensure_founder(user_id, startup_id)
    if payload.round_type not in ROUND_TYPES:
        raise HTTPException(status_code=400, detail="Invalid round type")
    if payload.status not in ROUND_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid round status")

    data = payload.dict()
    data["startup_id"] = startup_id
    if data.get("post_money_valuation") is None and data.get("pre_money_valuation") is not None and data.get("target_amount") is not None:
        data["post_money_valuation"] = data["pre_money_valuation"] + data["target_amount"]
    result = service_supabase.table("funding_rounds").insert(data).execute()
    return result.data[0]


@router.patch("/round/{round_id}")
async def update_round(round_id: str, payload: RoundUpdate, user_id: str = Depends(get_user_id)):
    try:
        round_row = (
            service_supabase.table("funding_rounds")
            .select("*")
            .eq("id", round_id)
            .maybe_single()
            .execute()
        ).data
    except Exception:
        round_row = None
    if not round_row:
        raise HTTPException(status_code=404, detail="Funding round not found")
    _ensure_founder(user_id, round_row["startup_id"])

    updates = {k: v for k, v in payload.dict().items() if v is not None}
    if payload.round_type is not None and payload.round_type not in ROUND_TYPES:
        raise HTTPException(status_code=400, detail="Invalid round type")
    if payload.status is not None and payload.status not in ROUND_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid round status")

    if "post_money_valuation" not in updates and "pre_money_valuation" in updates:
        base = updates.get("pre_money_valuation", round_row.get("pre_money_valuation"))
        target = updates.get("target_amount", round_row.get("target_amount"))
        if base is not None and target is not None:
            updates["post_money_valuation"] = base + target

    if updates:
        service_supabase.table("funding_rounds").update(updates).eq("id", round_id).execute()
    return {"success": True}


@router.delete("/round/{round_id}")
async def delete_round(round_id: str, user_id: str = Depends(get_user_id)):
    try:
        round_row = (
            service_supabase.table("funding_rounds")
            .select("id, startup_id")
            .eq("id", round_id)
            .maybe_single()
            .execute()
        ).data
    except Exception:
        round_row = None
    if not round_row:
        raise HTTPException(status_code=404, detail="Funding round not found")
    _ensure_founder(user_id, round_row["startup_id"])
    service_supabase.table("funding_rounds").delete().eq("id", round_id).execute()
    return {"success": True}

