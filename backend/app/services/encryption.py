"""Encryption helpers for user-supplied secrets (API keys at rest).

Keys are encrypted with Fernet (AES-128-CBC + HMAC, urlsafe-b64). The
ENCRYPTION_KEY env var is expected to be a base64-encoded 32-byte Fernet key
(generate one with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())").
For resilience, any other non-empty value is deterministically padded/hashed
into a stable 32-byte key so the service still boots in dev without a proper key.
"""

import base64
import hashlib

from cryptography.fernet import Fernet

from app.core.config import settings

ENCRYPTION_KEY = settings.encryption_key


def _get_fernet() -> Fernet:
    raw = ENCRYPTION_KEY.strip()
    if len(raw) == 44:
        try:
            return Fernet(raw.encode())
        except Exception:
            pass
    if raw:
        digest = hashlib.sha256(raw.encode()).digest()
    else:
        digest = hashlib.sha256(b"founderhub-ai-dev-fallback").digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_api_key(api_key: str) -> str:
    return _get_fernet().encrypt(api_key.encode()).decode()


def decrypt_api_key(encrypted_key: str) -> str:
    return _get_fernet().decrypt(encrypted_key.encode()).decode()
