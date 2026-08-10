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

from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.main import app

_DIST = os.path.join(_HERE, "frontend", "dist")


def _static_path(name: str) -> str:
    return os.path.join(_DIST, name)


# Static assets (bundled JS/CSS). API routes registered in app.main are
# matched first, so /api/* keeps working.
app.mount("/assets", StaticFiles(directory=os.path.join(_DIST, "assets")), name="assets")

for _name in (
    "favicon.svg",
    "icons.svg",
    "logo.png",
    "favicon.ico",
    "icon-192.png",
    "icon-512.png",
    "apple-touch-icon.png",
    "manifest.webmanifest",
):
    if os.path.exists(_static_path(_name)):
        app.add_api_route(
            "/" + _name,
            lambda _name=_name: FileResponse(_static_path(_name)),
            include_in_schema=False,
        )


# SPA fallback: serve index.html for any client-side route.
@app.get("/{full_path:path}", include_in_schema=False)
async def spa_fallback(full_path: str):
    if full_path.startswith("api") or full_path == "health":
        return JSONResponse(status_code=404, content={"detail": "Not found"})
    return FileResponse(os.path.join(_DIST, "index.html"))
