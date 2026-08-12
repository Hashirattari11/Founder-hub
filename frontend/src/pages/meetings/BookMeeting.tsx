import { useCallback, useEffect, useMemo, useState } from 'react'
import { getErrorMessage } from '../../lib/errors'
import { Link, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  X,
} from 'lucide-react'
import { useSession } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { bookMeeting, getTimeSlots, toLocalDateInput, addDays } from '../../lib/meetings'
import { DAY_LABELS } from '../../types/meetings'
import { Avatar } from '../../components/Avatar'
import type { MeetingTimeSlot, ProfileBrief } from '../../types/meetings'

function startOfWeek(d: Date): Date {
  const copy = new Date(d)
  const day = copy.getDay()
  const diff = (day === 0 ? -6 : 1 - day)
  copy.setDate(copy.getDate() + diff)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export default function BookMeeting() {
  const { userId = '' } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const { user } = useSession()
  const [host, setHost] = useState<ProfileBrief | null>(null)
  const [slots, setSlots] = useState<MeetingTimeSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [weekStart, setWeekStart] = useState(() => startOfWeek(addDays(new Date(), 7)))
  const [selected, setSelected] = useState<MeetingTimeSlot | null>(null)
  const [title, setTitle] = useState('Intro meeting')
  const [description, setDescription] = useState('')
  const [booking, setBooking] = useState(false)

  useEffect(() => {
    if (!userId) return
    ;(async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, username, role, city, bio')
          .eq('id', userId)
          .single()
        setHost((data as ProfileBrief | null) ?? null)
      } catch {
        // ignore — host name is optional
      }
    })()
  }, [userId])

  const weekEnd = addDays(weekStart, 6)

  const loadSlots = useCallback(() => {
    if (!userId) return
    setLoading(true)
    getTimeSlots(userId, toLocalDateInput(weekStart), toLocalDateInput(addDays(weekStart, 6)))
      .then(({ slots }) => setSlots(slots))
      .catch(() => toast.error('Could not load availability'))
      .finally(() => setLoading(false))
  }, [userId, weekStart])

  useEffect(loadSlots, [loadSlots])

  const isOwnPage = user?.id === userId

  const openSlots = useMemo(() => {
    const map = new Map<string, MeetingTimeSlot[]>()
    for (const s of slots) {
      if (s.is_booked) continue
      const key = s.starts_at.slice(0, 10)
      const list = map.get(key) ?? []
      list.push(s)
      map.set(key, list)
    }
    return map
  }, [slots])

  const weekDays = useMemo(() => {
    const out: Date[] = []
    for (let i = 0; i < 7; i++) out.push(addDays(weekStart, i))
    return out
  }, [weekStart])

  const handleBook = async () => {
    if (!selected) return
    if (!title.trim()) {
      toast.error('Give your meeting a title')
      return
    }
    setBooking(true)
    try {
      const { meeting } = await bookMeeting({
        time_slot_id: selected.id,
        title: title.trim(),
        description,
      })
      toast.success('Meeting booked — see you there!')
      navigate('/meetings', { state: { highlight: meeting.id } })
    } catch (e) {
      toast.error(getErrorMessage(e, 'generic'))
      setBooking(false)
    }
  }

  if (isOwnPage) {
    return (
      <div className="container-x py-16 text-center">
        <CalendarDays className="mx-auto h-10 w-10 text-gray-300" />
        <h1 className="mt-4 text-xl font-bold">You can't book a meeting with yourself</h1>
        <p className="mt-2 text-gray-500">
          Share your booking link so others can schedule time with you.
        </p>
        <Link to="/settings/availability" className="btn-primary mt-6">
          Manage my availability
        </Link>
      </div>
    )
  }

  return (
    <div className="container-x py-8">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-sm text-gray-600 transition-colors hover:text-primary dark:text-gray-400"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <div className="mt-4 flex items-center gap-4">
        <Avatar src={host?.avatar_url ?? null} name={host?.full_name ?? 'Guest'} size="lg" />
        <div>
          <h1 className="text-2xl font-bold">
            Book a meeting with {host?.full_name ?? 'this member'}
          </h1>
          <p className="text-sm text-gray-500">
            {host?.role ? `${host.role.charAt(0).toUpperCase() + host.role.slice(1)} · ` : ''}
            Choose an open 30-minute slot below.
          </p>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={() => setWeekStart(addDays(weekStart, -7))}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-dark-200"
          aria-label="Previous week"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <p className="font-semibold">
          {formatDate(weekStart)} — {formatDate(weekEnd)}
        </p>
        <button
          onClick={() => setWeekStart(addDays(weekStart, 7))}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-dark-200"
          aria-label="Next week"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {weekDays.map((day) => {
            const key = toLocalDateInput(day)
            const daySlots = openSlots.get(key) ?? []
            return (
              <div
                key={key}
                className="rounded-2xl border border-gray-200 bg-white p-3 dark:border-dark-300 dark:bg-dark-100"
              >
                <p className="text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {DAY_LABELS[(day.getDay() + 6) % 7].slice(0, 3)}
                </p>
                <p className="text-center text-sm font-bold">
                  {day.getDate()} {day.toLocaleDateString('en-US', { month: 'short' })}
                </p>
                <div className="mt-2 space-y-1.5">
                  {daySlots.length === 0 ? (
                    <p className="py-4 text-center text-[11px] text-gray-400">Unavailable</p>
                  ) : (
                    daySlots.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setSelected(s)}
                        className="flex w-full items-center justify-center gap-1 rounded-lg border border-primary/40 bg-primary/5 px-2 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
                      >
                        <Clock className="h-3 w-3" />
                        {formatTime(s.starts_at)}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => !booking && setSelected(null)}
        >
          <div
            className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-gray-200 bg-white p-6 dark:border-dark-300 dark:bg-dark-100 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold">Confirm booking</h2>
                <p className="mt-0.5 text-sm text-gray-500">
                  {formatDate(new Date(selected.starts_at))} at{' '}
                  {formatTime(selected.starts_at)} · 30 min
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                aria-label="Close"
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Notes for {host?.full_name ?? 'the host'}</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="What do you want to discuss?"
                  className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark"
                />
              </div>
            </div>

            <button
              onClick={handleBook}
              disabled={booking}
              className="btn-primary mt-6 w-full disabled:opacity-60"
            >
              {booking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {booking ? 'Booking…' : 'Confirm booking'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
