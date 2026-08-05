"""Expo push notification service.

A lightweight background asyncio task that consumes a queue of push
notifications and delivers them to registered devices via the Expo push
API (https://exp.host/--/api/v2/push/send), with per-message retry and
automatic cleanup of dead tokens (e.g. app uninstalled).

Deliveries are fire-and-forget: callers enqueue a push and never block.
"""
import asyncio
import logging
import os

import httpx

from app.core.supabase import service_supabase

logger = logging.getLogger("founderhub.push")

EXPO_API = "https://exp.host/--/api/v2/push/send"
MAX_MESSAGES_PER_REQUEST = 100
MAX_ATTEMPTS = 3
RETRY_BASE_SECONDS = 2.0
ANDROID_CHANNEL_ID = "default"

_queue: asyncio.Queue = asyncio.Queue()
_attempts: dict[str, int] = {}


def _headers() -> dict[str, str]:
    headers = {"Content-Type": "application/json"}
    access_token = os.getenv("EXPO_ACCESS_TOKEN")
    if access_token:
        headers["Authorization"] = f"Bearer {access_token}"
    return headers


def _fetch_tokens(user_id: str) -> list[str]:
    if not service_supabase.available:
        return []
    try:
        rows = (
            service_supabase.table("push_tokens")
            .select("token")
            .eq("user_id", user_id)
            .execute()
        )
        return [r["token"] for r in (rows.data or []) if r.get("token")]
    except Exception as exc:  # pragma: no cover
        logger.warning("Failed to fetch push tokens for %s: %s", user_id, exc)
        return []


def _remove_token(token: str) -> None:
    try:
        service_supabase.table("push_tokens").delete().eq("token", token).execute()
    except Exception as exc:  # pragma: no cover
        logger.warning("Failed to remove dead push token: %s", exc)


def enqueue_push(
    user_id: str,
    title: str,
    body: str,
    data: dict | None = None,
    to_tokens: list[str] | None = None,
) -> int:
    """Queue a push for a user's registered devices (or explicit tokens).

    Returns the number of tokens queued. Never raises.
    """
    tokens = to_tokens if to_tokens is not None else _fetch_tokens(user_id)
    if not tokens:
        return 0
    message = {
        "to": tokens[0],
        "title": title[:180],
        "body": body[:400],
        "data": data or {},
        "sound": "default",
        "priority": "high",
    }
    queued = 0
    for token in tokens:
        message["to"] = token
        if isinstance(message.get("data"), dict):
            message["data"]["userId"] = user_id
        try:
            _queue.put_nowait(dict(message))
            queued += 1
        except Exception:  # pragma: no cover
            break
    return queued


def enqueue_bulk(pushes: list[dict]) -> int:
    """Queue several prebuilt push dicts at once."""
    queued = 0
    for push in pushes:
        try:
            _queue.put_nowait(dict(push))
            queued += 1
        except Exception:  # pragma: no cover
            break
    return queued


def _result_error(item: dict) -> str | None:
    if item.get("status") == "error":
        return (item.get("details") or {}).get("error")
    return None


async def _send_chunk(client: httpx.AsyncClient, messages: list[dict]) -> None:
    if not messages:
        return
    try:
        resp = await client.post(EXPO_API, json=messages, headers=_headers())
        resp.raise_for_status()
        body = resp.json()
        results = body.get("data", []) if isinstance(body, dict) else body
    except Exception as exc:  # pragma: no cover
        logger.warning("Expo API request failed (%s): %s", exc.__class__.__name__, exc)
        for message in messages:
            _retry_or_drop(message)
        return

    for message, result in zip(messages, results):
        error = _result_error(result)
        token = message.get("to")
        if error is None:
            continue
        if error in ("DeviceNotRegistered", "InvalidToken", "DeviceRegistrationError"):
            logger.info("Removing dead push token: %s", error)
            _remove_token(token)
        elif error == "MessageTooBig":
            message["title"] = (message.get("title") or "")[:60]
            message["body"] = (message.get("body") or "")[:120]
            _retry_or_drop(message, force=True)
        else:
            logger.warning("Push delivery error %s: %s", token, error)
            _retry_or_drop(message)


def _retry_or_drop(message: dict, force: bool = False) -> None:
    token = message.get("to")
    attempts = _attempts.get(token, 0) + 1
    if not force and attempts >= MAX_ATTEMPTS:
        logger.warning("Dropping push after %d attempts: %s", attempts, token)
        _attempts.pop(token, None)
        return
    _attempts[token] = attempts
    delay = RETRY_BASE_SECONDS * (2 ** (attempts - 1))
    asyncio.get_event_loop().call_later(delay, lambda: _queue.put_nowait(dict(message)))


async def _push_tick(client: httpx.AsyncClient) -> None:
    messages: list[dict] = []
    try:
        while len(messages) < MAX_MESSAGES_PER_REQUEST:
            message = _queue.get_nowait()
            messages.append(message)
    except asyncio.QueueEmpty:
        pass
    if messages:
        await _send_chunk(client, messages)


async def push_loop(stop_event: asyncio.Event) -> None:
    logger.info("Expo push loop started")
    async with httpx.AsyncClient(timeout=30.0) as client:
        while not stop_event.is_set():
            try:
                await _push_tick(client)
            except Exception as exc:  # pragma: no cover
                logger.warning("Push tick error: %s", exc)
            try:
                await asyncio.wait_for(stop_event.wait(), timeout=2.0)
            except asyncio.TimeoutError:
                continue
    logger.info("Expo push loop stopped")
