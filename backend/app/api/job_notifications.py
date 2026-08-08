from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.config import settings
from app.core.supabase import service_supabase
from app.services.notification_service import notify

router = APIRouter(prefix="/api", tags=["jobs-notifications"])


def _profile(user_id: str) -> dict | None:
    res = (
        service_supabase.table("profiles")
        .select("full_name, skills")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def _job(job_id: str) -> dict | None:
    res = (
        service_supabase.table("jobs")
        .select("title, posted_by, startup_id, skills_required, startups(name)")
        .eq("id", job_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        return None
    job = res.data[0]
    startup_name = None
    if job.get("startups"):
        startup_name = job["startups"].get("name")
    job["startup_name"] = startup_name or "the startup"
    return job


class ApplicationNotifyIn(BaseModel):
    job_id: str
    applicant_id: str


@router.post("/notify-job-application", status_code=202)
async def notify_job_application(payload: ApplicationNotifyIn) -> dict:
    """Notify the job poster + email them about a new application."""
    job = _job(payload.job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    applicant = _profile(payload.applicant_id)
    applicant_name = (applicant or {}).get("full_name") or "A new candidate"

    poster_id = job.get("posted_by")
    if poster_id:
        notify(
            poster_id,
            "job_application",
            "New job application",
            f"{applicant_name} applied for {job['title']}",
            {"job_id": payload.job_id, "applicant_id": payload.applicant_id},
            template="job_application",
            template_data={
                "user_name": (poster := _profile(poster_id) or {}).get("full_name") or "there",
                "from_name": applicant_name,
                "job_title": job["title"],
                "startup_name": job["startup_name"],
                "action_url": settings.frontend_url_for("/jobs"),
            },
            dedupe_key=f"job_application:{payload.job_id}:{payload.applicant_id}",
        )

    return {"ok": True}


@router.post("/notify-new-job/{job_id}", status_code=202)
async def notify_new_job(job_id: str) -> dict:
    """Job alert: notify + email candidates whose skills overlap the new role."""
    job = _job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    required = [s.lower() for s in (job.get("skills_required") or [])]
    if not required:
        return {"ok": True, "matched": 0}

    res = service_supabase.table("profiles").select("id, full_name, skills").limit(500).execute()
    matched = 0
    for profile in res.data or []:
        if profile.get("id") == job.get("posted_by"):
            continue
        profile_skills = [s.lower() for s in (profile.get("skills") or [])]
        if not any(s in required for s in profile_skills):
            continue
        if matched >= 20:
            break
        matched += 1
        notify(
            profile["id"],
            "job_application",
            "New job matches your skills",
            f"{job['startup_name']} is hiring a {job['title']}",
            {"job_id": job_id},
            template="job_application",
            template_data={
                "user_name": profile.get("full_name") or "there",
                "job_title": job["title"],
                "startup_name": job["startup_name"],
                "action_url": settings.frontend_url_for("/jobs"),
            },
            dedupe_key=f"job_alert:{job_id}:{profile['id']}",
        )

    return {"ok": True, "matched": matched}


class StatusNotifyIn(BaseModel):
    application_id: str
    new_status: str


@router.post("/notify-job-status", status_code=202)
async def notify_job_status(payload: StatusNotifyIn) -> dict:
    """Notify + email an applicant about a status change on their application."""
    res = (
        service_supabase.table("job_applications")
        .select("id, applicant_id, job_id, status, jobs(title)")
        .eq("id", payload.application_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Application not found")
    app = res.data[0]
    job_title = None
    if app.get("jobs"):
        job_title = app["jobs"].get("title")
    job_title = job_title or "the role"

    applicant = _profile(app["applicant_id"])
    if applicant:
        notify(
            app["applicant_id"],
            "job_status_update",
            f"Application {payload.new_status}",
            f"Your application for {job_title} was {payload.new_status}",
            {"application_id": payload.application_id, "status": payload.new_status},
            template="job_application",
            template_data={
                "user_name": applicant.get("full_name") or "there",
                "job_title": job_title,
                "status": payload.new_status,
                "action_url": settings.frontend_url_for("/jobs"),
            },
            dedupe_key=f"job_status:{payload.application_id}:{payload.new_status}",
        )

    return {"ok": True}
