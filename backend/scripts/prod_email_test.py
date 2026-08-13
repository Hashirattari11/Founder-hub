"""Production email test — queue + drain on deployed Vercel backend."""
import json
import os
import sys
import time
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from dotenv import load_dotenv

load_dotenv()

import httpx
from supabase import create_client

PROD = "https://founder-hub-0.vercel.app"
RECIPIENT = (sys.argv[1] if len(sys.argv) > 1 else "hashirattari73@gmail.com").strip()


def main() -> int:
    supabase_url = os.getenv("SUPABASE_URL", "").strip()
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    cron_secret = (os.getenv("CRON_SECRET") or os.getenv("BREVO_WEBHOOK_SECRET") or "").strip()
    brevo_key = os.getenv("BREVO_API_KEY", "").strip()
    dedupe_key = f"prod-email-test-{uuid.uuid4().hex[:12]}"

    print("=== Production Email Test (queue + drain) ===")
    print(f"target: {PROD}")
    print(f"recipient: {RECIPIENT}")
    print(f"dedupe_key: {dedupe_key}")
    print(f"brevo_key_set (local): {bool(brevo_key)}")
    print(f"cron_secret_set (local): {bool(cron_secret)}")
    print(f"email_from_email (local env): {os.getenv('EMAIL_FROM_EMAIL', '(default)')}")
    print(f"email_from_name (local env): {os.getenv('EMAIL_FROM_NAME', '(default)')}")

    health = httpx.get(f"{PROD}/health", timeout=30.0)
    print(f"health: {health.status_code} {health.text[:120]}")

    if not supabase_url or not service_key:
        print("ERROR: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing")
        return 1

    svc = create_client(supabase_url, service_key)
    payload = {
        "to_email": RECIPIENT,
        "subject": "[Production Test] FounderHub Brevo verification",
        "html_body": (
            '<div style="font-family:sans-serif;max-width:480px;padding:24px;">'
            '<h2 style="color:#7C3AED;">FounderHub</h2>'
            "<p>Production email test after Brevo IP restriction was disabled.</p>"
            '<p style="color:#6b7280;font-size:13px;">Sent from deployed Vercel backend.</p>'
            "</div>"
        ),
        "text_body": "Production email test after Brevo IP restriction was disabled.",
        "template": "welcome",
        "template_data": {"user_name": "there", "action_url": f"{PROD}/login"},
        "dedupe_key": dedupe_key,
        "status": "queued",
        "attempts": 0,
        "max_attempts": 3,
        "provider": "brevo",
    }
    inserted = svc.table("email_queue").insert(payload).execute()
    row_id = (inserted.data or [{}])[0].get("id")
    print(f"queued_row_id: {row_id}")

    headers = {}
    if cron_secret:
        headers["Authorization"] = f"Bearer {cron_secret}"
    drain = httpx.get(f"{PROD}/api/cron/drain-emails", headers=headers, timeout=90.0)
    print(f"drain_status: {drain.status_code}")
    print(f"drain_body: {drain.text[:300]}")

    time.sleep(2)
    q = svc.table("email_queue").select("*").eq("dedupe_key", dedupe_key).limit(1).execute()
    queue_row = (q.data or [{}])[0]
    print("queue_result:", json.dumps(
        {
            "status": queue_row.get("status"),
            "http_status": queue_row.get("http_status"),
            "message_id": queue_row.get("message_id"),
            "error": (queue_row.get("error") or "")[:200],
            "provider": queue_row.get("provider"),
        },
        indent=2,
    ))

    logs = (
        svc.table("email_logs")
        .select("recipient_email,status,provider,message_id,http_status,error,subject,created_at")
        .eq("recipient_email", RECIPIENT)
        .order("created_at", desc=True)
        .limit(3)
        .execute()
    )
    print("recent_email_logs:", json.dumps(logs.data or [], indent=2, default=str)[:1500])

    message_id = queue_row.get("message_id")
    if brevo_key and message_id:
        brevo_resp = httpx.get(
            f"https://api.brevo.com/v3/smtp/emails/{message_id}",
            headers={"api-key": brevo_key, "Accept": "application/json"},
            timeout=30.0,
        )
        print(f"brevo_message_lookup_status: {brevo_resp.status_code}")
        print(f"brevo_message_lookup_body: {brevo_resp.text[:800]}")

    ok = queue_row.get("status") == "sent" and queue_row.get("http_status") == 201
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
