import uvicorn

from app.main import app  # noqa: F401 — exposes `app` for `uvicorn backend.main:app`

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8001, reload=True)
