import os
from typing import Optional

import requests
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.auth import get_user_id
from app.core.models import PROVIDER_MODELS
from app.core.supabase import service_supabase
from app.api.ai import _extract_provider_error
from app.services.encryption import decrypt_api_key, encrypt_api_key

router = APIRouter(prefix="/api/ai-settings", tags=["ai-settings"])


class SaveAPIKeyRequest(BaseModel):
    provider: str
    api_key: str
    selected_model: Optional[str] = None


class TestAPIKeyRequest(BaseModel):
    provider: str
    api_key: str
    model: Optional[str] = None


VALID_PROVIDERS = {"anthropic", "openai", "openrouter", "nvidia"}


def _nvidia_error_message(detail: str) -> str:
    detail = detail.strip()
    if "ResourceExhausted" in detail or "rate limit" in detail.lower():
        return (
            "Nvidia NIM is at capacity (free-tier request limit reached). "
            "Your key looks fine — wait a minute and test again, or switch to "
            "a different model in AI Settings."
        )
    if "401" in detail or "unauthorized" in detail.lower() or "invalid api key" in detail.lower():
        return (
            "Nvidia NIM error: the API key was rejected (401). Double-check the "
            "key at https://build.nvidia.com/ and paste it again."
        )
    if "not found for account" in detail or "Function" in detail or "404" in detail:
        return (
            "Nvidia NIM error: this model/key isn't available for your account. "
            "Fix: (1) enable 'Public API Endpoints' in your NVIDIA Developer "
            "account settings, (2) use a model from your account's available list "
            "(GET https://integrate.api.nvidia.com/v1/models with your key), or "
            "(3) generate a fresh NVIDIA API key."
        )
    return f"Nvidia NIM error: {detail}"


@router.get("/models")
async def get_models():
    return PROVIDER_MODELS


@router.post("/save-key")
async def save_api_key(
    payload: SaveAPIKeyRequest,
    user_id: str = Depends(get_user_id),
):
    provider = payload.provider
    if provider not in VALID_PROVIDERS:
        raise HTTPException(status_code=400, detail="Unknown provider")

    if not payload.api_key.strip():
        raise HTTPException(status_code=400, detail="API key is required")

    encrypted = encrypt_api_key(payload.api_key.strip())

    existing = (
        service_supabase.table("ai_provider_settings")
        .select("id")
        .eq("user_id", user_id)
        .eq("provider", provider)
        .execute()
    )

    if existing.data:
        service_supabase.table("ai_provider_settings").update(
            {
                "api_key_encrypted": encrypted,
                "selected_model": payload.selected_model,
                "test_status": "untested",
                "updated_at": "now()",
            }
        ).eq("user_id", user_id).eq("provider", provider).execute()
    else:
        service_supabase.table("ai_provider_settings").insert(
            {
                "user_id": user_id,
                "provider": provider,
                "api_key_encrypted": encrypted,
                "selected_model": payload.selected_model,
                "test_status": "untested",
            }
        ).execute()

    return {"success": True, "message": "API key saved securely"}


@router.post("/test-key")
async def test_api_key(
    payload: TestAPIKeyRequest,
    _user_id: str = Depends(get_user_id),
):
    provider = payload.provider
    if provider not in VALID_PROVIDERS:
        raise HTTPException(status_code=400, detail="Unknown provider")

    try:
        if provider == "anthropic":
            import anthropic

            client = anthropic.Anthropic(api_key=payload.api_key)
            client.messages.create(
                model=payload.model or "claude-haiku-4-5-20251001",
                max_tokens=10,
                messages=[{"role": "user", "content": "Hi"}],
            )

        elif provider == "openai":
            import openai

            client = openai.OpenAI(api_key=payload.api_key)
            client.chat.completions.create(
                model=payload.model or "gpt-4o-mini",
                messages=[{"role": "user", "content": "Hi"}],
                max_tokens=10,
            )

        elif provider == "openrouter":
            response = requests.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {payload.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": payload.model or "meta-llama/llama-3.1-70b-instruct",
                    "messages": [{"role": "user", "content": "Hi"}],
                    "max_tokens": 10,
                },
                timeout=60,
            )
            if response.status_code != 200:
                raise Exception(f"OpenRouter error: {_extract_provider_error(response)}")

        elif provider == "nvidia":
            response = requests.post(
                "https://integrate.api.nvidia.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {payload.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": payload.model or "meta/llama-3.1-70b-instruct",
                    "messages": [{"role": "user", "content": "Hi"}],
                    "max_tokens": 10,
                },
                timeout=60,
            )
            if response.status_code != 200:
                detail = _extract_provider_error(response)
                raise Exception(_nvidia_error_message(detail))

        # Record a successful test for a saved key if it exists
        saved = (
            service_supabase.table("ai_provider_settings")
            .select("id")
            .eq("user_id", _user_id)
            .eq("provider", provider)
            .execute()
        )
        if saved.data:
            service_supabase.table("ai_provider_settings").update(
                {
                    "test_status": "success",
                    "last_tested_at": "now()",
                    "updated_at": "now()",
                }
            ).eq("user_id", _user_id).eq("provider", provider).execute()

        return {"success": True, "message": "Connection successful!"}

    except HTTPException:
        raise
    except Exception as e:
        # Record a failed test for a saved key if it exists, unless the
        # failure was a transient provider capacity/rate-limit issue.
        transient = "capacity" in str(e) or "rate limit" in str(e).lower() or "ResourceExhausted" in str(e)
        saved = (
            service_supabase.table("ai_provider_settings")
            .select("id")
            .eq("user_id", _user_id)
            .eq("provider", provider)
            .execute()
        )
        if saved.data:
            status = "untested" if transient else "failed"
            service_supabase.table("ai_provider_settings").update(
                {
                    "test_status": status,
                    "last_tested_at": "now()",
                    "updated_at": "now()",
                }
            ).eq("user_id", _user_id).eq("provider", provider).execute()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/my-keys")
async def get_user_keys(user_id: str = Depends(get_user_id)):
    result = (
        service_supabase.table("ai_provider_settings")
        .select("provider, selected_model, is_active, test_status, last_tested_at")
        .eq("user_id", user_id)
        .execute()
    )
    # Return without decrypted keys
    return result.data


@router.delete("/delete-key/{provider}")
async def delete_api_key(provider: str, user_id: str = Depends(get_user_id)):
    if provider not in VALID_PROVIDERS:
        raise HTTPException(status_code=400, detail="Unknown provider")
    service_supabase.table("ai_provider_settings").delete().eq(
        "user_id", user_id
    ).eq("provider", provider).execute()
    return {"success": True}
