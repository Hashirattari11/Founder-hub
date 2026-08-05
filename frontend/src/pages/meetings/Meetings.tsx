import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Calendar as CalendarIcon,
  Video,
  X,
  Loader2,
  CheckCircle2,
  Ban,
  Copy,
  Check,
  Plus,
  Clock,
  Search,
  Link2,
} from 'lucide-react'
import { Calendar, dateFnsLocalizer } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { useSession } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { listMeetings, updateMeeting, createMeeting, joinMeetingByLink, toLocalDateInput } from '../../lib/meetings'
import { MeetingNotes } from '../../components/meetings/MeetingNotes'
import { Avatar } from '../../components/Avatar'
import { Field, TextInput, SelectInput } from '../../components/FormInput'
import { ROLE_LABELS } from '../../types'
import type { Role } from '../../types'
import type { Meeting } from '../../types/meetings'

const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay })

type Tab = 'upcoming' | 'past' | 'calendar'

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function Meetings() {
  const { user } = useSession()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [tab, setTab] = useState<Tab>('upcoming')
  const [upcoming, setUpcoming] = useState<Meeting[]>([])
  const [past, setPast] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<Meeting | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [createWith, setCreateWith] = useState<ProfileOption | null>(null)
  const [editMeeting, setEditMeeting] = useState<Meeting | null>(null)
  const [showJoin, setShowJoin] = useState(false)

  const refresh = useCallback(() => {
    setLoading(true)
    Promise.all([listMeetings('upcoming'), listMeetings('past')])
      .then(([u, p]) => {
        setUpcoming(u.meetings)
        setPast(p.meetings)
      })
      .catch(() => toast.error('Could not load your meetings'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(refresh, [refresh])

  // ?with=<userId> from chat/profile → open create modal pre-filled.
  useEffect(() => {
    const withId = params.get('with')
    if (!withId || !user) return
    ;(async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, username')
          .eq('id', withId)
          .single()
        if (data) setCreateWith(data as ProfileOption)
      } catch {
        // person not found — open empty form anyway
      }
      setShowCreate(true)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const allMeetings = useMemo(() => [...upcoming, ...past], [upcoming, past])

  const events = useMemo(
    () =>
      allMeetings
        .filter((m) => m.status !== 'cancelled')
        .map((m) => ({
          id: m.id,
          title: m.title,
          start: new Date(m.scheduled_at),
          end: new Date(new Date(m.scheduled_at).getTime() + (m.duration_minutes || 30) * 60_000),
          resource: m,
        })),
    [allMeetings],
  )

  const otherPerson = (m: Meeting): { name: string; avatar: string | null; role: string | null } => {
    if (!m.participant_id) return { name: 'Anyone with the link', avatar: null, role: null }
    const other = user?.id === m.organizer_id ? m.participant : m.organizer
    return {
      name: other?.full_name ?? 'FounderHub member',
      avatar: other?.avatar_url ?? null,
      role: other?.role ?? null,
    }
  }

  const changeStatus = async (m: Meeting, status: 'cancelled' | 'completed') => {
    try {
      await updateMeeting(m.id, { status })
      toast.success(status === 'cancelled' ? 'Meeting cancelled' : 'Marked as completed')
      setDetail((d) => (d?.id === m.id ? { ...d, status } : d))
      refresh()
    } catch {
      toast.error('Could not update meeting')
    }
  }

  const openCreate = () => {
    setCreateWith(null)
    setShowCreate(true)
  }

  return (
    <div className="container-x py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Meetings</h1>
          <p className="text-sm text-gray-500">
            Create a meeting, get an invite link, join the call — with chat, screen share and notes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/settings/availability" className="btn-ghost">
            <CalendarIcon className="h-4 w-4" />
            My Availability
          </Link>
          <button onClick={() => setShowJoin(true)} className="btn-ghost">
            <Link2 className="h-4 w-4" />
            Join by link
          </button>
          <button onClick={openCreate} className="btn-primary">
            <Plus className="h-4 w-4" />
            New Meeting
          </button>
        </div>
      </div>

      <div className="mt-6 flex gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-dark-300 dark:bg-dark-200">
        {(['upcoming', 'past', 'calendar'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold capitalize transition-colors ${
              tab === t
                ? 'bg-white text-primary shadow-sm dark:bg-dark-100'
                : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : tab === 'calendar' ? (
        <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 dark:border-dark-300 dark:bg-dark-100">
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            onSelectEvent={(ev) => setDetail(ev.resource)}
            views={['month', 'week', 'day']}
            defaultView="month"
            style={{ height: 620 }}
            eventPropGetter={(ev) => ({
              style: {
                backgroundColor: ev.resource.status === 'completed' ? '#16a34a' : '#7C3AED',
                borderRadius: 6,
                border: 'none',
                color: '#fff',
                fontSize: 12,
              },
            })}
          />
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {tab === 'upcoming' && upcoming.length === 0 && (
            <EmptyState text="No upcoming meetings yet. Create a meeting, grab your invite link and share it." onNew={openCreate} />
          )}
          {tab === 'past' && past.length === 0 && (
            <EmptyState text="No past meetings yet." onNew={openCreate} />
          )}
          {(tab === 'upcoming' ? upcoming : past).map((m) => {
            const other = otherPerson(m)
            return (
              <div
                key={m.id}
                className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-4">
                  <Avatar src={other.avatar} name={other.name} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{m.title}</p>
                    <p className="truncate text-sm text-gray-500">
                      with {other.name}
                      {other.role ? ` · ${ROLE_LABELS[other.role.toLowerCase() as Role] ?? other.role}` : ''}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {formatWhen(m.scheduled_at)} · {m.duration_minutes} min
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {m.status === 'cancelled' && (
                    <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-500">
                      Cancelled
                    </span>
                  )}
                  {m.status === 'completed' && (
                    <span className="rounded-full bg-green-500/10 px-3 py-1 text-xs font-semibold text-green-600">
                      Completed
                    </span>
                  )}
                  {m.status === 'scheduled' && (
                    <a
                      href={m.meet_link}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-primary px-4 py-2 text-xs"
                    >
                      <Video className="h-3.5 w-3.5" />
                      Join
                    </a>
                  )}
                  <CopyInviteButton link={m.meet_link} />
                  <button onClick={() => setDetail(m)} className="btn-ghost px-4 py-2 text-xs">
                    Details
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setDetail(null)}
        >
          <div
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-gray-200 bg-white p-6 dark:border-dark-300 dark:bg-dark-100 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">{detail.title}</h2>
                <p className="mt-0.5 text-sm text-gray-500">
                  {formatWhen(detail.scheduled_at)} · {detail.duration_minutes} min
                </p>
              </div>
              <button
                onClick={() => setDetail(null)}
                aria-label="Close"
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 flex items-center gap-3 rounded-xl bg-gray-50 p-3 dark:bg-dark-200">
              <Avatar src={otherPerson(detail).avatar} name={otherPerson(detail).name} />
              <div>
                <p className="text-sm font-semibold">{otherPerson(detail).name}</p>
                <p className="text-xs text-gray-500">
                  {!detail.participant_id
                    ? 'Anyone with the invite link can join'
                    : user?.id === detail.organizer_id
                      ? 'Organizer'
                      : 'Participant'}
                </p>
              </div>
            </div>

            {detail.description && (
              <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">{detail.description}</p>
            )}

            <div className="mt-5 space-y-2">
              {detail.google_meet_link && (
                <a
                  href={detail.google_meet_link}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-lg bg-[#1a73e8]/10 px-3 py-2 text-sm font-medium text-[#1a73e8] hover:bg-[#1a73e8]/20"
                >
                  Google Meet link
                </a>
              )}
              {detail.status === 'scheduled' && (
                <a
                  href={detail.meet_link}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary w-full"
                >
                  <Video className="h-4 w-4" />
                  Join Video Call
                </a>
              )}
            </div>

            <div className="mt-4 rounded-xl bg-gray-50 p-3 dark:bg-dark-200">
              <p className="text-xs font-semibold text-gray-500">Invite link</p>
              <div className="mt-1 flex items-center gap-2">
                <input
                  readOnly
                  value={detail.meet_link}
                  onFocus={(e) => e.target.select()}
                  className="w-full truncate rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-600 outline-none dark:border-dark-300 dark:bg-dark dark:text-gray-300"
                />
                <CopyInviteButton link={detail.meet_link} />
              </div>
              <p className="mt-1 text-[11px] text-gray-400">
                Share this link — anyone can join without an account.
              </p>
            </div>

            <div className="mt-6">
              <MeetingNotes meetingId={detail.id} initialNotes={detail.notes} />
            </div>

            {detail.status === 'scheduled' && (
              <div className="mt-6 flex flex-col gap-2">
                <button
                  onClick={() => {
                    setEditMeeting(detail)
                    setDetail(null)
                  }}
                  className="btn-ghost flex-1"
                >
                  <Clock className="h-4 w-4" />
                  Reschedule
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => changeStatus(detail, 'completed')}
                    className="btn-ghost flex-1"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Mark complete
                  </button>
                  <button
                    onClick={() => changeStatus(detail, 'cancelled')}
                    className="btn-ghost flex-1 text-red-500 hover:border-red-300 hover:text-red-500"
                  >
                    <Ban className="h-4 w-4" />
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showCreate && (
        <MeetingFormModal
          mode="create"
          initialWith={createWith}
          onClose={() => {
            setShowCreate(false)
            setCreateWith(null)
          }}
          onDone={(m) => {
            setShowCreate(false)
            setCreateWith(null)
            toast.success('Meeting created — invite link is ready')
            setDetail(m)
            refresh()
          }}
        />
      )}

      {showJoin && (
        <JoinMeetingModal
          onClose={() => setShowJoin(false)}
          onDone={(roomId) => {
            setShowJoin(false)
            toast.success('Joining meeting...')
            navigate(`/meet/${roomId}`)
          }}
        />
      )}

      {editMeeting && (
        <MeetingFormModal
          mode="reschedule"
          initial={editMeeting}
          onClose={() => setEditMeeting(null)}
          onDone={(m) => {
            setEditMeeting(null)
            toast.success('Meeting updated')
            setDetail(m)
            refresh()
          }}
        />
      )}
    </div>
  )
}

interface ProfileOption {
  id: string
  full_name: string | null
  avatar_url: string | null
  username: string | null
}

function MeetingFormModal({
  mode,
  initial,
  initialWith,
  onClose,
  onDone,
}: {
  mode: 'create' | 'reschedule'
  initial?: Meeting | null
  initialWith?: ProfileOption | null
  onClose: () => void
  onDone: (m: Meeting) => void
}) {
  const { user } = useSession()
  const isEdit = mode === 'reschedule'
  const base = isEdit && initial ? new Date(initial.scheduled_at) : new Date()

  // Compute a default slot that's always in the future (next 30-min boundary, min 30 min from now)
  function nextFutureSlot() {
    const d = new Date(Date.now() + 30 * 60 * 1000)
    d.setMinutes(Math.ceil(d.getMinutes() / 30) * 30, 0, 0)
    return { date: toLocalDateInput(d), time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }
  }
  const futureSlot = nextFutureSlot()
  const defaultDate = isEdit ? toLocalDateInput(base) : futureSlot.date
  const defaultTime = isEdit
    ? `${String(base.getHours()).padStart(2, '0')}:${String(base.getMinutes()).padStart(2, '0')}`
    : futureSlot.time

  const [title, setTitle] = useState(isEdit ? initial?.title ?? '' : '')
  const [description, setDescription] = useState(isEdit ? initial?.description ?? '' : '')
  const [date, setDate] = useState(defaultDate)
  const [time, setTime] = useState(defaultTime)
  const [duration, setDuration] = useState(isEdit ? initial?.duration_minutes ?? 30 : 30)
  const [withProfile, setWithProfile] = useState<ProfileOption | null>(initialWith ?? null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ProfileOption[]>([])
  const [saving, setSaving] = useState(false)

  // Derived: scheduled time and validity
  const scheduled = useMemo(() => new Date(`${date}T${time}`), [date, time])
  const isPast = scheduled.getTime() <= Date.now()
  const minTime = date === toLocalDateInput(new Date()) ? `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}` : undefined

  useEffect(() => {
    if (isEdit || query.trim().length < 2) {
      setResults([])
      return
    }
    const t = setTimeout(async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, username')
          .ilike('full_name', `%${query.trim()}%`)
          .limit(5)
        setResults(((data as ProfileOption[] | null) ?? []).filter((p) => p.id !== user?.id))
      } catch {
        setResults([])
      }
    }, 300)
    return () => clearTimeout(t)
  }, [query, isEdit, user?.id])

  const submit = async () => {
    if (!title.trim()) {
      toast.error('Give the meeting a name')
      return
    }
    const scheduled = new Date(`${date}T${time}`)
    if (Number.isNaN(scheduled.getTime())) {
      toast.error('Pick a valid date and time')
      return
    }
    if (scheduled.getTime() <= Date.now()) {
      toast.error('Meeting time must be in the future')
      return
    }
    setSaving(true)
    try {
      if (isEdit && initial) {
        const { meeting } = await updateMeeting(initial.id, {
          title: title.trim(),
          description: description.trim(),
          scheduled_at: scheduled.toISOString(),
          duration_minutes: duration,
        })
        onDone(meeting)
      } else {
        const { meeting } = await createMeeting({
          title: title.trim(),
          description: description.trim(),
          scheduled_at: scheduled.toISOString(),
          duration_minutes: duration,
          participant_id: withProfile?.id ?? null,
        })
        onDone(meeting)
      }
    } catch {
      toast.error(isEdit ? 'Could not update meeting' : 'Could not create meeting')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white dark:bg-dark-100 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative overflow-hidden border-b border-gray-100 px-6 pb-5 pt-6 dark:border-dark-300">
          <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-primary/10 blur-2xl" />
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-white shadow-lg shadow-primary/30">
                {isEdit ? <Clock className="h-5 w-5" /> : <Video className="h-5 w-5" />}
              </div>
              <div>
                <h2 className="text-lg font-bold">
                  {isEdit ? 'Reschedule meeting' : 'New meeting'}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {isEdit
                    ? 'Update the details and share the new time.'
                    : 'Set a time and get an invite link instantly.'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="space-y-5 p-6">
          <Field label="Meeting name">
            <TextInput
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Intro call — funding discussion"
            />
          </Field>

          <Field label="Description (optional)">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Agenda, context…"
              className="w-full resize-none rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition-colors placeholder:text-gray-400 focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark"
            />
          </Field>

          {!isEdit && (
            <Field label="Meeting with (optional)">
              {withProfile ? (
                <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <Avatar src={withProfile.avatar_url} name={withProfile.full_name ?? '?'} />
                    <span className="text-sm font-medium">{withProfile.full_name}</span>
                    {withProfile.username && (
                      <span className="text-xs text-gray-400">@{withProfile.username}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setWithProfile(null)}
                    className="rounded-lg px-2 py-1 text-xs font-medium text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-dark-200 dark:hover:text-gray-200"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <TextInput
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search people by name…"
                    className="pl-9"
                  />
                  {results.length > 0 && (
                    <div className="absolute z-20 mt-1.5 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-dark-300 dark:bg-dark-100">
                      {results.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setWithProfile(p)
                            setQuery('')
                          }}
                          className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-dark-200"
                        >
                          <Avatar src={p.avatar_url} name={p.full_name ?? '?'} />
                          <span className="font-medium">{p.full_name}</span>
                          {p.username && <span className="text-xs text-gray-400">@{p.username}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <p className="text-xs text-gray-400">
                Leave empty for a room anyone can join with the link.
              </p>
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <TextInput
                type="date"
                value={date}
                min={toLocalDateInput(new Date())}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
            <Field label="Start time">
              <TextInput type="time" value={time} min={minTime} onChange={(e) => setTime(e.target.value)} />
              {isPast && date === toLocalDateInput(new Date()) && (
                <p className="mt-1 text-xs text-red-500">This time has passed — pick a future time.</p>
              )}
            </Field>
          </div>

          <Field label="Duration">
            <SelectInput value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              {[15, 30, 45, 60, 90, 120].map((d) => (
                <option key={d} value={d}>
                  {d} minutes
                </option>
              ))}
            </SelectInput>
          </Field>

          <div
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
              isPast
                ? 'border-red-300 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10'
                : 'border-primary/20 bg-gradient-to-r from-primary/10 to-accent/10'
            }`}
          >
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                isPast ? 'bg-red-500/15 text-red-500' : 'bg-primary/15 text-primary'
              }`}
            >
              <Link2 className="h-4 w-4" />
            </div>
            <div className="min-w-0 text-sm">
              <p className={`truncate font-semibold ${isPast ? 'text-red-600' : ''}`}>
                {scheduled.toLocaleString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </p>
              <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                {isPast
                  ? 'Time has passed — adjust the date or time above.'
                  : `${withProfile ? `with ${withProfile.full_name} · ` : ''}invite link is generated instantly`}
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 border-t border-gray-100 p-6 pt-4 dark:border-dark-300">
          <button onClick={onClose} className="btn-ghost flex-1">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving || isPast || !title.trim()}
            className="btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
            {isEdit ? 'Save changes' : 'Create meeting'}
          </button>
        </div>
      </div>
    </div>
  )
}

function JoinMeetingModal({ onClose, onDone }: { onClose: () => void; onDone: (roomId: string) => void }) {
  const [link, setLink] = useState('')
  const [joining, setJoining] = useState(false)

  const submit = async () => {
    const trimmed = link.trim()
    if (!trimmed) {
      toast.error('Paste the invite link first')
      return
    }
    setJoining(true)
    try {
      const { room_id } = await joinMeetingByLink(trimmed)
      onDone(room_id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not join that meeting')
    } finally {
      setJoining(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl bg-white p-6 dark:bg-dark-100 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-white shadow-lg shadow-primary/30">
            <Link2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Join a meeting</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Paste the invite link someone shared with you.
            </p>
          </div>
          <button onClick={onClose} className="ml-auto rounded-lg p-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        <input
          autoFocus
          value={link}
          onChange={(e) => setLink(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !joining && submit()}
          placeholder="https://…/meet/…"
          className="mt-5 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-primary focus:bg-white dark:border-dark-300 dark:bg-dark-200 dark:focus:bg-dark-100"
        />

        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="btn-ghost flex-1">
            Cancel
          </button>
          <button onClick={submit} disabled={joining} className="btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-50">
            {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
            Join call
          </button>
        </div>
      </div>
    </div>
  )
}

function EmptyState({ text, onNew }: { text: string; onNew: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 p-12 text-center dark:border-dark-400">
      <CalendarIcon className="mx-auto h-8 w-8 text-gray-400" />
      <p className="mt-3 text-sm text-gray-500">{text}</p>
      <button onClick={onNew} className="btn-primary mt-4">
        <Plus className="h-4 w-4" />
        Create a meeting
      </button>
    </div>
  )
}

function CopyInviteButton({ link }: { link: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy link')
    }
  }

  return (
    <button onClick={copy} className="btn-ghost px-4 py-2 text-xs">
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied!' : 'Copy invite'}
    </button>
  )
}
