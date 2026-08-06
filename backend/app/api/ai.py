import asyncio
import json
import threading
from typing import Optional

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.core.auth import get_user_id
from app.core.config import settings
from app.core.models import PLATFORM_DEFAULT_MODEL
from app.core.supabase import service_supabase
from app.services.encryption import decrypt_api_key

router = APIRouter(prefix="/api/ai", tags=["ai"])

PROMPTS = {
    "business_plan": (
        "You are a world-class startup strategist. Write a detailed, structured business plan "
        "for the following idea. Cover the problem, solution, target market, business model, "
        "competitive landscape, go-to-market strategy, financial projections and risks. "
        "Use clear headings.\n\nIdea: {idea}"
    ),
    "pitch_deck": (
        "You are an expert pitch-deck writer. Outline a compelling pitch deck for the following "
        "idea: slide-by-slide (Problem, Solution, Market, Product, Traction, Business Model, Team, "
        "Ask), with punchy one-line takeaways for each slide.\n\nIdea: {idea}"
    ),
    "product_roadmap": (
        "You are a senior product manager. Build a phased 12-month product roadmap for the following "
        "idea: phases, key features per phase, success metrics and risks.\n\nIdea: {idea}"
    ),
    "equity_split": (
        "You are an expert startup advisor specializing in equity allocation (YC-style guidelines). "
        "Suggest a fair equity split for a startup with these founders:\n{founders}\n"
        "Reserve an ESOP pool of {esop}% and an investor pool of {investor}%.\n"
        "Follow YC and standard startup equity guidelines. Suggest percentages for each founder, "
        "the ESOP pool, and the investor pool. Explain your reasoning, note who should vest on "
        "what schedule (standard: 4-year vest, 1-year cliff), and flag anything unusual."
    ),
}


class GenerateIn(BaseModel):
    feature: str
    idea: Optional[str] = None
    context: Optional[dict] = None


# ---------------------------------------------------------------------------
# Offline fallback generators (used when no API key is configured anywhere)
# ---------------------------------------------------------------------------

def _build_cover_letter(ctx: dict) -> str:
    job_title = ctx.get("job_title") or "this role"
    company = ctx.get("startup_name") or "your startup"
    name = ctx.get("name") or "I"
    role = ctx.get("profile_role") or "professional"
    skills = ctx.get("skills") or []
    skill_str = ", ".join(skills[:6]) if skills else "relevant technical skills"

    para1 = (
        f"Dear {company} team,\n\n"
        f"I am writing to apply for the {job_title} position at {company}. "
        f"As a {role} with experience across {skill_str}, "
        f"I am excited about the opportunity to bring my skills to your team."
    )
    para2 = (
        f"\n\nI have been following {company} and admire the vision and momentum of the team. "
        f"I believe my background aligns well with what you are building, and I would welcome "
        f"the chance to contribute from day one. I am comfortable working in fast-moving "
        f"startup environments and enjoy owning problems end to end."
    )
    para3 = (
        f"\n\nI have attached my resume and would love the chance to discuss how I can add value "
        f"to {company}. Thank you for your time and consideration.\n\n"
        f"Best regards,\n{name}"
    )
    return para1 + para2 + para3


def _build_equity_split(ctx: dict) -> str:
    founders = ctx.get("founders") or []
    lines = []
    for i, f in enumerate(founders, start=1):
        name = f.get("name") or f"Founder {i}"
        role = f.get("role") or "co-founder"
        commitment = f.get("commitment") or "full-time"
        experience = f.get("experience") or 0
        lines.append(f"{i}. {name} — {role}, {commitment}, {experience} years experience")
    founders_text = "\n".join(lines) or "1. Founder 1 — co-founder, full-time, 0 years experience"
    esop = ctx.get("esop") or 10
    investor = ctx.get("investor") or 0
    return (
        "Suggest a fair equity split for a startup with these founders:\n"
        f"{founders_text}\n"
        f"Reserve an ESOP pool of {esop}% and an investor pool of {investor}%.\n"
        "Follow YC and standard startup equity guidelines. Suggest percentages for each founder, "
        "the ESOP pool, and the investor pool. Explain your reasoning, note who should vest on "
        "what schedule (standard: 4-year vest, 1-year cliff), and flag anything unusual."
    )


def _build_prompt(feature: str, idea: Optional[str], ctx: dict) -> str:
    if feature == "cover_letter":
        return _build_cover_letter(ctx)
    if feature == "equity_split":
        return _build_equity_split(ctx)
    template = PROMPTS.get(feature, PROMPTS["business_plan"])
    return template.replace("{idea}", idea or "your startup idea")


# ---------------------------------------------------------------------------
# Provider streaming generators (blocking — run in a worker thread)
# ---------------------------------------------------------------------------

def _stream_anthropic(api_key: str, model_id: str, prompt: str):
    import anthropic

    client = anthropic.Anthropic(api_key=api_key)
    with client.messages.stream(
        model=model_id,
        max_tokens=4000,
        messages=[{"role": "user", "content": prompt}],
    ) as stream:
        for text in stream.text_stream:
            yield text


def _stream_openai(api_key: str, model_id: str, prompt: str):
    import openai

    client = openai.OpenAI(api_key=api_key)
    stream = client.chat.completions.create(
        model=model_id,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=4000,
        stream=True,
    )
    for chunk in stream:
        if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content


def _stream_http(api_key: str, model_id: str, prompt: str, url: str):
    import requests

    response = requests.post(
        url,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model_id,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 4000,
            "stream": True,
        },
        stream=True,
        timeout=300,
    )
    if response.status_code != 200:
        try:
            detail = response.json().get("detail") or response.text[:300]
        except Exception:
            detail = response.text[:300]
        raise Exception(f"{url.split('/')[2]} error: {detail}")
    for line in response.iter_lines(decode_unicode=True):
        if not line or not line.startswith("data: "):
            continue
        data = line[6:].strip()
        if data == "[DONE]":
            break
        try:
            parsed = json.loads(data)
            content = parsed["choices"][0]["delta"].get("content", "")
        except Exception:
            continue
        if content:
            yield content


def _stream_openrouter(api_key: str, model_id: str, prompt: str):
    yield from _stream_http(
        api_key, model_id, prompt, "https://openrouter.ai/api/v1/chat/completions"
    )


def _stream_nvidia(api_key: str, model_id: str, prompt: str):
    yield from _stream_http(
        api_key, model_id, prompt, "https://integrate.api.nvidia.com/v1/chat/completions"
    )


STREAM_FNS = {
    "anthropic": _stream_anthropic,
    "openai": _stream_openai,
    "openrouter": _stream_openrouter,
    "nvidia": _stream_nvidia,
}


def _resolve_user_provider(user_id: str):
    """Return (provider, api_key, model) from the user's saved settings, or None."""
    try:
        profile = (
            service_supabase.table("profiles")
            .select("preferred_ai_provider, preferred_ai_model")
            .eq("id", user_id)
            .single()
            .execute()
            .data
        )
    except Exception:
        profile = None

    preferred = (profile or {}).get("preferred_ai_provider") or "platform"
    if preferred == "platform":
        return None

    try:
        key_result = (
            service_supabase.table("ai_provider_settings")
            .select("api_key_encrypted, selected_model, provider")
            .eq("user_id", user_id)
            .eq("provider", preferred)
            .eq("is_active", True)
            .single()
            .execute()
        )
    except Exception:
        key_result = None

    if not key_result or not key_result.data:
        return None

    row = key_result.data
    return row["provider"], decrypt_api_key(row["api_key_encrypted"]), row.get("selected_model")


def generate_text_sync(user_id: str, prompt: str, system: Optional[str] = None) -> str:
    """Run a non-streaming generation against the user's preferred AI source.

    Falls back to the platform Anthropic key. Returns the full text output.
    Raises RuntimeError when no AI source is configured or the call fails.
    """
    resolved = None
    if user_id:
        resolved = _resolve_user_provider(user_id)

    provider, api_key, model = None, None, None
    if resolved:
        provider, api_key, model = resolved
        model = model or _default_model(provider)
    elif settings.anthropic_api_key:
        provider, api_key, model = "anthropic", settings.anthropic_api_key, PLATFORM_DEFAULT_MODEL

    if not api_key or provider not in STREAM_FNS:
        raise RuntimeError(
            "Please select an AI model first. Open AI Settings, add your API key, "
            "pick a model, and set it as your preferred AI source, then try again."
        )

    chunks: list[str] = []
    stream_fn = STREAM_FNS[provider]
    for chunk in stream_fn(api_key, model, prompt):
        chunks.append(chunk)

    text = "".join(chunks).strip()
    if not text:
        raise RuntimeError("The AI returned an empty response. Try again.")
    return text


def _default_model(provider: str) -> str:
    if provider == "anthropic":
        return PLATFORM_DEFAULT_MODEL
    defaults = {
        "openai": "gpt-4o-mini",
        "openrouter": "meta-llama/llama-3.1-70b-instruct",
        "nvidia": "meta/llama-3.1-70b-instruct",
    }
    return defaults.get(provider, PLATFORM_DEFAULT_MODEL)


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post("/generate")
async def generate(
    payload: GenerateIn,
    user_id: str = Depends(get_user_id),
) -> StreamingResponse:
    feature = payload.feature or "business_plan"
    idea = payload.idea
    ctx = payload.context or {}

    # 1) User's own API key -> their provider/model.
    resolved = None
    if user_id:
        resolved = _resolve_user_provider(user_id)

    # 2) Platform fallback -> Anthropic server key.
    provider, api_key, model = None, None, None
    if resolved:
        provider, api_key, model = resolved
        model = model or _default_model(provider)
    elif settings.anthropic_api_key:
        provider, api_key, model = "anthropic", settings.anthropic_api_key, PLATFORM_DEFAULT_MODEL

    prompt = _build_prompt(feature, idea, ctx)

    # 3) No key anywhere -> tell the user to configure a model.
    if not api_key or provider not in STREAM_FNS:
        error = (
            "Please select an AI model first. Open AI Settings, add your API key, "
            "pick a model, and set it as your preferred AI source, then try again."
        )

        async def stream_no_key():
            yield f"data: {json.dumps({'error': error})}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(stream_no_key(), media_type="text/event-stream")

    # Live provider stream, run in a worker thread so blocking SDK calls
    # never hold the event loop.
    queue: "asyncio.Queue" = asyncio.Queue()
    stream_fn = STREAM_FNS[provider]

    def run():
        try:
            for chunk in stream_fn(api_key, model, prompt):
                queue.put_nowait(("chunk", chunk))
            queue.put_nowait(("done", None))
        except Exception as exc:  # noqa: BLE001 - surfaced to the client
            queue.put_nowait(("error", str(exc)))

    threading.Thread(target=run, daemon=True).start()

    async def stream_provider():
        while True:
            kind, value = await queue.get()
            if kind == "chunk":
                yield f"data: {json.dumps({'text': value})}\n\n"
            elif kind == "error":
                yield f"data: {json.dumps({'error': value})}\n\n"
                break
            else:
                break
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        stream_provider(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
