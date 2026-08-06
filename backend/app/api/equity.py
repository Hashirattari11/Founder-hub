"""Equity & Cap Table Management (extended module).

Richer model on top of Phase 13: dedicated share classes, equity holders,
vesting schedules and investment rounds, plus an ownership summary,
dilution calculator and server-side PDF export.
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from app.api.data_room import _access_valid, _get_access, _get_data_room_by_startup, _get_startup
from app.core.auth import get_user_id
from app.core.security import is_admin_user_full
from app.core.supabase import service_supabase
from app.services.pdf_writer import PAGE_W, PdfWriter

router = APIRouter(prefix="/api/equity", tags=["equity"])

HOLDER_TYPES = {"founder", "investor", "employee", "advisor", "esop", "other"}
CLASS_TYPES = {"common", "preferred", "options", "warrants"}
ROUND_TYPES = {"pre_seed", "seed", "series_a", "series_b", "series_c", "bridge", "angel", "grant", "other"}
ROUND_STATUSES = {"planned", "open", "closed", "cancelled"}
SCHEDULE_TYPES = {"standard", "cliff_only", "accelerated", "custom"}
VESTING_FREQUENCIES = {"monthly", "quarterly", "annually"}

TYPE_LABELS = {
    "founder": "Founder",
    "investor": "Investor",
    "employee": "Employee",
    "advisor": "Advisor",
    "esop": "ESOP",
    "other": "Other",
}

MARGIN = 36.0
CONTENT_W = PAGE_W - 2 * MARGIN


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class CapTableSettings(BaseModel):
    total_shares: Optional[int] = None
    currency: Optional[str] = None
    esop_pool_shares: Optional[int] = None
    default_vesting_cliff_months: Optional[int] = None
    default_vesting_total_months: Optional[int] = None


class ShareClassIn(BaseModel):
    name: str
    class_type: str = "common"
    par_value: Optional[float] = None
    liquidation_preference: Optional[float] = None
    voting_rights: Optional[bool] = None
    conversion_ratio: Optional[float] = None
    notes: Optional[str] = None


class ShareClassUpdate(BaseModel):
    name: Optional[str] = None
    class_type: Optional[str] = None
    par_value: Optional[float] = None
    liquidation_preference: Optional[float] = None
    voting_rights: Optional[bool] = None
    conversion_ratio: Optional[float] = None
    notes: Optional[str] = None


class VestingIn(BaseModel):
    schedule_type: str = "standard"
    start_date: Optional[str] = None
    cliff_months: Optional[int] = None
    total_months: Optional[int] = None
    vesting_frequency: str = "monthly"
    exercise_price: Optional[float] = None
    acceleration_on_sale: Optional[bool] = None
    notes: Optional[str] = None


class VestingUpdate(BaseModel):
    schedule_type: Optional[str] = None
    start_date: Optional[str] = None
    cliff_months: Optional[int] = None
    total_months: Optional[int] = None
    vesting_frequency: Optional[str] = None
    exercise_price: Optional[float] = None
    acceleration_on_sale: Optional[bool] = None
    notes: Optional[str] = None


class HolderIn(BaseModel):
    name: str
    email: Optional[str] = None
    title: Optional[str] = None
    holder_type: str = "other"
    share_class_id: Optional[str] = None
    user_id: Optional[str] = None
    shares: int
    equity_percent: Optional[float] = None
    investment_amount: Optional[int] = 0
    investment_date: Optional[str] = None
    notes: Optional[str] = None
    vesting: Optional[VestingIn] = None


class HolderUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    title: Optional[str] = None
    holder_type: Optional[str] = None
    share_class_id: Optional[str] = None
    user_id: Optional[str] = None
    shares: Optional[int] = None
    equity_percent: Optional[float] = None
    investment_amount: Optional[int] = None
    investment_date: Optional[str] = None
    notes: Optional[str] = None


class RoundIn(BaseModel):
    round_name: str
    round_type: str = "seed"
    target_amount: Optional[int] = None
    raised_amount: Optional[int] = 0
    pre_money_valuation: Optional[int] = None
    post_money_valuation: Optional[int] = None
    new_shares_issued: Optional[int] = None
    share_price: Optional[float] = None
    status: str = "planned"
    open_date: Optional[str] = None
    close_date: Optional[str] = None


class RoundUpdate(BaseModel):
    round_name: Optional[str] = None
    round_type: Optional[str] = None
    target_amount: Optional[int] = None
    raised_amount: Optional[int] = None
    pre_money_valuation: Optional[int] = None
    post_money_valuation: Optional[int] = None
    new_shares_issued: Optional[int] = None
    share_price: Optional[float] = None
    status: Optional[str] = None
    open_date: Optional[str] = None
    close_date: Optional[str] = None


class DilutionIn(BaseModel):
    raise_amount: int
    pre_money_valuation: Optional[int] = None
    post_money_valuation: Optional[int] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


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


def _ensure_cap_table(startup_id: str, user_id: str) -> dict:
    cap = _get_cap_table(startup_id)
    if not cap:
        result = (
            service_supabase.table("cap_tables")
            .insert({"startup_id": startup_id, "created_by": user_id})
            .execute()
        )
        cap = result.data[0]
        try:
            service_supabase.table("share_classes").insert(
                {"cap_table_id": cap["id"], "name": "Common Stock", "class_type": "common"}
            ).execute()
        except Exception:
            pass
    return cap


def _touch(cap_id: str) -> None:
    try:
        service_supabase.table("cap_tables").update(
            {"last_updated": datetime.now(timezone.utc).isoformat()}
        ).eq("id", cap_id).execute()
    except Exception:
        pass


def _cap_of_holder(holder_id: str) -> dict | None:
    try:
        result = (
            service_supabase.table("equity_holders")
            .select("id, cap_table_id, shares")
            .eq("id", holder_id)
            .maybe_single()
            .execute()
        )
        return result.data or None
    except Exception:
        return None


def _cap_of_share_class(class_id: str) -> dict | None:
    try:
        result = (
            service_supabase.table("share_classes")
            .select("id, cap_table_id, class_type")
            .eq("id", class_id)
            .maybe_single()
            .execute()
        )
        return result.data or None
    except Exception:
        return None


def _cap_of_vesting(vesting_id: str) -> dict | None:
    try:
        result = (
            service_supabase.table("vesting_schedules")
            .select("id, holder_id")
            .eq("id", vesting_id)
            .maybe_single()
            .execute()
        )
        if not result.data:
            return None
        return _cap_of_holder(result.data["holder_id"])
    except Exception:
        return None


def _cap_of_round(round_id: str) -> dict | None:
    try:
        result = (
            service_supabase.table("investment_rounds")
            .select("id, cap_table_id, status")
            .eq("id", round_id)
            .maybe_single()
            .execute()
        )
        return result.data or None
    except Exception:
        return None


def _is_admin(user_id: str) -> bool:
    """Admin check consistent with the rest of the platform: accepts is_admin,
    the administrator role, and the env-configured super admin."""
    try:
        return is_admin_user_full(user_id)
    except Exception:
        return False


def _fetch_share_classes(cap_id: str) -> list[dict]:
    result = (
        service_supabase.table("share_classes")
        .select("*")
        .eq("cap_table_id", cap_id)
        .order("created_at")
        .execute()
    )
    return result.data or []


def _fetch_holders(cap_id: str) -> list[dict]:
    result = (
        service_supabase.table("equity_holders")
        .select("*")
        .eq("cap_table_id", cap_id)
        .order("shares", desc=True)
        .execute()
    )
    holders = result.data or []
    if not holders:
        return []
    holder_ids = [h["id"] for h in holders]
    vesting_rows = (
        service_supabase.table("vesting_schedules")
        .select("*")
        .in_("holder_id", holder_ids)
        .execute()
    ).data or []
    by_holder: dict[str, list[dict]] = {}
    for v in vesting_rows:
        by_holder.setdefault(v["holder_id"], []).append(v)
    for h in holders:
        h["vesting_schedules"] = by_holder.get(h["id"], [])
    return holders


def _fetch_rounds(cap_id: str) -> list[dict]:
    result = (
        service_supabase.table("investment_rounds")
        .select("*")
        .eq("cap_table_id", cap_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []


def _vested_shares(holder: dict) -> int | None:
    scheds = holder.get("vesting_schedules") or []
    if not scheds:
        return None
    shares = holder.get("shares") or 0
    best: int | None = None
    today = datetime.now(timezone.utc).date()
    for s in scheds:
        start = s.get("start_date")
        total = s.get("total_months")
        if not start or not total:
            continue
        try:
            start_d = datetime.fromisoformat(str(start).replace("Z", "+00:00")).date()
        except Exception:
            continue
        elapsed_days = (today - start_d).days
        if elapsed_days < 0:
            vested = 0
        else:
            elapsed_months = elapsed_days / 30.44
            cliff = s.get("cliff_months") or 0
            if elapsed_months < cliff:
                vested = 0
            else:
                months = min(elapsed_months, total)
                vested = shares * months / total
        if best is None or vested > best:
            best = int(vested)
    return best


def _decorate_holders(holders: list[dict], classes_by_id: dict, total: int) -> list[dict]:
    for h in holders:
        shares = int(h.get("shares") or 0)
        h["ownership_pct"] = round(shares / total * 100, 3) if total else 0.0
        h["vested_shares"] = _vested_shares(h)
        vested = h["vested_shares"]
        h["vested_pct"] = round(vested / shares * 100, 2) if vested is not None and shares else 0.0
        cls = classes_by_id.get(h.get("share_class_id"))
        h["share_class_name"] = cls.get("name") if cls else None
        h["share_class_type"] = cls.get("class_type") if cls else None
    return holders


def _summarize(cap: dict, holders: list[dict], rounds: list[dict], classes: list[dict]) -> dict:
    total = int(cap.get("total_shares") or 0)
    allocated = sum(int(h.get("shares") or 0) for h in holders)
    unallocated = max(0, total - allocated)

    def pct(shares: int) -> float:
        return round(shares / total * 100, 2) if total else 0.0

    by_type = {t: 0 for t in HOLDER_TYPES}
    by_class_id: dict[str, int] = {}
    for h in holders:
        by_type[h.get("holder_type") or "other"] += int(h.get("shares") or 0)
        cid = h.get("share_class_id")
        if cid:
            by_class_id[cid] = by_class_id.get(cid, 0) + int(h.get("shares") or 0)

    by_class = {}
    for cls in classes:
        shares = by_class_id.get(cls["id"], 0)
        by_class[cls["id"]] = {"name": cls.get("name"), "class_type": cls.get("class_type"), "shares": shares, "pct": pct(shares)}

    latest = rounds[0] if rounds else None
    return {
        "total_shares": total,
        "allocated_shares": allocated,
        "unallocated_shares": unallocated,
        "allocated_pct": pct(allocated),
        "unallocated_pct": pct(unallocated),
        "by_holder_type": {t: {"shares": s, "pct": pct(s)} for t, s in by_type.items()},
        "founder_pct": pct(by_type["founder"]),
        "investor_pct": pct(by_type["investor"]),
        "employee_pct": pct(by_type["employee"]),
        "advisor_pct": pct(by_type["advisor"]),
        "esop_pct": pct(by_type["esop"]),
        "other_pct": pct(by_type["other"]),
        "by_share_class": by_class,
        "esop_pool_shares": int(cap.get("esop_pool_shares") or 0),
        "valuation": latest.get("post_money_valuation") if latest else None,
    }


def _money(n) -> str:
    if n is None:
        return "—"
    try:
        v = int(n)
    except (TypeError, ValueError):
        return str(n)
    return f"${v:,}"


# ---------------------------------------------------------------------------
# Dashboard / reads
# ---------------------------------------------------------------------------


@router.get("/my")
async def my_cap_tables(user_id: str = Depends(get_user_id)):
    startups = (
        service_supabase.table("startups")
        .select("id, name, tagline, industry")
        .eq("founder_id", user_id)
        .order("created_at", desc=True)
        .execute()
    ).data or []

    items = []
    for s in startups:
        cap = _get_cap_table(s["id"])
        if not cap:
            items.append({"startup": s, "cap_table": None, "holders": 0, "allocated_shares": 0, "total_shares": 0, "allocated_pct": 0, "valuation": None, "esop_pool_shares": 0})
            continue
        holders = _fetch_holders(cap["id"])
        rounds = _fetch_rounds(cap["id"])
        total = int(cap.get("total_shares") or 0)
        allocated = sum(int(h.get("shares") or 0) for h in holders)
        latest = rounds[0] if rounds else None
        items.append({
            "startup": s,
            "cap_table": cap,
            "holders": len(holders),
            "allocated_shares": allocated,
            "total_shares": total,
            "allocated_pct": round(allocated / total * 100, 2) if total else 0,
            "valuation": latest.get("post_money_valuation") if latest else None,
            "esop_pool_shares": int(cap.get("esop_pool_shares") or 0),
        })
    return {"startups": items}


@router.get("/admin/overview")
async def admin_overview(user_id: str = Depends(get_user_id)):
    if not _is_admin(user_id):
        raise HTTPException(status_code=403, detail="Admins only")

    cap_tables = (
        service_supabase.table("cap_tables")
        .select("*, startup:startups!inner(id, name, tagline)")
        .order("created_at", desc=True)
        .execute()
    ).data or []

    items = []
    for cap in cap_tables:
        holders = _fetch_holders(cap["id"])
        rounds = _fetch_rounds(cap["id"])
        total = int(cap.get("total_shares") or 0)
        allocated = sum(int(h.get("shares") or 0) for h in holders)
        latest = rounds[0] if rounds else None
        items.append({
            "cap_table": {k: v for k, v in cap.items() if k != "startup"},
            "startup": cap.get("startup"),
            "holders": len(holders),
            "allocated_shares": allocated,
            "total_shares": total,
            "allocated_pct": round(allocated / total * 100, 2) if total else 0,
            "valuation": latest.get("post_money_valuation") if latest else None,
            "last_updated": cap.get("last_updated"),
        })
    return {"cap_tables": items, "total": len(items)}


@router.get("/{startup_id}")
async def get_equity_dashboard(startup_id: str, user_id: str = Depends(get_user_id)):
    startup = _get_startup(startup_id)
    if not startup:
        raise HTTPException(status_code=404, detail="Startup not found")
    can_manage = startup.get("founder_id") == user_id
    if not can_manage and not _can_view(user_id, startup_id):
        raise HTTPException(status_code=403, detail="You need data room access to view the cap table")

    cap = _get_cap_table(startup_id)
    classes, holders, rounds = [], [], []
    if cap:
        classes = _fetch_share_classes(cap["id"])
        holders = _fetch_holders(cap["id"])
        rounds = _fetch_rounds(cap["id"])

    total = int((cap or {}).get("total_shares") or 0)
    classes_by_id = {c["id"]: c for c in classes}
    holders = _decorate_holders(holders, classes_by_id, total)
    summary = _summarize(cap or {}, holders, rounds, classes) if cap else {
        "total_shares": 0, "allocated_shares": 0, "unallocated_shares": 0,
        "allocated_pct": 0, "unallocated_pct": 0,
        "by_holder_type": {t: {"shares": 0, "pct": 0} for t in HOLDER_TYPES},
        "founder_pct": 0, "investor_pct": 0, "employee_pct": 0,
        "advisor_pct": 0, "esop_pct": 0, "other_pct": 0,
        "by_share_class": {}, "esop_pool_shares": 0, "valuation": None,
    }

    return {
        "startup": startup,
        "can_manage": can_manage,
        "cap_table": cap,
        "share_classes": classes,
        "holders": holders,
        "rounds": rounds,
        "summary": summary,
    }


# ---------------------------------------------------------------------------
# Cap table settings
# ---------------------------------------------------------------------------


@router.post("/{startup_id}/cap-table")
async def upsert_cap_table(startup_id: str, payload: CapTableSettings, user_id: str = Depends(get_user_id)):
    _ensure_founder(user_id, startup_id)
    if payload.total_shares is not None and payload.total_shares <= 0:
        raise HTTPException(status_code=400, detail="Total shares must be greater than zero")
    updates = {k: v for k, v in payload.dict().items() if v is not None}
    cap = _get_cap_table(startup_id)
    updates["last_updated"] = datetime.now(timezone.utc).isoformat()
    if cap:
        result = service_supabase.table("cap_tables").update(updates).eq("id", cap["id"]).execute()
        return result.data[0]
    result = service_supabase.table("cap_tables").insert(
        {"startup_id": startup_id, "created_by": user_id, **{k: v for k, v in updates.items() if k != "last_updated"}}
    ).execute()
    return result.data[0]


# ---------------------------------------------------------------------------
# Share classes
# ---------------------------------------------------------------------------


def _get_cap_table_by_cap_id(cap_id: str) -> dict | None:
    try:
        result = (
            service_supabase.table("cap_tables")
            .select("id, startup_id")
            .eq("id", cap_id)
            .maybe_single()
            .execute()
        )
        return result.data or None
    except Exception:
        return None


@router.post("/{startup_id}/share-class")
async def add_share_class(startup_id: str, payload: ShareClassIn, user_id: str = Depends(get_user_id)):
    _ensure_founder(user_id, startup_id)
    if payload.class_type not in CLASS_TYPES:
        raise HTTPException(status_code=400, detail="Invalid share class type")
    cap = _ensure_cap_table(startup_id, user_id)
    data = payload.dict()
    data["cap_table_id"] = cap["id"]
    result = service_supabase.table("share_classes").insert(data).execute()
    _touch(cap["id"])
    return result.data[0]


@router.patch("/share-class/{class_id}")
async def update_share_class(class_id: str, payload: ShareClassUpdate, user_id: str = Depends(get_user_id)):
    cls = _cap_of_share_class(class_id)
    if not cls:
        raise HTTPException(status_code=404, detail="Share class not found")
    cap = _get_cap_table_by_cap_id(cls["cap_table_id"])
    startup_id = cap["startup_id"]
    _ensure_founder(user_id, startup_id)
    if payload.class_type is not None and payload.class_type not in CLASS_TYPES:
        raise HTTPException(status_code=400, detail="Invalid share class type")
    updates = {k: v for k, v in payload.dict().items() if v is not None}
    if updates:
        service_supabase.table("share_classes").update(updates).eq("id", class_id).execute()
    _touch(cls["cap_table_id"])
    return {"success": True}


@router.delete("/share-class/{class_id}")
async def delete_share_class(class_id: str, user_id: str = Depends(get_user_id)):
    cls = _cap_of_share_class(class_id)
    if not cls:
        raise HTTPException(status_code=404, detail="Share class not found")
    cap = _get_cap_table_by_cap_id(cls["cap_table_id"])
    _ensure_founder(user_id, cap["startup_id"])
    used = (
        service_supabase.table("equity_holders")
        .select("id")
        .eq("share_class_id", class_id)
        .limit(1)
        .execute()
    )
    if used.data:
        raise HTTPException(status_code=409, detail="Share class is assigned to equity holders")
    service_supabase.table("share_classes").delete().eq("id", class_id).execute()
    _touch(cls["cap_table_id"])
    return {"success": True}


# ---------------------------------------------------------------------------
# Equity holders
# ---------------------------------------------------------------------------


@router.post("/{startup_id}/holder")
async def add_holder(startup_id: str, payload: HolderIn, user_id: str = Depends(get_user_id)):
    _ensure_founder(user_id, startup_id)
    if payload.holder_type not in HOLDER_TYPES:
        raise HTTPException(status_code=400, detail="Invalid holder type")
    if payload.shares <= 0:
        raise HTTPException(status_code=400, detail="Shares must be greater than zero")
    cap = _ensure_cap_table(startup_id, user_id)

    if payload.share_class_id:
        cls = _cap_of_share_class(payload.share_class_id)
        if not cls or cls["cap_table_id"] != cap["id"]:
            raise HTTPException(status_code=400, detail="Share class does not belong to this cap table")

    data = {k: v for k, v in payload.dict(exclude={"vesting"}).items() if v is not None}
    data["cap_table_id"] = cap["id"]
    result = service_supabase.table("equity_holders").insert(data).execute()
    holder = result.data[0]

    if payload.vesting is not None:
        v = payload.vesting.dict()
        v["holder_id"] = holder["id"]
        service_supabase.table("vesting_schedules").insert(v).execute()

    _touch(cap["id"])
    return holder


@router.patch("/holder/{holder_id}")
async def update_holder(holder_id: str, payload: HolderUpdate, user_id: str = Depends(get_user_id)):
    holder = _cap_of_holder(holder_id)
    if not holder:
        raise HTTPException(status_code=404, detail="Equity holder not found")
    cap = _get_cap_table_by_cap_id(holder["cap_table_id"])
    _ensure_founder(user_id, cap["startup_id"])
    if payload.holder_type is not None and payload.holder_type not in HOLDER_TYPES:
        raise HTTPException(status_code=400, detail="Invalid holder type")
    if payload.shares is not None and payload.shares <= 0:
        raise HTTPException(status_code=400, detail="Shares must be greater than zero")
    if payload.share_class_id:
        cls = _cap_of_share_class(payload.share_class_id)
        if not cls or cls["cap_table_id"] != holder["cap_table_id"]:
            raise HTTPException(status_code=400, detail="Share class does not belong to this cap table")
    updates = {k: v for k, v in payload.dict().items() if v is not None}
    if updates:
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        service_supabase.table("equity_holders").update(updates).eq("id", holder_id).execute()
    _touch(holder["cap_table_id"])
    return {"success": True}


@router.delete("/holder/{holder_id}")
async def delete_holder(holder_id: str, user_id: str = Depends(get_user_id)):
    holder = _cap_of_holder(holder_id)
    if not holder:
        raise HTTPException(status_code=404, detail="Equity holder not found")
    cap = _get_cap_table_by_cap_id(holder["cap_table_id"])
    _ensure_founder(user_id, cap["startup_id"])
    service_supabase.table("equity_holders").delete().eq("id", holder_id).execute()
    _touch(holder["cap_table_id"])
    return {"success": True}


# ---------------------------------------------------------------------------
# Vesting schedules
# ---------------------------------------------------------------------------


@router.post("/holder/{holder_id}/vesting")
async def add_vesting(holder_id: str, payload: VestingIn, user_id: str = Depends(get_user_id)):
    holder = _cap_of_holder(holder_id)
    if not holder:
        raise HTTPException(status_code=404, detail="Equity holder not found")
    cap = _get_cap_table_by_cap_id(holder["cap_table_id"])
    _ensure_founder(user_id, cap["startup_id"])
    if payload.schedule_type not in SCHEDULE_TYPES:
        raise HTTPException(status_code=400, detail="Invalid schedule type")
    if payload.vesting_frequency not in VESTING_FREQUENCIES:
        raise HTTPException(status_code=400, detail="Invalid vesting frequency")
    data = payload.dict()
    data["holder_id"] = holder_id
    result = service_supabase.table("vesting_schedules").insert(data).execute()
    _touch(holder["cap_table_id"])
    return result.data[0]


@router.patch("/vesting/{vesting_id}")
async def update_vesting(vesting_id: str, payload: VestingUpdate, user_id: str = Depends(get_user_id)):
    vesting = _cap_of_vesting(vesting_id)
    if not vesting:
        raise HTTPException(status_code=404, detail="Vesting schedule not found")
    cap = _get_cap_table_by_cap_id(vesting["cap_table_id"])
    _ensure_founder(user_id, cap["startup_id"])
    if payload.schedule_type is not None and payload.schedule_type not in SCHEDULE_TYPES:
        raise HTTPException(status_code=400, detail="Invalid schedule type")
    if payload.vesting_frequency is not None and payload.vesting_frequency not in VESTING_FREQUENCIES:
        raise HTTPException(status_code=400, detail="Invalid vesting frequency")
    updates = {k: v for k, v in payload.dict().items() if v is not None}
    if updates:
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        service_supabase.table("vesting_schedules").update(updates).eq("id", vesting_id).execute()
    _touch(vesting["cap_table_id"])
    return {"success": True}


@router.delete("/vesting/{vesting_id}")
async def delete_vesting(vesting_id: str, user_id: str = Depends(get_user_id)):
    vesting = _cap_of_vesting(vesting_id)
    if not vesting:
        raise HTTPException(status_code=404, detail="Vesting schedule not found")
    cap = _get_cap_table_by_cap_id(vesting["cap_table_id"])
    _ensure_founder(user_id, cap["startup_id"])
    service_supabase.table("vesting_schedules").delete().eq("id", vesting_id).execute()
    _touch(vesting["cap_table_id"])
    return {"success": True}


# ---------------------------------------------------------------------------
# Investment rounds
# ---------------------------------------------------------------------------


@router.post("/{startup_id}/round")
async def add_round(startup_id: str, payload: RoundIn, user_id: str = Depends(get_user_id)):
    _ensure_founder(user_id, startup_id)
    if payload.round_type not in ROUND_TYPES:
        raise HTTPException(status_code=400, detail="Invalid round type")
    if payload.status not in ROUND_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid round status")
    cap = _ensure_cap_table(startup_id, user_id)
    data = payload.dict()
    data["cap_table_id"] = cap["id"]
    if data.get("post_money_valuation") is None and data.get("pre_money_valuation") is not None and data.get("target_amount") is not None:
        data["post_money_valuation"] = data["pre_money_valuation"] + data["target_amount"]
    result = service_supabase.table("investment_rounds").insert(data).execute()
    _touch(cap["id"])
    return result.data[0]


@router.patch("/round/{round_id}")
async def update_round(round_id: str, payload: RoundUpdate, user_id: str = Depends(get_user_id)):
    round_row = _cap_of_round(round_id)
    if not round_row:
        raise HTTPException(status_code=404, detail="Investment round not found")
    cap = _get_cap_table_by_cap_id(round_row["cap_table_id"])
    _ensure_founder(user_id, cap["startup_id"])
    if payload.round_type is not None and payload.round_type not in ROUND_TYPES:
        raise HTTPException(status_code=400, detail="Invalid round type")
    if payload.status is not None and payload.status not in ROUND_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid round status")
    updates = {k: v for k, v in payload.dict().items() if v is not None}
    if "post_money_valuation" not in updates and "pre_money_valuation" in updates:
        base = updates.get("pre_money_valuation", round_row.get("pre_money_valuation"))
        target = updates.get("target_amount", round_row.get("target_amount"))
        if base is not None and target is not None:
            updates["post_money_valuation"] = base + target
    if updates:
        service_supabase.table("investment_rounds").update(updates).eq("id", round_id).execute()
    _touch(round_row["cap_table_id"])
    return {"success": True}


@router.delete("/round/{round_id}")
async def delete_round(round_id: str, user_id: str = Depends(get_user_id)):
    round_row = _cap_of_round(round_id)
    if not round_row:
        raise HTTPException(status_code=404, detail="Investment round not found")
    cap = _get_cap_table_by_cap_id(round_row["cap_table_id"])
    _ensure_founder(user_id, cap["startup_id"])
    service_supabase.table("investment_rounds").delete().eq("id", round_id).execute()
    _touch(round_row["cap_table_id"])
    return {"success": True}


# ---------------------------------------------------------------------------
# Dilution calculator
# ---------------------------------------------------------------------------


@router.post("/{startup_id}/dilution")
async def dilution_calculator(startup_id: str, payload: DilutionIn, user_id: str = Depends(get_user_id)):
    startup = _get_startup(startup_id)
    if not startup:
        raise HTTPException(status_code=404, detail="Startup not found")
    can_manage = startup.get("founder_id") == user_id
    if not can_manage and not _can_view(user_id, startup_id):
        raise HTTPException(status_code=403, detail="You need data room access to view the cap table")
    if payload.raise_amount <= 0:
        raise HTTPException(status_code=400, detail="Raise amount must be greater than zero")

    cap = _get_cap_table(startup_id)
    total = int((cap or {}).get("total_shares") or 0)
    if not cap or total <= 0:
        raise HTTPException(status_code=400, detail="Set total shares before running the dilution calculator")
    holders = _fetch_holders(cap["id"])

    pre = payload.pre_money_valuation
    post = payload.post_money_valuation
    if pre is None:
        if post is None:
            raise HTTPException(status_code=400, detail="Provide a pre-money or post-money valuation")
        pre = post - payload.raise_amount
    if pre <= 0:
        raise HTTPException(status_code=400, detail="Valuation must be greater than the raise amount")
    if post is None:
        post = pre + payload.raise_amount

    new_shares = int(round(payload.raise_amount / pre * total))
    new_total = total + new_shares
    investor_pct = round(new_shares / new_total * 100, 2)

    rows = []
    for h in holders:
        shares = int(h.get("shares") or 0)
        before = shares / total * 100
        after = shares / new_total * 100
        rows.append({
            "id": h["id"],
            "name": h.get("name"),
            "holder_type": h.get("holder_type"),
            "shares": shares,
            "before_pct": round(before, 2),
            "after_pct": round(after, 2),
            "dilution_pp": round(before - after, 2),
        })

    return {
        "raise_amount": payload.raise_amount,
        "pre_money_valuation": pre,
        "post_money_valuation": post,
        "new_shares": new_shares,
        "new_total": new_total,
        "investor_pct": investor_pct,
        "holders": rows,
    }


# ---------------------------------------------------------------------------
# PDF export
# ---------------------------------------------------------------------------


@router.get("/{startup_id}/pdf")
async def equity_pdf(startup_id: str, user_id: str = Depends(get_user_id)):
    startup = _get_startup(startup_id)
    if not startup:
        raise HTTPException(status_code=404, detail="Startup not found")
    can_manage = startup.get("founder_id") == user_id
    if not can_manage and not _can_view(user_id, startup_id):
        raise HTTPException(status_code=403, detail="You need data room access to view the cap table")

    cap = _get_cap_table(startup_id)
    if not cap:
        raise HTTPException(status_code=404, detail="No cap table exists yet")

    classes = _fetch_share_classes(cap["id"])
    holders = _fetch_holders(cap["id"])
    rounds = _fetch_rounds(cap["id"])
    total = int(cap.get("total_shares") or 0)
    classes_by_id = {c["id"]: c for c in classes}
    holders = _decorate_holders(holders, classes_by_id, total)
    summary = _summarize(cap, holders, rounds, classes)

    pdf = _render_pdf(startup, cap, holders, rounds, summary)
    filename = f"{startup.get('name') or 'startup'}_cap_table.pdf".lower().replace(" ", "_").replace("/", "_")
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )


def _render_pdf(startup: dict, cap: dict, holders: list[dict], rounds: list[dict], summary: dict) -> bytes:
    w = PdfWriter()
    page_no = 1

    def footer():
        w.line(MARGIN, 812, PAGE_W - MARGIN, 812)
        w.set_font("Helvetica", 8)
        w.set_text_color(0.45, 0.45, 0.45)
        w.text(MARGIN, 819, f"FounderHub — {startup.get('name') or 'Cap Table'}")
        w.text(PAGE_W - MARGIN - 40, 819, f"Page {page_no}")

    footer()

    w.set_font("Helvetica-Bold", 17)
    w.set_text_color(0.1, 0.1, 0.1)
    w.text(MARGIN, 42, f"{startup.get('name') or 'Startup'} — Cap Table")

    w.set_font("Helvetica", 9)
    w.set_text_color(0.4, 0.4, 0.4)
    generated = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    w.text(MARGIN, 52, f"Generated {generated}  ·  Currency {cap.get('currency') or 'USD'}")

    # Summary stat boxes (2 rows x 4)
    boxes = [
        ("Total shares", f"{summary['total_shares']:,}"),
        ("Allocated", f"{summary['allocated_pct']:.1f}%"),
        ("Unallocated", f"{summary['unallocated_pct']:.1f}%"),
        ("Valuation", _money(summary.get("valuation"))),
        ("Founders", f"{summary['founder_pct']:.1f}%"),
        ("Investors", f"{summary['investor_pct']:.1f}%"),
        ("Employees", f"{summary['employee_pct']:.1f}%"),
        ("ESOP pool", f"{summary['esop_pct']:.1f}%"),
    ]
    box_w, box_h, gap = 123.0, 40.0, 8.0
    y = 72
    for idx, (label, value) in enumerate(boxes):
        col = idx % 4
        row = idx // 4
        bx = MARGIN + col * (box_w + gap)
        by = y + row * (box_h + gap)
        w.set_fill_color(0.97, 0.97, 0.98)
        w.rect(bx, by, box_w, box_h)
        w.set_font("Helvetica", 8)
        w.set_text_color(0.45, 0.45, 0.45)
        w.text(bx + 8, by + 8, label.upper())
        w.set_font("Helvetica-Bold", 13)
        w.set_text_color(0.1, 0.1, 0.1)
        w.text(bx + 8, by + 20, value)

    # Share classes summary
    y = y + 2 * (box_h + gap) + 6
    w.set_font("Helvetica-Bold", 10)
    w.set_text_color(0.1, 0.1, 0.1)
    w.text(MARGIN, y, "Share classes")
    y += 12
    w.set_font("Helvetica", 9)
    w.set_text_color(0.3, 0.3, 0.3)
    for cid, c in summary["by_share_class"].items():
        w.text(MARGIN, y, f"{c['name']} ({c['class_type']}) — {c['shares']:,} shares ({c['pct']:.2f}%)")
        y += 12
        if y > 780:
            w.new_page()
            page_no += 1
            footer()
            y = 60

    # Holders table
    y += 8
    w.set_font("Helvetica-Bold", 10)
    w.set_text_color(0.1, 0.1, 0.1)
    w.text(MARGIN, y, "Equity holders")
    y += 8

    headers = ["Name", "Type", "Class", "Shares", "Own %", "Investment", "Vesting"]
    col_w = [120, 60, 70, 60, 48, 78, 87]
    assert abs(sum(col_w) - CONTENT_W) < 1

    def table_header(yy: float) -> float:
        w.set_fill_color(0.9, 0.9, 0.94)
        w.rect(MARGIN, yy, CONTENT_W, 16)
        w.set_font("Helvetica-Bold", 8.5)
        w.set_text_color(0.2, 0.2, 0.25)
        x = MARGIN
        for i, h in enumerate(headers):
            w.text(x + 5, yy + 5, h)
            x += col_w[i]
        return yy + 16

    y = table_header(y + 6)
    row_h = 16
    for h in holders:
        if y > 790:
            w.new_page()
            page_no += 1
            footer()
            y = table_header(60)
        scheds = h.get("vesting_schedules") or []
        if scheds:
            first = scheds[0]
            vest_text = f"{first.get('cliff_months') or 0}mo/{first.get('total_months') or 0}mo"
            if h.get("vested_pct") is not None:
                vest_text += f" · {h['vested_pct']:.0f}% vested"
        else:
            vest_text = "None"
        row = [
            str(h.get("name") or "—"),
            TYPE_LABELS.get(h.get("holder_type"), h.get("holder_type") or "—"),
            str(h.get("share_class_name") or "—"),
            f"{h.get('shares') or 0:,}",
            f"{h.get('ownership_pct') or 0:.2f}%",
            _money(h.get("investment_amount")),
            vest_text,
        ]
        w.set_font("Helvetica", 8.5)
        w.set_text_color(0.15, 0.15, 0.15)
        x = MARGIN
        for i, cell in enumerate(row):
            w.text(x + 5, y + 5, cell)
            x += col_w[i]
        y += row_h

    # Rounds
    if rounds:
        y += 10
        if y > 780:
            w.new_page()
            page_no += 1
            footer()
            y = 60
        w.set_font("Helvetica-Bold", 10)
        w.set_text_color(0.1, 0.1, 0.1)
        w.text(MARGIN, y, "Investment rounds")
        y += 14
        for r in rounds:
            if y > 790:
                w.new_page()
                page_no += 1
                footer()
                y = 60
            w.set_font("Helvetica", 9)
            w.set_text_color(0.2, 0.2, 0.2)
            w.text(MARGIN, y, f"{r.get('round_name')} ({r.get('round_type')}) — {r.get('status')}  ·  Pre {_money(r.get('pre_money_valuation'))}  ·  Post {_money(r.get('post_money_valuation'))}  ·  Raised {_money(r.get('raised_amount'))}")
            y += 13

    return w.build()
