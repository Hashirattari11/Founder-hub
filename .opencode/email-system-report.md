# FounderHub — Master Email Notification System Report

**Date:** 2026-08-12  
**Status:** ✅ Implemented & partially verified  
**Provider:** Brevo (only)  
**Production sender (code default):** `notification@founderhub.site` (FounderHub)

---

## 1. What Was Broken

| Issue | Root cause |
|-------|------------|
| UI / logs could show "sent" without inbox delivery | Rows marked `sent` when Brevo **accepts** the API request; inbox delivery requires webhook `delivered` event |
| Resend fallback masked Brevo failures | `resolve_email_provider()` preferred Resend in `auto` mode; failures could route to a different provider silently |
| Message emails flooded inboxes | `chat.py` used per-message dedupe keys → one email per message |
| Community events had no email | Frontend used Supabase RPC bell only (`notifyUser`) — no backend email pipeline |
| Waitlist had no admin/confirmation email | `WaitlistModal` inserted directly to Supabase with no backend event |
| Startup publish emailed all users | `_broadcast_startup_published` emailed every profile |
| Application emails used generic `broadcast` template | `applications.py` did not use a dedicated application template |
| Sender inconsistency | Code/env mixed `notifications@` vs `notification@founderhub.site` |
| Brevo IP whitelist (historical) | HTTP 401 `unrecognised IP address` when Authorized IPs enabled in Brevo dashboard |

---

## 2. Architecture (after fix)

```
Platform event (API action)
    ↓
notification_service.notify()
    ├─ bell notification (create_notification RPC)
    ├─ preference check (category + email_enabled)
    └─ email_queue_service.enqueue_email()
           ├─ dedupe_key (SHA256 or explicit)
           ├─ optional send_delay_seconds (message batching)
           ├─ insert email_queue (queued)
           └─ background send → Brevo API v3
                  ├─ HTTP 201 + messageId → status sent + email_logs
                  └─ failure → retry ×3 → failed
    ↓
POST /api/webhooks/brevo (HMAC verified)
    └─ message_id → delivered / opened / clicked / bounced / blocked
```

**Central services:**
- Transport: `backend/app/core/email.py` — Brevo only
- Queue: `backend/app/services/email_queue_service.py`
- Events: `backend/app/services/notification_service.py`
- Templates: `backend/app/services/email_templates.py`
- Message batching: `backend/app/services/message_email.py`
- Community/waitlist API: `backend/app/api/community_notifications.py`

---

## 3. Files Changed

### Backend
- `backend/app/core/config.py` — default sender `notification@founderhub.site`, provider `brevo`
- `backend/app/core/email.py` — Brevo-only transport (Resend fallback removed)
- `backend/app/services/email_queue_service.py` — delayed send, message count refresh, new template mappings
- `backend/app/services/email_templates.py` — community, waitlist, application, AI report templates; FounderHub branding
- `backend/app/services/notification_service.py` — expanded preferences + categories + `send_delay_seconds`
- `backend/app/services/message_email.py` — **new** message batching helper
- `backend/app/api/community_notifications.py` — **new** follow/comment/repost/likes/mention/waitlist endpoints
- `backend/app/api/chat.py` — batched message notify (3 min delay, 15 min dedupe window)
- `backend/app/api/notifications.py` — batched messages; startup broadcast bell-only (no mass email)
- `backend/app/api/applications.py` — `application_received` template
- `backend/app/api/notification_center.py` — expanded preference keys
- `backend/app/main.py` — register community router
- `backend/tests/test_email_pipeline.py` — **new** unit tests (8 passing)
- `backend/pytest.ini` — **new**

### Frontend
- `frontend/src/lib/communityNotify.ts` — **new** backend email triggers for community + waitlist
- `frontend/src/lib/follows.ts` — follow → backend email
- `frontend/src/components/feed/PostCard.tsx` — comment/repost/likes → backend email
- `frontend/src/components/WaitlistModal.tsx` — waitlist signup → backend email
- `frontend/src/lib/notifications.ts` — expanded preference types
- `frontend/src/pages/NotificationSettings.tsx` — full preference UI

---

## 4. Email Events

| Category | Event | Template | Trigger |
|----------|-------|----------|---------|
| Auth | welcome, verify_email, password_reset, password_reset_success | ✅ | Supabase/auth flows via notify |
| Messages | message_received (batched) | ✅ | `POST /api/messages/{id}/send`, `/api/notify/message` |
| Startup | startup_match, startup_new (bell), startup_approved | ✅ | matching + publish |
| Applications | application_received, accepted/rejected/shortlisted | ✅ | applications API |
| Jobs | job_application, status | ✅ | job_notifications API |
| Meetings | invite/reminder/cancelled/rescheduled/accepted | ✅ | meetings API |
| Investor | investor_interested, investor_match, data room | ✅ | investor/data_room APIs |
| Community | community_follow/comment/repost/likes/mention | ✅ **new** | `/api/notify/community/*` |
| Admin | role_request/approved/rejected, admin_alert, waitlist_admin | ✅ | admin + waitlist |
| Waitlist | waitlist_confirmation | ✅ **new** | `/api/notify/waitlist-signup` |
| AI | ai_report_ready | ✅ template | ⚠️ wire to AI report completion endpoint |
| Co-founder | cofounder_request/accepted | ✅ | cofounder API |

---

## 5. Brevo Integration Status

| Check | Result |
|-------|--------|
| Brevo API configured | ✅ `BREVO_API_KEY` present locally |
| Brevo-only transport | ✅ Resend fallback removed from send path |
| Real API acceptance test | ✅ HTTP **201**, messageId `<202608122301.72579235174@smtp-relay.mailin.fr>` |
| Sender in live test | ⚠️ Env override sent from `notifications@founderhub.site` — update `EMAIL_FROM_EMAIL=notification@founderhub.site` on Vercel + local `.env` |
| Webhook endpoint | ✅ `POST /api/webhooks/brevo` with HMAC verification |
| Webhook registered in Brevo dashboard | ⚠️ UNVERIFIED — must be configured manually |
| Authorized IPs disabled | ⚠️ UNVERIFIED — disable at https://app.brevo.com/security/authorised_ips for Vercel |

---

## 6. Message Batching

- **Delay:** 180 seconds before send (collapses bursts)
- **Dedupe window:** 900 seconds (one email per chat per window)
- **Count refresh:** At send time, recounts messages in window → subject/body shows "You have N new messages from {name}"
- **Deep link:** `/messages?user={sender_id}`

---

## 7. Duplicate Prevention

- Default: SHA256(`to|template|json_data`) within 600s window
- Explicit keys per event: e.g. `follow:{actor}:{receiver}`, `likes:{post}:{receiver}:{hour_bucket}`
- Message keys: `message:{chat_id}:{receiver_id}:{15min_bucket}`

---

## 8. Retry Behavior

- `max_attempts = 3`
- Failed rows → `failed` status with `error`, `http_status`, `last_error_at`
- Admin retry: `POST /api/admin/email-queue/retry`
- **Never** marks `sent` unless Brevo returns success (HTTP 2xx + acceptance)

---

## 9. Notification Preferences

| Key | Controls |
|-----|----------|
| `email_enabled` | Master switch |
| `message_emails` | Messages |
| `community_emails` | Follow, comment, repost, likes batch |
| `startup_emails` | Startup matches |
| `job_emails` | Job alerts/applications |
| `meeting_emails` | Meetings |
| `investor_emails` | Investor activity |
| `application_emails` | Applications |
| `data_room_emails` | Data room |
| `ai_report_emails` | AI reports |
| `marketing` | Product news |
| `admin_alerts` | Admin alerts |

**Always emailed (transactional):** password_reset, verify_email, welcome, role_approved/rejected, admin_alert

UI: `/settings/notifications`

---

## 10. Tests Performed

| Test | Result |
|------|--------|
| `pytest tests/test_email_pipeline.py` | ✅ 8 passed |
| `python -c "from app.main import app"` | ✅ import ok |
| Brevo live send (local) | ✅ HTTP 201 + real messageId |
| Frontend build | ⚠️ UNVERIFIED (slow build environment) |
| Inbox delivery confirmation | ⚠️ UNVERIFIED — check recipient inbox + Brevo dashboard |
| Webhook delivery status update | ⚠️ UNVERIFIED — requires Brevo webhook registration |

---

## 11. Remaining Issues / Action Required

1. **Set production sender:** Update Vercel env `EMAIL_FROM_EMAIL=notification@founderhub.site` (user spec). Currently env may still use `notifications@founderhub.site`.
2. **Brevo Authorized IPs:** Disable IP whitelist so Vercel/serverless can send.
3. **Brevo webhook:** Register `https://founder-hub-0.vercel.app/api/webhooks/brevo` for delivered/opened/bounced events.
4. **Wire AI report ready:** Call `notify(..., template="ai_report_ready")` when AI Studio report completes.
5. **Deploy:** Push changes + redeploy backend and frontend.
6. **Rotate Brevo key:** User exposed API key in chat history — rotate after setup.
7. **Legacy `email_service.py`:** Still contains direct `send_email()` helpers — migrate remaining callers to `notify()` + queue (low priority; not on hot path).

---

## 12. Messaging System (parallel fix)

Previous session fixes retained:
- `resolveChatPartner()` / UUID-based recipient lookup
- ErrorBoundary soft reset on chat panel
- Realtime + poll fallback for messages
- Invalid date guards in chat list

⚠️ Production verification after deploy: hard refresh (`Ctrl+Shift+R`), test User A → User B messaging end-to-end.

---

## 13. Completion Criteria

| Requirement | Status |
|-------------|--------|
| Brevo API connected | ✅ Verified locally (201 + messageId) |
| `notification@founderhub.site` production sender | ⚠️ Code default set; env override pending |
| Important events trigger emails | ✅ Wired (community new in this pass) |
| Logs reflect provider responses | ✅ email_queue + email_logs |
| Failed emails marked failed | ✅ |
| Duplicate prevention | ✅ |
| User preferences | ✅ Expanded |
| Automated tests | ✅ 8 unit tests |
| Real email test | ✅ API acceptance verified; inbox ⚠️ UNVERIFIED |

**Do not mark FULLY COMPLETE until:** Vercel env updated, deploy done, inbox delivery confirmed, webhook registered.
