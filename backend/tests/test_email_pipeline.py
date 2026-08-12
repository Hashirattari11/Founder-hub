"""Email pipeline unit tests — no live Brevo calls."""
from unittest.mock import MagicMock, patch

import pytest


def test_resolve_email_provider_brevo_only():
    from app.core.email import resolve_email_provider

    with patch("app.core.email.settings") as mock_settings:
        mock_settings.brevo_api_key = "test-key"
        assert resolve_email_provider() == "brevo"

    with patch("app.core.email.settings") as mock_settings:
        mock_settings.brevo_api_key = ""
        assert resolve_email_provider() is None


def test_send_brevo_returns_message_id_on_success():
    from app.core.email import send_brevo_email

    mock_resp = MagicMock()
    mock_resp.status_code = 201
    mock_resp.json.return_value = {"messageId": "<test-msg-id@smtp-relay.mailin.fr>"}

    with patch("app.core.email.settings") as mock_settings, patch(
        "app.core.email.httpx.post", return_value=mock_resp
    ):
        mock_settings.brevo_api_key = "key"
        mock_settings.email_from_name = "FounderHub"
        mock_settings.email_from_email = "notification@founderhub.site"
        result = send_brevo_email("user@example.com", "Subject", "<p>Hi</p>")

    assert result["ok"] is True
    assert result["message_id"] == "<test-msg-id@smtp-relay.mailin.fr>"
    assert result["http_status"] == 201


def test_send_brevo_marks_failed_on_http_error():
    from app.core.email import send_brevo_email

    mock_resp = MagicMock()
    mock_resp.status_code = 401
    mock_resp.text = "unrecognised IP address"

    with patch("app.core.email.settings") as mock_settings, patch(
        "app.core.email.httpx.post", return_value=mock_resp
    ):
        mock_settings.brevo_api_key = "key"
        mock_settings.email_from_name = "FounderHub"
        mock_settings.email_from_email = "notification@founderhub.site"
        result = send_brevo_email("user@example.com", "Subject", "<p>Hi</p>")

    assert result["ok"] is False
    assert result["message_id"] is None
    assert "401" in (result["error"] or "")


def test_message_dedupe_key_stable_within_window():
    from app.services.message_email import message_dedupe_key

    k1 = message_dedupe_key("chat-1", "user-2")
    k2 = message_dedupe_key("chat-1", "user-2")
    assert k1 == k2
    assert k1.startswith("message:chat-1:user-2:")


def test_message_template_batch_subject():
    from app.services.email_templates import render_template

    single = render_template(
        "message_received",
        {"from_name": "Hashir", "user_name": "Shabana", "message_count": 1},
    )
    assert "New message from Hashir" in single["subject"]

    batch = render_template(
        "message_received",
        {"from_name": "Hashir", "user_name": "Shabana", "message_count": 10},
    )
    assert "10 new messages" in batch["subject"]


def test_enqueue_email_dedupe_blocks_duplicate():
    from app.services import email_queue_service as eqs

    with patch.object(eqs, "service_supabase") as mock_sb, patch.object(
        eqs, "_recent_row_count", return_value=1
    ), patch.object(eqs, "render_template", return_value={"subject": "S", "html": "<p>x</p>"}):
        mock_sb.available = True
        ok = eqs.enqueue_email("a@b.com", "welcome", template="welcome", data={})
    assert ok is False


def test_community_like_template():
    from app.services.email_templates import render_template

    rendered = render_template("community_likes", {"user_name": "Alex", "like_count": 12})
    assert "12 new likes" in rendered["subject"]
    assert "12" in rendered["html"]


def test_waitlist_admin_template():
    from app.services.email_templates import render_template

    rendered = render_template(
        "waitlist_admin",
        {"email": "founder@startup.com", "country": "Pakistan", "city": "Karachi"},
    )
    assert "waitlist" in rendered["subject"].lower()
    assert "founder@startup.com" in rendered["html"]
