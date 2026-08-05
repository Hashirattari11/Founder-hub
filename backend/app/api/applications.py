from fastapi import APIRouter, HTTPException, Depends
from app.core.auth import get_user_client, get_user_id
from app.core.supabase import service_supabase
from app.core.email import email_for_application, email_for_status_update
from app.core.users import user_email, user_full_name
from app.schemas.application import ApplicationIn, ApplicationOut, StatusUpdateIn

router = APIRouter(prefix="/api/applications", tags=["applications"])


def notify_founder(startup_id: str, applicant_name: str, role: str, applicant_id: str) -> None:
    """Notify the startup founder about a new application."""
    startup = (
        service_supabase.table("startups")
        .select("founder_id, name")
        .eq("id", startup_id)
        .limit(1)
        .execute()
    )
    if not startup.data:
        return
    founder_id = startup.data[0].get("founder_id")
    startup_name = startup.data[0].get("name", "your startup")
    if not founder_id:
        return

    body = f"{applicant_name} applied for {role}"
    try:
        service_supabase.table("notifications").insert(
            {
                "user_id": founder_id,
                "type": "new_application",
                "title": "New application received",
                "body": body,
                "data": {"startup_id": startup_id, "applicant_id": applicant_id},
            }
        ).execute()
    except Exception as exc:
        print(f"[notifications] failed to notify founder: {exc}")

    # Email founder (Resend)
    founder_email = user_email(founder_id)
    if founder_email:
        email_for_application(
            founder_email,
            user_full_name(founder_id) or "there",
            startup_name,
            applicant_name,
            role,
        )

    # Stub for Day 11 full pipeline
    print("notifyFounder() →", founder_id, "for application to", startup_id)


@router.get("", response_model=list[ApplicationOut])
async def list_my_applications(user_client=Depends(get_user_client)):
    """List the current user's applications."""
    result = (
        user_client.table("applications")
        .select("*")
        .order("created_at", desc=True)
        .execute()
    )
    return result.data


@router.get("/startup/{startup_id}", response_model=list[ApplicationOut])
async def list_startup_applications(
    startup_id: str,
    user_client=Depends(get_user_client),
):
    """List applications for a startup (founder only — enforced by RLS)."""
    result = (
        user_client.table("applications")
        .select("*")
        .eq("startup_id", startup_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data


@router.post("", response_model=ApplicationOut, status_code=201)
async def submit_application(
    payload: ApplicationIn,
    user_id: str = Depends(get_user_id),
    user_client=Depends(get_user_client),
):
    """Submit an application to a startup."""
    # Ensure the startup exists and is published.
    startup = (
        user_client.table("startups")
        .select("id, is_published")
        .eq("id", payload.startup_id)
        .limit(1)
        .execute()
    )
    if not startup.data:
        raise HTTPException(status_code=404, detail="Startup not found")
    if not startup.data[0].get("is_published"):
        raise HTTPException(status_code=404, detail="Startup not found")

    # Founder cannot apply to their own startup.
    result = (
        user_client.table("startups")
        .select("founder_id")
        .eq("id", payload.startup_id)
        .limit(1)
        .execute()
    )
    if result.data and result.data[0].get("founder_id") == user_id:
        raise HTTPException(status_code=400, detail="You cannot apply to your own startup")

    insert = (
        user_client.table("applications")
        .insert(
            {
                "startup_id": payload.startup_id,
                "applicant_id": user_id,
                "role_applying_for": payload.role_applying_for,
                "cover_message": payload.cover_message,
            }
        )
        .execute()
    )

    if not insert.data:
        # Likely a duplicate (unique startup_id + applicant_id).
        raise HTTPException(status_code=409, detail="You have already applied to this startup")

    application = insert.data[0]

    # Notify the founder (in-app + email) + stub pipeline call.
    applicant = (
        service_supabase.table("profiles")
        .select("full_name")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    applicant_name = (applicant.data[0].get("full_name") if applicant.data else None) or "A new member"
    notify_founder(payload.startup_id, applicant_name, payload.role_applying_for, user_id)

    return application


@router.patch("/{application_id}/status", response_model=ApplicationOut)
async def update_application_status(
    application_id: str,
    payload: StatusUpdateIn,
    user_id: str = Depends(get_user_id),
    user_client=Depends(get_user_client),
):
    """Update an application status (founder only — enforced by RLS)."""
    valid = {"pending", "shortlisted", "accepted", "rejected"}
    if payload.status not in valid:
        raise HTTPException(status_code=400, detail="Invalid status")

    result = (
        user_client.table("applications")
        .update({"status": payload.status})
        .eq("id", application_id)
        .select()
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Application not found or no permission")

    app = result.data[0]

    # Notify applicant of the status change.
    applicant_id = app.get("applicant_id")
    startup = (
        service_supabase.table("startups")
        .select("name")
        .eq("id", app.get("startup_id"))
        .limit(1)
        .execute()
    )
    startup_name = (startup.data[0].get("name") if startup.data else None) or "your startup"
    role = app.get("role_applying_for") or "your role"

    try:
        service_supabase.table("notifications").insert(
            {
                "user_id": applicant_id,
                "type": "status_update",
                "title": f"Application {payload.status}",
                "body": f"Your application for {role} at {startup_name} was {payload.status}",
                "data": {"application_id": application_id, "status": payload.status, "startup_id": app.get("startup_id")},
            }
        ).execute()
    except Exception as exc:
        print(f"[notifications] failed to notify applicant: {exc}")

    # Email applicant (Resend)
    applicant_email = user_email(applicant_id)
    if applicant_email:
        email_for_status_update(
            applicant_email,
            user_full_name(applicant_id) or "there",
            startup_name,
            role,
            payload.status,
        )

    return app
