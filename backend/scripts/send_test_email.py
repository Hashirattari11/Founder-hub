"""Send one live Brevo test email. Usage: python scripts/send_test_email.py [recipient]"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from dotenv import load_dotenv

load_dotenv()

from app.core.config import settings
from app.core.email import send_brevo_email
from app.services.email_templates import render_template

recipient = (sys.argv[1] if len(sys.argv) > 1 else "hashirattari73@gmail.com").strip()
rendered = render_template(
    "welcome",
    {"user_name": "there", "action_url": settings.frontend_url_for("/login")},
)
result = send_brevo_email(recipient, f"[Test] {rendered['subject']}", rendered["html"])

print(f"recipient: {recipient}")
print(f"from: {settings.email_from_name} <{settings.email_from_email}>")
print(f"ok: {result['ok']}")
print(f"http_status: {result.get('http_status')}")
print(f"message_id: {result.get('message_id')}")
if not result["ok"]:
    print(f"error: {(result.get('error') or '')[:300]}")
    sys.exit(1)
