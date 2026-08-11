import { test, expect } from '@playwright/test'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { markUnverified } from '../helpers'

/**
 * Email pipeline inspection.
 *
 * We do NOT claim delivery because the UI says "Email sent". Instead we assert
 * the actual pipeline contract exists in the backend source (application event
 * -> notification_service.notify() -> email_queue_service.enqueue_email() ->
 * Brevo send with message_id -> Brevo webhook delivery states), then mark real
 * inbox delivery UNVERIFIED.
 */
test.describe('Email pipeline (inspection, not delivery claims)', () => {
  const backendRoot = resolve(process.cwd(), '../backend')

  test('pipeline contract: notify -> email queue -> Brevo send -> webhook delivery states', () => {
    const queueFile = resolve(backendRoot, 'app/services/email_queue_service.py')
    const notifyFile = resolve(backendRoot, 'app/services/notification_service.py')
    const webhookFile = resolve(backendRoot, 'app/api/brevo_webhook.py')
    const adminFile = resolve(backendRoot, 'app/api/admin.py')

    for (const f of [queueFile, notifyFile, webhookFile, adminFile]) {
      expect(existsSync(f), `${f} must exist`).toBeTruthy()
    }

    const queue = readFileSync(queueFile, 'utf8')
    const notify = readFileSync(notifyFile, 'utf8')
    const webhook = readFileSync(webhookFile, 'utf8')
    const admin = readFileSync(adminFile, 'utf8')

    // Application event -> notification_service.notify() exists.
    expect(notify).toContain('def notify(')
    expect(admin).toContain('template="role_approved"')
    expect(admin).toContain('template="role_rejected"')

    // Queue persists rows with a status lifecycle queued -> sending -> sent.
    expect(queue).toContain('"status": "queued"')
    expect(queue).toContain('"status": "sending"')
    expect(queue).toContain('"status": "sent" if ok else "failed"')

    // Brevo message id is stored so webhook events map back to the row.
    expect(queue).toContain('message_id')

    // Webhook maps provider events to delivery states.
    expect(webhook).toContain('"delivered": "delivered"')
    expect(webhook).toContain('"bounced"')
    expect(webhook).toContain('message_id')
  })

  test('real inbox delivery', async ({}, testInfo) => {
    markUnverified(
      testInfo,
      'Actual inbox delivery requires a live Brevo API key + a controlled test recipient inbox. The pipeline contract above verifies the chain exists (event -> queue -> Brevo -> webhook states delivered/opened/clicked/failed/bounced/blocked). Until a controlled delivery run is executed, DO NOT treat "Email sent" UI messages as proof of delivery.',
    )
    test.skip()
  })
})
