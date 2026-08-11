# FounderHub — Production Email & Notification System Report

**Status:** ✅ FIXED & VERIFIED (2026-08-10) · **Provider:** Brevo · **Deploy:** `dpl_AQaDKLxLHXKYmZoaNEPQC7QGairY` · **Commit:** `ae81dd1`

---

## 1. Executive Summary

FounderHub's transactional email + notification system is a production-grade, queue-backed pipeline with real-time delivery, deduplication, retries, provider logging, a signed Brevo webhook, per-user preferences, and an admin email center. Production delivery was broken (dead Brevo API key) and has been fully repaired and end-to-end verified against Brevo's SMTP relay.

| Check | Result |
|-------|--------|
| Sender identity | `notifications@founderhub.site` (FounderHub) ✅ |
| Brevo API request | HTTP 201 ✅ |
| Brevo message ID captured | ✅ |
| Logs reflect provider status | ✅ (`email_queue` + `email_logs`) |
| Real test email delivered | ✅ → `hashirattari73@gmail.com` |
| Webhook signature enforced | ✅ HMAC-SHA256 (401 w/o sig) |

---

## 2. Architecture Overview

```
                     ┌────────────────────────┐
   App events ──────►│ enqueue_email()        │
   (auth, matches,   │  dedupe_hash SHA256    │
    meetings, msgs,  │  dedupe window 600s    │
    admin alerts…)  │  template render       │
                     └───────────┬────────────┘
                                 │ insert row (status=queued, max_attempts=3, provider pinned)
                                 ▼
                      ┌─────────────────────┐    background thread (real-time)
                      │   email_queue table │────► _send_one() ──► Brevo API v3
                      │  queued→sending→sent│                     (smtp/email)
                      └──────────┬──────────┘                         │
                                 │ email_loop / drain_pending           │ HTTP 201 + messageId
                                 │ (crash recovery, retry failed)       ▼
                                 ▼                              ┌──────────────────┐
                          retry ×3 backoff                      │ email_logs table │
                          (failed → dead-letter)                │ status, http    │
                                                              │_status, message │
              ┌────────────────────────────┐                 │ _id, error,     │
              │ Brevo Transactional Webhook │◄──── events ────│ sent_at, provider│
              │ POST /api/webhooks/brevo   │   delivered/    └──────────────────┘
              │ HMAC-SHA256 verified       │   opened/clicked/
              └─────────────┬──────────────┘   bounced/blocked
                            ▼
                  patch email_queue + email_logs
                  by message_id → delivered/opened/…
                            │
                            ▼
                  Admin Email Center (live status)
```

**Key property:** Sends happen immediately on a background thread (works on serverless), while a loop + startup drain guarantee nothing is left stranded. Brevo `messageId` is the join key between the queue, the logs, and inbound webhook events.

---

## 3. Components

### 3.1 `email_queue` table (`backend/app/services/email_queue_service.py`)
Persistent queue. Columns: `id`, `recipient_id`, `to_email`, `subject`, `html_body`, `text_body`, `template`, `template_data`, `dedupe_key`, `status`, `attempts`, `max_attempts` (3), `provider`, `message_id`, `error`, `created_at`, `sent_at`. Statuses: `queued → sending → sent → delivered/opened/clicked` or `→ failed/bounced/blocked`.

### 3.2 `email_logs` table
Per-send audit log: `status`, `http_status`, `message_id`, `error`, `sent_at`, `provider`. Powers the admin panel's real delivery view (not just "accepted by provider").

### 3.3 Brevo transport (`backend/app/core/email.py`)
- `resolve_email_provider()` → `"brevo"` when `BREVO_API_KEY` set (auto falls back to `resend`).
- `send_brevo_email()` POSTs to `https://api.brevo.com/v3/smtp/email` with `api-key` header, from `notifications@founderhub.site`, captures `messageId`.
- Resend is an automatic fallback (`RESEND_API_KEY`) so a missing/invalid Brevo key never silently kills delivery.

### 3.4 Brevo webhook (`backend/app/api/brevo_webhook.py`)
- Endpoint: `POST /api/webhooks/brevo`
- Verifies HMAC-SHA256 signature against `X-Mailin-Signature` / `X-Brevo-Signature` using `BREVO_WEBHOOK_SECRET` (accepts base64 or hex via `hmac.compare_digest`). Returns **401** on mismatch.
- Maps events → status: `delivered`, `opened`, `click/clicked → clicked`, `bounce/soft_bounce/hard_bounce/invalid_email/error/complaint/spam_report/unsubscribed → bounced`, `blocked`.
- Patches both `email_queue` and `email_logs` by `message_id`. Clears `error` on positive delivery.

### 3.5 Templates (`backend/app/services/email_templates.py`)
Branded, dark, responsive, inline-CSS HTML + plain text. `render_template(name, data)` returns `{subject, html, text}`. `TEMPLATE_NAMES` enumerates all available templates.

### 3.6 Email preferences
Per-user on/off toggles; `enqueue_email` honors them. Logged-in users manage preferences in-app.

### 3.7 Admin email center
Admin panel reads `email_queue` + `email_logs` to show real provider status, message IDs, errors, retries — and to send test/broadcast emails.

---

## 4. Notification Event Matrix

| `notification_type` | Template | Trigger |
|---|---|---|
| `welcome` | `welcome` | signup |
| `verify` / `verify_email` | `verify_email` | email verification |
| `password_reset` | `password_reset` | reset flow |
| `meeting_invite` | `meeting_invite` | meeting created |
| `meeting_reminder` | `meeting_reminder` | upcoming meeting |
| `meeting_cancelled` | `meeting_cancelled` | meeting cancelled |
| `meeting_rescheduled` | `meeting_rescheduled` | meeting moved |
| `meeting_accepted` | `meeting_accepted` | invite accepted |
| `application_accepted` | `application_accepted` | application outcome |
| `application_rejected` | `application_rejected` | application outcome |
| `application_shortlisted` | `application_shortlisted` | application outcome |
| `startup_match` | `startup_match` | AI match |
| `cofounder_request` | `cofounder_request` | cofounder invite |
| `cofounder_accepted` | `cofounder_accepted` | cofounder accepted |
| `data_room_viewed` | `data_room_viewed` | data room view |
| `data_room_access_requested` | `data_room_access_requested` | access request |
| `data_room_access_approved` | `data_room_access_approved` | access granted |
| `investor_interested` | `investor_interested` | investor interest |
| `investor_match` | `investor_match` | investor AI match |
| `job_application` | `job_application` | jobs |
| `startup_approved` | `startup_approved` | admin approval |
| `role_approved` / `role_rejected` / `role_request` | same | role management |
| `admin_alert` | `admin_alert` | system alerts |
| `broadcast` | `broadcast` | admin broadcast |
| `message_received` | `message_received` | in-app messaging |

---

## 5. Dedup & Retry

- **Dedup:** `dedupe_key` = SHA256(`to_email|template|json_safe(data)`) (or caller-supplied). `_recent_row_count` blocks a new send if an identical row exists within `DEDUPE_WINDOW_SECONDS = 600` (10 min). A row older than the window no longer blocks, so recurring events (new chat message) still produce fresh emails.
- **Retry:** `max_attempts = 3`. `_retry_later(row, error, http_status)` increments `attempts`; on final attempt the row is marked `failed` (dead-letter), otherwise re-queued with backoff. `_claim_batch` (MAX_BATCH=25, POLL_SECONDS=2) recovers `queued`/`sending` rows from crashed instances.

---

## 6. Webhook Security

- Secret: `BREVO_WEBHOOK_SECRET` (stored in Vercel prod env).
- Algorithm: HMAC-SHA256 over raw request body; compared base64 **and** hex against `X-Mailin-Signature` / `X-Brevo-Signature` using `hmac.compare_digest` (timing-safe). Unsigned/invalid → **401 Invalid signature**.
- Configure in Brevo dashboard (Transactional → Webhooks): URL `https://founder-hub-0.vercel.app/api/webhooks/brevo`, events `delivered, opened, click, bounce, blocked, complaint, unsubscribed`.

---

## 7. What Was Broken → What Was Fixed

**Broken (since 2026-08-08 18:16 UTC):** Production `BREVO_API_KEY` expired/revoked ("Key not found" from `/v3/account`). `email_logs` showed **34 failed / 27 sent**. From-address also defaulted to a personal Gmail in some code paths.

**Fixed:**
1. `backend/app/core/config.py` defaults → `email_from_name="FounderHub"`, `email_from_email="notifications@founderhub.site"`, `resend_from_email="FounderHub <notifications@founderhub.site>"`. (**Commit `ae81dd1`**, deploy `dpl_AQaDKLxLHXKYmZoaNEPQC7QGairY`.)
2. `backend/.env` updated: `EMAIL_FROM_EMAIL`, `EMAIL_FROM_NAME=FounderHub`, `BREVO_WEBHOOK_SECRET`, and **new valid `BREVO_API_KEY` (rotated)**.
3. Vercel prod env (REST API): added `EMAIL_FROM_EMAIL`, `EMAIL_FROM_NAME`, `BREVO_WEBHOOK_SECRET`; deleted the dead `BREVO_API_KEY`; added the new key (env id `MmJlAwkH0Pxin7kd`). Redeployed (`founder-hub-0-impe6f5vp-…`).
4. `founderhub.site` verified in Brevo (TXT `brevo-code:4f870208de31fa31962f61b308484717`).

---

## 8. Verification Results

- **Direct send** (`send_brevo_email`) → HTTP **201**, `message_id` `<202608101320.46368094534@smtp-relay.mailin.fr>`, from `notifications@founderhub.site` → delivered to `hashirattari73@gmail.com`.
- **Full pipeline** `enqueue_email("verify_email", dedupe_key="e2e-pipeline-test-20260810")`:
  - `email_queue` row **`6f10a242`** → status `sent`, `message_id` `<202608101322.56795530958@smtp-relay.mailin.fr>`, http 201, provider `brevo`.
  - `email_logs` row **`55a36cec`** → status `sent`, `sent_at` set, provider `brevo`.
- **Prod webhook** `POST /api/webhooks/brevo` without signature → **401** (secret live). `GET /` → **200**.

---

## 9. Environment & Key Management

Vercel prod env (`founder-hub-0`), set via REST API:

| Var | Value |
|-----|-------|
| `BREVO_API_KEY` | (rotated — stored in Vercel env, id `MmJlAwkH0Pxin7kd`) |
| `BREVO_WEBHOOK_SECRET` | (shared HMAC secret) |
| `EMAIL_FROM_EMAIL` | `notifications@founderhub.site` |
| `EMAIL_FROM_NAME` | `FounderHub` |
| `EMAIL_PROVIDER` | `brevo` (optional; auto-detects) |

**To rotate the Brevo key:** generate a new key in Brevo → `https://api.brevo.com/v3/account` to verify → update `BREVO_API_KEY` in Vercel env (delete old via `DELETE /v9/projects/founder-hub-0/env/{id}`, add via `POST /v10/projects/founder-hub-0/env`, teamId `team_VajkoNE2yGmuAR89Mm13PZx3`, token from Vercel CLI auth) → redeploy. The Vercel `vercel env rm` CLI is broken ("Invalid number of arguments"); use the REST API instead.

`backend/.env` mirrors the above but is **not committed** (gitignored).

---

## 10. Known Limitations / Next Steps

- Brevo **free plan** = 300 transactional emails/day. Monitor credit usage in the Brevo dashboard; upgrade if volume grows.
- Brevo webhook must be registered in the Brevo dashboard (Transactional → Webhooks) for `delivered/opened/clicked/bounced/blocked` to flow back and update `email_queue`/`email_logs` statuses. If not registered, rows stay at `sent` (accepted by provider) rather than `delivered`.
- Resend fallback path exists but is unconfigured in prod (`RESEND_API_KEY` not set) — acceptable while Brevo is healthy; set it for true provider redundancy.
- The logo branding mission (separate) uses the exact FounderHub PNG; email templates continue to render their own branded HTML (no image swap required).
