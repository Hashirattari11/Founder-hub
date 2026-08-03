from fastapi import Header, HTTPException
from supabase import create_client
from app.core.config import settings


def get_user_id(authorization: str | None = Header(default=None)) -> str:
    """Extract the authenticated user id from a Bearer JWT."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    try:
        import jwt as pyjwt

        payload = pyjwt.decode(
            token,
            options={"verify_signature": False, "verify_aud": False},
        )
        user_id = payload.get("sub")
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc

    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token: missing subject")

    return user_id


def get_user_client(authorization: str | None = Header(default=None)):
    """Build a supabase client acting as the user (so RLS applies).

    The publishable/anon key goes in the `apikey` header (like the browser
    does) and the user's access token is passed as the bearer token, so
    PostgREST recognizes the key and derives identity from the JWT.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    client = create_client(settings.supabase_url, settings.supabase_anon_key)
    client.postgrest.auth(token)
    return client
