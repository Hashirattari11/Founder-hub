import { useCallback, useEffect, useMemo, useState } from 'react'
import { getErrorMessage } from '../../lib/errors'
import toast from 'react-hot-toast'
import { Loader2, RefreshCw, Save, ShieldAlert } from 'lucide-react'
import { useSession } from '../../context/AuthContext'
import { adminPutSettings, adminSettings } from '../../api/admin'
import { isSuperAdminProfile } from '../../lib/admin'
import type { SettingsMap } from '../../types/admin'
import { Badge, Card, LoadingBlock, PageHeader } from './adminUi'

export default function AdminSettings() {
  const { realProfile } = useSession()
  const superAdmin = isSuperAdminProfile(realProfile)
  const [settings, setSettings] = useState<SettingsMap>({})
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminSettings()
      setSettings(res.settings)
    } catch (err) {
      toast.error(getErrorMessage(err, 'generic'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const keys = useMemo(() => Object.keys(settings).sort(), [settings])

  const setDraft = (key: string, value: string) =>
    setDrafts((prev) => ({ ...prev, [key]: value }))

  const draftValue = (key: string) => {
    if (key in drafts) return drafts[key]
    return JSON.stringify(settings[key] ?? {}, null, 2)
  }

  const dirty = keys.filter((key) => draftValue(key) !== JSON.stringify(settings[key] ?? {}, null, 2))

  const saveAll = async () => {
    setSaving(true)
    try {
      const payload: SettingsMap = {}
      for (const key of dirty) {
        try {
          payload[key] = JSON.parse(draftValue(key))
        } catch {
          toast.error(`"${key}" is not valid JSON`)
          return
        }
      }
      if (Object.keys(payload).length === 0) {
        toast('No changes to save')
        return
      }
      await adminPutSettings(payload)
      toast.success('Settings saved')
      setDrafts({})
      await load()
    } catch (err) {
      toast.error(getErrorMessage(err, 'generic'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        description="System-wide configuration. Secrets are masked and preserved when left unchanged."
        actions={
          <>
            {!superAdmin && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-amber-500">
                <ShieldAlert className="h-3.5 w-3.5" /> Super Admin only
              </span>
            )}
            <button
              onClick={load}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:border-primary hover:text-primary dark:border-dark-300 dark:text-gray-300"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Reload
            </button>
            <button
              onClick={saveAll}
              disabled={!superAdmin || dirty.length === 0 || saving}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-brand px-4 py-2 text-xs font-semibold text-white shadow-md shadow-primary/20 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save {dirty.length > 0 ? `${dirty.length} change(s)` : ''}
            </button>
          </>
        }
      />

      {!superAdmin && (
        <Card className="mb-4 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            You can view settings but only the Super Admin can change them.
          </p>
        </Card>
      )}

      {loading ? (
        <LoadingBlock label="Loading settings..." />
      ) : (
        <div className="space-y-4">
          {keys.map((key) => (
            <Card key={key} className="p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-primary/10 px-2.5 py-1 font-mono text-xs font-semibold text-primary">
                  {key}
                </span>
                {dirty.includes(key) && <Badge tone="amber">unsaved</Badge>}
                {typeof settings[key] === 'object' && settings[key] !== null && 'value' in (settings[key] as object) && (
                  <Badge tone="gray">simple value</Badge>
                )}
              </div>
              <textarea
                value={draftValue(key)}
                onChange={(e) => setDraft(key, e.target.value)}
                rows={Math.min(8, Math.max(3, (draftValue(key).match(/\n/g)?.length ?? 0) + 2))}
                spellCheck={false}
                className="w-full resize-y rounded-xl border border-gray-200 bg-gray-50 p-3 font-mono text-xs outline-none focus:border-primary dark:border-dark-300 dark:bg-dark dark:text-white"
              />
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
