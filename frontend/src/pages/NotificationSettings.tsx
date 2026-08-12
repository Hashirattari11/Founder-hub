import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Bell, Loader2, Save, Mail, Smartphone } from 'lucide-react'
import { AppHeader } from '../components/AppHeader'
import {
  getNotificationPreferences,
  saveNotificationPreferences,
  type NotificationPreferences,
} from '../lib/notifications'

interface ToggleGroup {
  key: keyof NotificationPreferences
  label: string
  description: string
}

const EMAIL_TOGGLES: ToggleGroup[] = [
  { key: 'email_enabled', label: 'Enable email notifications', description: 'Master switch for all transactional email.' },
  { key: 'message_emails', label: 'Messages', description: 'New messages (batched — not one email per message).' },
  { key: 'community_emails', label: 'Community activity', description: 'Follows, comments, reposts, and batched likes.' },
  { key: 'startup_emails', label: 'Startup activity', description: 'Startup matches and founder updates relevant to you.' },
  { key: 'job_emails', label: 'Jobs', description: 'Job alerts and application updates.' },
  { key: 'meeting_emails', label: 'Meetings', description: 'Invites, confirmations, reschedules and reminders.' },
  { key: 'investor_emails', label: 'Investor activity', description: 'Investor interest, data room and funding updates.' },
  { key: 'application_emails', label: 'Applications', description: 'New applications and accept/reject updates.' },
  { key: 'data_room_emails', label: 'Data room', description: 'Access requests and document activity.' },
  { key: 'ai_report_emails', label: 'AI reports', description: 'When an AI-generated report is ready for you.' },
  { key: 'marketing', label: 'Product news', description: 'Product announcements and platform updates.' },
  { key: 'admin_alerts', label: 'Admin alerts', description: 'Security and platform alerts (admins only).' },
]

const PUSH_TOGGLES: ToggleGroup[] = [
  { key: 'push_enabled', label: 'Enable push notifications', description: 'In-app badge + mobile push for new activity.' },
]

export default function NotificationSettings() {
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getNotificationPreferences().then((p) => {
      setPrefs(p)
      setLoading(false)
    })
  }, [])

  const toggle = (key: keyof NotificationPreferences) => {
    setPrefs((prev) => (prev ? { ...prev, [key]: !prev[key] } : prev))
  }

  const save = async () => {
    if (!prefs) return
    setSaving(true)
    try {
      const saved = await saveNotificationPreferences(prefs)
      setPrefs(saved)
      toast.success('Notification preferences saved')
    } catch {
      toast.error('Could not save preferences')
    } finally {
      setSaving(false)
    }
  }

  const renderToggle = ({ key, label, description }: ToggleGroup) => (
    <div
      key={key}
      className="flex items-center justify-between gap-4 rounded-xl px-4 py-4 hover:bg-gray-50 dark:hover:bg-dark-200"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        <p className="mt-0.5 text-xs text-gray-500">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={!!prefs?.[key]}
        onClick={() => toggle(key)}
        className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
          prefs?.[key] ? 'bg-primary' : 'bg-gray-300 dark:bg-dark-400'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            prefs?.[key] ? 'translate-x-[22px]' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark">
      <AppHeader title="Notification Settings" backTo="/settings/profile" backLabel="Back to Settings" />
      <main className="mx-auto max-w-2xl px-4 pt-8 pb-24 sm:px-6 lg:pb-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Bell className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-extrabold">Notification Settings</h1>
            <p className="text-sm text-gray-500">Choose how FounderHub reaches you.</p>
          </div>
        </div>

        {loading || !prefs ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-2 dark:border-dark-300 dark:bg-dark-100">
              <div className="flex items-center gap-2 border-b border-gray-100 px-4 pb-3 pt-2 dark:border-dark-300">
                <Mail className="h-4 w-4 text-primary" />
                <p className="text-sm font-bold">Email</p>
              </div>
              {EMAIL_TOGGLES.map(renderToggle)}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-2 dark:border-dark-300 dark:bg-dark-100">
              <div className="flex items-center gap-2 border-b border-gray-100 px-4 pb-3 pt-2 dark:border-dark-300">
                <Smartphone className="h-4 w-4 text-primary" />
                <p className="text-sm font-bold">Push & In-app</p>
              </div>
              {PUSH_TOGGLES.map(renderToggle)}
            </div>
          </div>
        )}

        <button onClick={save} disabled={saving || loading} className="btn-primary mt-6 w-full disabled:opacity-60">
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Preferences
            </>
          )}
        </button>
      </main>
    </div>
  )
}
