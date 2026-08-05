import { useEffect, useRef, useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import { saveMeetingNotes } from '../../lib/meetings'

interface MeetingNotesProps {
  meetingId: string
  initialNotes?: string
}

export function MeetingNotes({ meetingId, initialNotes = '' }: MeetingNotesProps) {
  const [value, setValue] = useState(initialNotes)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const firstRun = useRef(true)

  useEffect(() => {
    if (!firstRun.current) return
    firstRun.current = false
  }, [])

  useEffect(() => {
    if (firstRun.current) return
    setSaved(false)
    setSaving(true)
    const timer = setTimeout(async () => {
      try {
        await saveMeetingNotes(meetingId, value)
        setSaved(true)
      } catch {
        setSaved(false)
      } finally {
        setSaving(false)
      }
    }, 1000)
    return () => clearTimeout(timer)
  }, [value, meetingId])

  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold">Shared meeting notes</label>
        <span className="flex items-center gap-1 text-xs text-gray-400">
          {saving ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" /> Saving…
            </>
          ) : saved ? (
            <>
              <Save className="h-3 w-3" /> Saved
            </>
          ) : null}
        </span>
      </div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={6}
        placeholder="Capture action items, decisions and follow-ups — these auto-save and are visible to both of you."
        className="mt-2 w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark"
      />
    </div>
  )
}
