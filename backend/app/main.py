import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from postgrest.exceptions import APIError
from app.core.config import settings
from app.api.health import router as health_router
from app.api.profile import router as profile_router
from app.api.startups import router as startups_router
from app.api.applications import router as applications_router
from app.api.matching import router as matching_router
from app.api.chat import router as chat_router
from app.api.notifications import router as notifications_router
from app.api.community_notifications import router as community_notifications_router
from app.api.notification_center import router as notification_center_router
from app.api.brevo_webhook import router as brevo_webhook_router
from app.api.job_notifications import router as job_notifications_router
from app.api.ai import router as ai_router
from app.api.ai_settings import router as ai_settings_router
from app.api.meetings import router as meetings_router
from app.api.push import router as push_router
from app.api.cofounder import router as cofounder_router
from app.api.investor_match import router as investor_match_router
from app.api.data_room import router as data_room_router
from app.api.cap_table import router as cap_table_router
from app.api.equity import router as equity_router
from app.api.business_plan import router as business_plan_router
from app.api.ai_studio import router as ai_studio_router
from app.api.startup_insights import router as startup_insights_router
from app.api.admin import router as admin_router
from app.api.role_requests import router as role_requests_router
from app.api.reports import router as reports_router
from app.api.analytics import router as analytics_router
from app.api.due_diligence import router as due_diligence_router
from app.api.war_room import router as war_room_router
from app.api.ai_matches import router as ai_matches_router
from app.core.request_tracking import RequestTrackingMiddleware
from app.core.security import bootstrap_super_admin
from app.services.reminder_service import reminder_loop
from app.services.push_service import push_loop
from app.services.email_queue_service import drain_pending, email_loop
from app.services.presence_service import presence_loop


@asynccontextmanager
async def lifespan(app: FastAPI):
    await asyncio.to_thread(bootstrap_super_admin)
    # Flush anything left in the email queue by a previous instance (serverless recovery).
    try:
        await asyncio.to_thread(drain_pending)
    except Exception:
        pass
    stop_event = asyncio.Event()
    reminder_task = asyncio.create_task(reminder_loop(stop_event))
    push_task = asyncio.create_task(push_loop(stop_event))
    email_task = asyncio.create_task(email_loop(stop_event))
    presence_task = asyncio.create_task(presence_loop(stop_event))
    yield
    stop_event.set()
    for task in (reminder_task, push_task, email_task, presence_task):
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


app = FastAPI(
    title="FounderHub AI API",
    description="Backend API for FounderHub AI",
    version="1.0.0",
    lifespan=lifespan,
)


@app.exception_handler(APIError)
async def postgrest_error_handler(_, exc: APIError):
    """Translate common PostgREST errors into useful JSON responses."""
    code = getattr(exc, "code", None)
    message = getattr(exc, "message", str(exc))
    if code == "PGRST205":
        # Table missing — the schema migration hasn't been run.
        return JSONResponse(
            status_code=503,
            content={
                "detail": "Database schema is not set up yet. Run supabase/migrations/setup_all.sql in the Supabase SQL Editor."
            },
        )
    if code == "42501" or "permission denied" in message.lower():
        return JSONResponse(
            status_code=403,
            content={
                "detail": "Permission denied. A SUPABASE_SERVICE_ROLE_KEY may be required for cross-user operations."
            },
        )
    return JSONResponse(status_code=400, content={"detail": message})

app.add_middleware(RequestTrackingMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_secure_headers(request, call_next):
    """Security hardening headers on every response (F2.3.1)."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(self), microphone=(self), geolocation=(), payment=()"
    response.headers["X-XSS-Protection"] = "0"
    if request.url.scheme == "https":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

app.include_router(health_router)
app.include_router(profile_router)
app.include_router(startups_router)
app.include_router(applications_router)
app.include_router(matching_router)
app.include_router(chat_router)
app.include_router(notifications_router)
app.include_router(community_notifications_router)
app.include_router(notification_center_router)
app.include_router(brevo_webhook_router)
app.include_router(job_notifications_router)
app.include_router(ai_router)
app.include_router(ai_settings_router)
app.include_router(meetings_router)
app.include_router(push_router)
app.include_router(cofounder_router)
app.include_router(investor_match_router)
app.include_router(data_room_router)
app.include_router(cap_table_router)
app.include_router(equity_router)
app.include_router(business_plan_router)
app.include_router(ai_studio_router)
app.include_router(startup_insights_router)
app.include_router(admin_router)
app.include_router(role_requests_router)
app.include_router(reports_router)
app.include_router(analytics_router)
app.include_router(due_diligence_router)
app.include_router(war_room_router)
app.include_router(ai_matches_router)
