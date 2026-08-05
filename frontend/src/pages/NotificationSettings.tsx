import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Bell, Loader2, Save } from 'lucide-react'
import { AppHeader } from '../components/AppHeader'
import { useSession } from '../context/AuthContext'
import { updateProfile } from '../lib/profile'

const DEFAULT_PREFS: Record<string, boolean> = {
  email_new_match: true,
  email_new_application: true,
  email_status_update: true,
  email_messages: false,
  push_new_match: true,
  push_new_application: true,
}

const TOGGLES: { key: string; label: string; description: string }[] = [
  { key: 'email_new_match', label: 'Email me when a startup matches my profile', description: 'Get an email with an AI match score when a new startup fits your skills or sectors.' },
  { key: 'email_new_application', label: 'Email me when someone applies to my startup', description: 'Founders: know the moment a new application lands in your inbox.' },
  { key: 'email_status_update', label: 'Email me when my application status changes', description: 'Be notified when a founder shortlists, accepts or rejects your application.' },
  { key: 'email_messages', label: 'Email me for new messages', description: 'Get an email when someone messages you (default off to avoid noise).' },
  { key: 'push_new_match', label: 'Push notifications for new matches', description: 'See a badge in the bell for newly matched startups.' },
  { key: 'push_new_application', label: 'Push notifications for new applications', description: 'See a badge in the bell when someone applies to your startup.' },
]

export default function NotificationSettings() {
  const { user, profile, refreshProfile } = useSession()
  const [prefs, setPrefs] = useState<Record<string, boolean>>(DEFAULT_PREFS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!profile) return
    setPrefs({ ...DEFAULT_PREFS, ...(profile.notification_preferences ?? {}) })
    setLoading(false)
  }, [profile])

  const toggle = (key: string) => setPrefs((prev) => ({ ...prev, [key]: !prev[key] }))

  const save = async () => {
    if (!user) return
    setSaving(true)
    try {
      await updateProfile(user.id, { notification_preferences: prefs })
      await refreshProfile()
      toast.success('Notification preferences saved')
    } catch {
      toast.error('Could not save preferences')
    } finally {
      setSaving(false)
    }
  }

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

        <div className="rounded-2xl border border-gray-200 bg-white p-2 dark:border-dark-300 dark:bg-dark-100">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            TOGGLES.map(({ key, label, description }) => (
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
                  aria-checked={prefs[key]}
                  onClick={() => toggle(key)}
                  className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
                    prefs[key] ? 'bg-primary' : 'bg-gray-300 dark:bg-dark-400'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      prefs[key] ? 'translate-x-[22px]' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            ))
          )}
        </div>

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
