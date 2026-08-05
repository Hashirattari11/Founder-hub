from app.core.supabase import service_supabase


def user_email(user_id: str) -> str | None:
    """Look up a user's email from auth.users via the service role admin API.

    profiles has no email column — auth.users is the source of truth and is
    only readable with the service role key.
    """
    if not service_supabase.available:
        return None
    try:
        response = service_supabase.auth.admin.get_user_by_id(user_id)
        return response.user.email if response and response.user else None
    except Exception as exc:
        print(f"[users] failed to fetch email for {user_id}: {exc}")
        return None


def user_full_name(user_id: str) -> str | None:
    if not service_supabase.available:
        return None
    try:
        row = (
            service_supabase.table("profiles")
            .select("full_name")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        return (row.data[0] or {}).get("full_name") if row.data else None
    except Exception:
        return None
