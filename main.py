"""Vercel entrypoint for FounderHub.

Serves the FastAPI backend under /api/* and the built frontend (SPA) from
frontend/dist. On Vercel this file is detected as the ASGI app entrypoint
(uses the `app` object from app.main), so one deployment serves the whole
product.
"""

import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(_HERE, "backend"))

from dotenv import load_dotenv

_dotenv_path = os.path.join(_HERE, "backend", ".env")
if os.path.exists(_dotenv_path):
    load_dotenv(_dotenv_path)

from starlette.requests import Request
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from app.main import app

_DIST = os.path.join(_HERE, "frontend", "dist")
_ASSETS = os.path.join(_DIST, "assets")
_INDEX = os.path.join(_DIST, "index.html")
_PUBLIC = os.path.join(_HERE, "frontend", "public")


def _static_path(name: str) -> str:
    """Resolve a root-level static file.

    Prefers the build output (frontend/dist) and falls back to the committed
    source folder (frontend/public), which is always present in the function
    bundle. robots.txt / sitemap.xml / og-image.png must NEVER fall through to
    the SPA fallback.
    """
    dist_file = os.path.join(_DIST, name)
    if os.path.isfile(dist_file):
        return dist_file
    return os.path.join(_PUBLIC, name)


# Static assets (bundled JS/CSS). Guard the mount — a missing dist folder must
# not crash the entire serverless function at import time.
if os.path.isdir(_ASSETS):
    app.mount("/assets", StaticFiles(directory=_ASSETS), name="assets")

for _name in (
    "favicon-48x48.png",
    "favicon.svg",
    "icons.svg",
    "logo.png",
    "favicon.ico",
    "icon-192.png",
    "icon-512.png",
    "apple-touch-icon.png",
    "manifest.webmanifest",
    "robots.txt",
    "sitemap.xml",
    "og-image.png",
):
    _file = _static_path(_name)
    if os.path.isfile(_file):
        app.add_api_route(
            "/" + _name,
            lambda _file=_file: FileResponse(_file),
            include_in_schema=False,
        )


# Google OAuth: Supabase may redirect to Site URL root (`/?code=`) instead of
# `/auth/callback`. Forward before SPA loads so Callback.tsx can exchange PKCE.
@app.middleware("http")
async def oauth_root_code_redirect(request: Request, call_next):
    if request.method == "GET":
        code = request.query_params.get("code")
        path = request.url.path
        if (
            code
            and path != "/auth/callback"
            and not path.startswith("/api")
            and path != "/health"
        ):
            return RedirectResponse(
                url=f"/auth/callback?{request.url.query}",
                status_code=302,
            )
    return await call_next(request)


# Root-level static files that must NEVER be answered with the SPA shell.
# They are handled by the routes above; reaching this fallback means the file
# is missing on this deployment — return 404 instead of HTML so crawlers and
# browsers never see the React app for /robots.txt or /sitemap.xml.
_ROOT_STATIC = frozenset(
    {
        "robots.txt",
        "sitemap.xml",
        "og-image.png",
        "manifest.webmanifest",
        "favicon-48x48.png",
        "favicon.svg",
        "icons.svg",
        "logo.png",
        "favicon.ico",
        "icon-192.png",
        "icon-512.png",
        "apple-touch-icon.png",
    }
)


# SPA fallback: serve index.html for any client-side route.
@app.get("/{full_path:path}", include_in_schema=False)
async def spa_fallback(full_path: str):
    if full_path.startswith("api") or full_path == "health":
        return JSONResponse(status_code=404, content={"detail": "Not found"})
    if full_path in _ROOT_STATIC:
        return JSONResponse(status_code=404, content={"detail": "Not found"})
    if not os.path.isfile(_INDEX):
        return JSONResponse(
            status_code=503,
            content={
                "detail": "Frontend bundle missing on this deployment.",
                "hint": "Redeploy from the repo root so Vercel runs the frontend build (frontend/dist).",
                "fallback_url": "https://founder-hub-0.vercel.app",
            },
        )
    return FileResponse(_INDEX)
