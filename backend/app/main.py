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

app = FastAPI(
    title="FounderHub AI API",
    description="Backend API for FounderHub AI",
    version="1.0.0",
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(profile_router)
app.include_router(startups_router)
app.include_router(applications_router)
app.include_router(matching_router)
app.include_router(chat_router)
app.include_router(notifications_router)
