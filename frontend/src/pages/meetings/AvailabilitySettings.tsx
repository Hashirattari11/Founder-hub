import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import { ArrowLeft, CalendarClock, Loader2, Plus, Trash2 } from 'lucide-react'
import { useSession } from '../../context/AuthContext'
import { getAvailability, saveAvailability } from '../../lib/meetings'
import type { SlotInput } from '../../lib/meetings'
import { DAY_LABELS } from '../../types/meetings'

interface DaySlots {
  day: number
  ranges: { start: string; end: string }[]
}

export default function AvailabilitySettings() {
  const { user, profile } = useSession()
  const [days, setDays] = useState<DaySlots[]>(() =>
    DAY_LABELS.map((_, day) => ({ day, ranges: [] })),
  )
  const [timezone, setTimezone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
  )
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user?.id) return
    getAvailability(user.id)
      .then(({ slots }) => {
        setDays((prev) => {
          const next: DaySlots[] = prev.map((d) => ({
            ...d,
            ranges: [] as { start: string; end: string }[],
          }))
          for (const slot of slots) {
            const target = next.find((d) => d.day === slot.day_of_week)
            if (target) {
              target.ranges.push({
                start: slot.start_time.slice(0, 5),
                end: slot.end_time.slice(0, 5),
              })
            }
          }
          return next
        })
        if (slots[0]?.timezone) setTimezone(slots[0].timezone)
      })
      .catch(() => toast.error('Could not load your availability'))
      .finally(() => setLoading(false))
  }, [user?.id])

  const activeDays = useMemo(() => days.filter((d) => d.ranges.length > 0), [days])

  const addRange = (day: number) => {
    setDays((prev) =>
      prev.map((d) =>
        d.day === day
          ? { ...d, ranges: [...d.ranges, { start: '09:00', end: '10:00' }] }
          : d,
      ),
    )
  }

  const updateRange = (day: number, index: number, key: 'start' | 'end', value: string) => {
    setDays((prev) =>
      prev.map((d) =>
        d.day === day
          ? {
              ...d,
              ranges: d.ranges.map((r, i) => (i === index ? { ...r, [key]: value } : r)),
            }
          : d,
      ),
    )
  }

  const removeRange = (day: number, index: number) => {
    setDays((prev) =>
      prev.map((d) => (d.day === day ? { ...d, ranges: d.ranges.filter((_, i) => i !== index) } : d)),
    )
  }

  const handleSave = async () => {
    if (!user?.id) return
    const slots: SlotInput[] = []
    for (const d of days) {
      for (const r of d.ranges) {
        if (!r.start || !r.end || r.end <= r.start) {
          toast.error(`Fix the time range for ${DAY_LABELS[d.day]}`)
          return
        }
        slots.push({ day_of_week: d.day, start_time: `${r.start}:00`, end_time: `${r.end}:00`, timezone })
      }
    }
    setSaving(true)
    try {
      const res = await saveAvailability(slots)
      toast.success(
        res.saved > 0
          ? `Saved ${res.saved} availability slot${res.saved === 1 ? '' : 's'}`
          : 'Availability cleared — no booking slots set',
      )
    } catch {
      toast.error('Could not save availability')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="container-x py-8">
      <Link
        to="/settings/profile"
        className="inline-flex items-center gap-2 text-sm text-gray-600 transition-colors hover:text-primary dark:text-gray-400"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Settings
      </Link>

      <div className="mt-4 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <CalendarClock className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-bold">My Availability</h1>
          <p className="text-sm text-gray-500">
            The weekly hours people can book meetings with you.
          </p>
        </div>
      </div>

      <div className="mt-6 max-w-3xl rounded-2xl border border-gray-200 bg-white p-6 dark:border-dark-300 dark:bg-dark-100">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Weekly schedule</p>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                {activeDays.length} active day{activeDays.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="mt-2 text-sm text-gray-500">
              Timezone:{' '}
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm outline-none focus:border-primary dark:border-dark-300 dark:bg-dark"
              >
                <option value="UTC">UTC</option>
                {Intl.supportedValuesOf?.('timeZone')?.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-6 space-y-4">
              {days.map((d) => (
                <div
                  key={d.day}
                  className={`rounded-xl border p-4 transition-colors ${
                    d.ranges.length > 0
                      ? 'border-primary/30 bg-primary/5'
                      : 'border-gray-200 dark:border-dark-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{DAY_LABELS[d.day]}</p>
                    <button
                      onClick={() => addRange(d.day)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add range
                    </button>
                  </div>

                  {d.ranges.length === 0 ? (
                    <p className="mt-2 text-xs text-gray-400">
                      Not available — no bookable hours.
                    </p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {d.ranges.map((r, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <input
                            type="time"
                            value={r.start}
                            onChange={(e) => updateRange(d.day, i, 'start', e.target.value)}
                            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-dark-300 dark:bg-dark"
                          />
                          <span className="text-gray-400">to</span>
                          <input
                            type="time"
                            value={r.end}
                            onChange={(e) => updateRange(d.day, i, 'end', e.target.value)}
                            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-dark-300 dark:bg-dark"
                          />
                          <button
                            onClick={() => removeRange(d.day, i)}
                            aria-label="Remove range"
                            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-xl bg-gray-50 p-4 text-sm text-gray-600 dark:bg-dark-200 dark:text-gray-400">
              <p className="font-semibold text-gray-800 dark:text-gray-200">How it works</p>
              <p className="mt-1">
                Each range generates 30-minute bookable slots. Your public booking page is{' '}
                <Link to={`/book-meeting/${user?.id}`} className="text-primary hover:underline">
                  {`${window.location.origin}/book-meeting/${user?.id}`}
                </Link>
              </p>
            </div>

            <button onClick={handleSave} disabled={saving} className="btn-primary mt-6 disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? 'Saving…' : 'Save Availability'}
            </button>

            {profile && (
              <p className="mt-3 text-xs text-gray-400">
                This is the profile linked to your booking link: {profile.full_name ?? user?.email}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
