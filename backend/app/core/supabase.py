from typing import Any, Optional
from supabase import create_client
from app.core.config import settings


class LazyClient:
    """Create the Supabase client on first use so the backend boots even
    when keys are missing or in an unsupported format.
    """

    def __init__(self, url: str, key: str, name: str):
        self._url = url
        self._key = key
        self._name = name
        self._client: Optional[Any] = None
        self._error: Optional[str] = None

    def _ensure(self):
        if self._client is None:
            if not self._url or not self._key:
                self._error = f"{self._name}: SUPABASE_URL/keys are not configured"
                return
            try:
                self._client = create_client(self._url, self._key)
            except Exception as exc:  # e.g. invalid/legacy-unsupported key format
                self._error = f"{self._name}: {exc}"
        return self._client

    def __getattr__(self, item: str) -> Any:
        client = self._ensure()
        if client is None:
            raise RuntimeError(self._error or f"{self._name} is unavailable")
        return getattr(client, item)

    @property
    def available(self) -> bool:
        return self._ensure() is not None

    @property
    def error(self) -> Optional[str]:
        self._ensure()
        return self._error


supabase = LazyClient(settings.supabase_url, settings.supabase_anon_key, "supabase")
service_supabase = LazyClient(
    settings.supabase_url,
    settings.supabase_service_role_key or settings.supabase_anon_key,
    "service_supabase",
)
