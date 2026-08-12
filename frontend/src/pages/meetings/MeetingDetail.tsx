import { useCallback, useEffect, useMemo, useState } from 'react'
import { getErrorMessage } from '../../lib/errors'
import { Link, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  Video,
  Copy,
  Check,
  Loader2,
  Sparkles,
  Clock,
  Mail,
  MessageCircle,
  FileText,
  Trash2,
  Plus,
  CheckCircle2,
  Circle,
  Square,
  ExternalLink,
} from 'lucide-react'
import { useSession } from '../../context/AuthContext'
import {
  getMeeting,
  endMeeting,
  generateMeetingSummary,
  updateActionItem,
  createActionItem,
  deleteMeeting,
} from '../../lib/meetings'
import { Avatar } from '../../components/Avatar'
import { useConfirm } from '../../components/ConfirmDialog'
import type { Meeting, MeetingActionItem, MeetingParticipant } from '../../types/meetings'

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  in_progress: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  completed: 'bg-green-500/15 text-green-600 dark:text-green-400',
}

export default function MeetingDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useSession()
  const { confirm, dialog } = useConfirm()
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [loading, setLoading] = useState(true)
  const [transcript, setTranscript] = useState('')
  const [recordingUrl, setRecordingUrl] = useState('')
  const [generating, setGenerating] = useState(false)
  const [ending, setEnding] = useState(false)
  const [showAddItem, setShowAddItem] = useState(false)
  const [newItem, setNewItem] = useState('')
  const [saved, setSaved] = useState(false)

  const refresh = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const { meeting: m } = await getMeeting(id)
      setMeeting(m)
      setTranscript(m.transcript ?? '')
      setRecordingUrl(m.recording_url ?? '')
    } catch {
      toast.error('Could not load meeting')
      navigate('/meetings')
    } finally {
      setLoading(false)
    }
  }, [id, navigate])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!meeting) return
    const t = setTimeout(async () => {
      if (transcript !== (meeting.transcript ?? '') || recordingUrl !== (meeting.recording_url ?? '')) {
        try {
          await endMeeting(meeting.id, { transcript, recording_url: recordingUrl || null })
          setMeeting((m) => (m ? { ...m, transcript, recording_url: recordingUrl || null } : m))
          setSaved(true)
        } catch {
          setSaved(false)
        }
      }
    }, 1200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript, recordingUrl])

  const isOrganizer = user?.id === meeting?.organizer_id
  const isMember = isOrganizer || user?.id === meeting?.participant_id

  const participants = useMemo(() => {
    const list: MeetingParticipant[] = meeting?.participants ?? []
    const names = list
      .map((p) => p.profiles?.full_name ?? p.profiles?.username ?? 'Member')
      .filter(Boolean)
    return { list, names }
  }, [meeting])

  const summarySections = useMemo(() => {
    const raw = (meeting?.ai_summary as { raw?: string } | null)?.raw ?? ''
    if (!raw) return []
    const lines = raw.split('\n')
    const sections: { title: string; body: string[] }[] = []
    let current: { title: string; body: string[] } | null = null
    for (const line of lines) {
      const m = line.match(/^#{1,3}\s+(.*)$/)
      if (m) {
        current = { title: m[1].trim(), body: [] }
        sections.push(current)
      } else if (current) {
        current.body.push(line)
      }
    }
    return sections.filter((s) => s.body.some((b) => b.trim()))
  }, [meeting])

  const handleEnd = async () => {
    if (!meeting) return
    setEnding(true)
    try {
      const { meeting: m } = await endMeeting(meeting.id, { transcript, recording_url: recordingUrl || null })
      setMeeting(m)
      toast.success('Meeting marked as completed')
    } catch (err) {
      toast.error(getErrorMessage(err, 'generic'))
    } finally {
      setEnding(false)
    }
  }

  const handleGenerate = async () => {
    if (!meeting) return
    if (!transcript.trim()) {
      toast.error('Add a transcript before generating a summary')
      return
    }
    setGenerating(true)
    try {
      const result = await generateMeetingSummary({
        meeting_id: meeting.id,
        transcript,
        recording_url: recordingUrl || null,
      })
      setMeeting(result.meeting)
      toast.success('AI summary generated')
    } catch (err) {
      toast.error(getErrorMessage(err, 'generic'))
    } finally {
      setGenerating(false)
    }
  }

  const changeStatus = async (item: MeetingActionItem, status: 'pending' | 'in_progress' | 'completed') => {
    try {
      const { action_item } = await updateActionItem(item.id, { status })
      setMeeting((m) =>
        m
          ? {
              ...m,
              action_items: (m.action_items ?? []).map((a) => (a.id === item.id ? { ...a, ...action_item } : a)),
            }
          : m,
      )
    } catch (err) {
      toast.error(getErrorMessage(err, 'generic'))
    }
  }

  const addItem = async () => {
    if (!meeting || !newItem.trim()) return
    try {
      const { action_item } = await createActionItem({ meeting_id: meeting.id, description: newItem.trim() })
      setMeeting((m) => (m ? { ...m, action_items: [...(m.action_items ?? []), action_item] } : m))
      setNewItem('')
      setShowAddItem(false)
      toast.success('Action item added')
    } catch (err) {
      toast.error(getErrorMessage(err, 'generic'))
    }
  }

  const handleDelete = async () => {
    if (!meeting) return
    const ok = await confirm({
      title: 'Delete this meeting?',
      message: 'This will delete the meeting and all its notes/action items. This cannot be undone.',
      confirmLabel: 'Delete',
    })
    if (!ok) return
    try {
      await deleteMeeting(meeting.id)
      toast.success('Meeting deleted')
      navigate('/meetings')
    } catch (err) {
      toast.error(getErrorMessage(err, 'generic'))
    }
  }

  const followUpEmail = useMemo(() => {
    if (!meeting) return ''
    const items = (meeting.action_items ?? [])
      .filter((a) => a.status !== 'completed')
      .map((a, i) => `${i + 1}. ${a.description}${a.assignee?.full_name ? ` (${a.assignee.full_name})` : ''}`)
      .join('\n')
    const summary = summarySections.map((s) => `${s.title}\n${s.body.join('\n')}`).join('\n\n')
    return [
      `Subject: Follow-up: ${meeting.title}`,
      '',
      'Hi,',
      '',
      `Here is a quick follow-up on our meeting (${formatWhen(meeting.scheduled_at)}).`,
      '',
      summarySections.length ? `Summary:\n${summary}\n\n` : '',
      items ? `Action items:\n${items}` : '',
      '',
      'Best regards',
    ]
      .filter((l) => l !== null)
      .join('\n')
  }, [meeting, summarySections])

  const buildPdfText = useMemo(() => {
    if (!meeting) return ''
    const items = (meeting.action_items ?? []).map((a, i) => `${i + 1}. [${a.status.toUpperCase()}] ${a.description}`).join('\n')
    return [
      `Meeting: ${meeting.title}`,
      `Date: ${formatWhen(meeting.scheduled_at)}`,
      `Duration: ${meeting.duration_minutes} min`,
      `Participants: ${[...participants.names, meeting.organizer?.full_name ?? 'Organizer'].filter(Boolean).join(', ')}`,
      '',
      meeting.description ? `Description:\n${meeting.description}\n` : '',
      summarySections.map((s) => `${s.title}\n${s.body.join('\n')}`).join('\n\n'),
      items ? `\nAction items:\n${items}` : '',
    ]
      .filter((l) => l !== null && l !== '')
      .join('\n')
  }, [meeting, participants, summarySections])

  const downloadPdf = () => {
    const blob = new Blob([buildPdfText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(meeting?.title ?? 'meeting').replace(/[^\w\d]+/g, '-').toLowerCase()}-summary.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const whatsappLink = useMemo(() => {
    const text = followUpEmail.split('\n').slice(1).join('\n')
    return `https://wa.me/?text=${encodeURIComponent(text)}`
  }, [followUpEmail])

  const mailtoLink = useMemo(() => {
    const lines = followUpEmail.split('\n')
    const subject = (lines[0] || '').replace(/^Subject:\s*/, '')
    const body = lines.slice(1).join('\n').replace(/^\s*/, '')
    return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }, [followUpEmail])

  const pendingCount = (meeting?.action_items ?? []).filter((a) => a.status !== 'completed').length

  if (loading) {
    return (
      <div className="container-x flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!meeting || !isMember) {
    return (
      <div className="container-x py-16 text-center">
        <p className="text-gray-500">Meeting not found or you don't have access.</p>
        <Link to="/meetings" className="btn-primary mt-4">
          Back to Meetings
        </Link>
      </div>
    )
  }

  return (
    <div className="container-x py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/meetings" className="btn-ghost px-3 py-2" aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{meeting.title}</h1>
            <p className="text-sm text-gray-500">
              {formatWhen(meeting.scheduled_at)} · {meeting.duration_minutes} min
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {meeting.status === 'scheduled' && (
            <>
              <a
                href={meeting.meet_link}
                target="_blank"
                rel="noreferrer"
                className="btn-primary"
              >
                <Video className="h-4 w-4" />
                Join
              </a>
              <button onClick={handleEnd} disabled={ending} className="btn-ghost">
                {ending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
                End meeting
              </button>
            </>
          )}
          {isOrganizer && (
            <button onClick={handleDelete} className="btn-ghost px-3 py-2 text-red-500 hover:border-red-300">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Left: meeting details + transcript + summary */}
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-2xl border border-gray-200 bg-white/70 p-6 backdrop-blur dark:border-dark-300 dark:bg-dark-100/70">
            <div className="flex flex-wrap gap-4 text-sm">
              <div>
                <p className="text-xs font-semibold text-gray-400">Status</p>
                <span
                  className={`mt-1 inline-block rounded-full px-3 py-1 text-xs font-bold capitalize ${
                    meeting.status === 'completed'
                      ? 'bg-green-500/15 text-green-600'
                      : meeting.status === 'cancelled'
                        ? 'bg-red-500/15 text-red-500'
                        : 'bg-primary/15 text-primary'
                  }`}
                >
                  {meeting.status}
                </span>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400">Startup</p>
                <p className="mt-1 font-medium">{meeting.startup_id ? 'Linked startup' : '—'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400">Recording</p>
                {meeting.recording_url ? (
                  <a href={meeting.recording_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 font-medium text-primary">
                    <ExternalLink className="h-3.5 w-3.5" /> View recording
                  </a>
                ) : (
                  <p className="mt-1 font-medium text-gray-400">—</p>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400">Started</p>
                <p className="mt-1 font-medium">{meeting.started_at ? formatWhen(meeting.started_at) : '—'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400">Ended</p>
                <p className="mt-1 font-medium">{meeting.ended_at ? formatWhen(meeting.ended_at) : '—'}</p>
              </div>
            </div>
            {meeting.description && <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">{meeting.description}</p>}
            <div className="mt-4 rounded-xl bg-gray-50 p-3 dark:bg-dark-200">
              <p className="text-xs font-semibold text-gray-500">Invite link</p>
              <div className="mt-1 flex items-center gap-2">
                <input
                  readOnly
                  value={meeting.meet_link}
                  onFocus={(e) => e.target.select()}
                  className="w-full truncate rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-600 outline-none dark:border-dark-300 dark:bg-dark dark:text-gray-300"
                />
                <CopyButton text={meeting.meet_link} />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white/70 p-6 backdrop-blur dark:border-dark-300 dark:bg-dark-100/70">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold">Transcript & recording</h2>
                <p className="text-xs text-gray-500">Paste the transcript, then generate an AI summary.</p>
              </div>
              <span className="flex items-center gap-1 text-xs text-gray-400">{saved ? <><Check className="h-3 w-3" /> Saved</> : null}</span>
            </div>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={8}
              placeholder="Paste the meeting transcript here…"
              className="mt-3 w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark"
            />
            <input
              value={recordingUrl}
              onChange={(e) => setRecordingUrl(e.target.value)}
              placeholder="Recording URL (optional)"
              className="mt-3 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark"
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={handleGenerate}
                disabled={generating || !transcript.trim()}
                className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {generating ? 'Generating…' : 'Generate AI summary'}
              </button>
              {meeting.status !== 'completed' && (
                <button onClick={handleEnd} disabled={ending} className="btn-ghost">
                  {ending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Mark completed
                </button>
              )}
            </div>
          </section>

          {summarySections.length > 0 && (
            <section className="rounded-2xl border border-gray-200 bg-white/70 p-6 backdrop-blur dark:border-dark-300 dark:bg-dark-100/70">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h2 className="font-bold">AI Meeting Summary</h2>
              </div>
              <div className="mt-4 space-y-5">
                {summarySections.map((section) => (
                  <div key={section.title}>
                    <h3 className="text-sm font-bold text-primary">{section.title}</h3>
                    <div className="mt-1 space-y-1">
                      {section.body.map((line, i) =>
                        line.trim() === '' ? null : (
                          <p key={i} className="text-sm text-gray-600 dark:text-gray-300">
                            {line.trim().startsWith('-') ? `• ${line.trim().slice(1).trim()}` : line}
                          </p>
                        ),
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-gray-200 bg-white/70 p-6 backdrop-blur dark:border-dark-300 dark:bg-dark-100/70">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold">Action items</h2>
                <p className="text-xs text-gray-500">{pendingCount} pending · {(meeting.action_items ?? []).length} total</p>
              </div>
              <button onClick={() => setShowAddItem(true)} className="btn-ghost px-3 py-2 text-xs">
                <Plus className="h-3.5 w-3.5" />
                Add item
              </button>
            </div>

            {showAddItem && (
              <div className="mt-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
                <textarea
                  autoFocus
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  rows={2}
                  placeholder="e.g. Send the updated cap table to the investor"
                  className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark"
                />
                <div className="mt-2 flex justify-end gap-2">
                  <button onClick={() => { setShowAddItem(false); setNewItem('') }} className="btn-ghost px-3 py-1.5 text-xs">
                    Cancel
                  </button>
                  <button onClick={addItem} disabled={!newItem.trim()} className="btn-primary px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50">
                    Add
                  </button>
                </div>
              </div>
            )}

            {(meeting.action_items ?? []).length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-gray-300 p-6 text-center dark:border-dark-400">
                <CheckCircle2 className="mx-auto h-6 w-6 text-gray-400" />
                <p className="mt-2 text-sm text-gray-500">
                  No action items yet. Generate an AI summary to auto-extract them, or add one manually.
                </p>
              </div>
            ) : (
              <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 dark:border-dark-300">
                {(meeting.action_items ?? []).map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-start gap-3 border-b border-gray-100 p-4 last:border-0 dark:border-dark-300 ${
                      item.status === 'completed' ? 'bg-green-500/5' : ''
                    }`}
                  >
                    <button
                      onClick={() => changeStatus(item, item.status === 'completed' ? 'pending' : 'completed')}
                      className={`mt-0.5 flex-shrink-0 ${item.status === 'completed' ? 'text-green-500' : 'text-gray-300 hover:text-primary'}`}
                      aria-label="Toggle status"
                    >
                      {item.status === 'completed' ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm ${item.status === 'completed' ? 'text-gray-400 line-through' : ''}`}>{item.description}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-400">
                        {item.assignee?.full_name && (
                          <span className="inline-flex items-center gap-1">
                            <Avatar src={item.assignee.avatar_url} name={item.assignee.full_name} size="sm" />
                            {item.assignee.full_name}
                          </span>
                        )}
                        {item.due_date && (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(item.due_date).toLocaleDateString()}
                          </span>
                        )}
                        {item.status !== 'completed' && (
                          <span className={`ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLES[item.status] ?? STATUS_STYLES.pending}`}>
                            {item.status}
                          </span>
                        )}
                      </div>
                    </div>
                    {item.status === 'pending' && (
                      <button onClick={() => changeStatus(item, 'in_progress')} className="btn-ghost px-2 py-1 text-[10px]">
                        Start
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right: participants + follow-up */}
        <div className="space-y-6">
          <section className="rounded-2xl border border-gray-200 bg-white/70 p-6 backdrop-blur dark:border-dark-300 dark:bg-dark-100/70">
            <h2 className="font-bold">Participants</h2>
            <div className="mt-3 space-y-3">
              {meeting.organizer && (
                <div className="flex items-center gap-3">
                  <Avatar src={meeting.organizer.avatar_url} name={meeting.organizer.full_name} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{meeting.organizer.full_name}</p>
                    <p className="text-xs text-gray-400">Organizer</p>
                  </div>
                </div>
              )}
              {(participants.list.length ? participants.list : meeting.participant ? [{ profiles: meeting.participant } as MeetingParticipant] : []).map((p) => (
                <div key={p.id ?? p.user_id} className="flex items-center gap-3">
                  <Avatar src={p.profiles?.avatar_url} name={p.profiles?.full_name} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{p.profiles?.full_name ?? 'Member'}</p>
                    <p className="text-xs text-gray-400 capitalize">{p.role ?? 'Participant'}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white/70 p-6 backdrop-blur dark:border-dark-300 dark:bg-dark-100/70">
            <h2 className="font-bold">Send follow-up</h2>
            <p className="mt-1 text-xs text-gray-500">Share the summary and open action items.</p>
            <div className="mt-4 space-y-2">
              <a href={mailtoLink} className="flex w-full items-center gap-2 rounded-lg bg-[#1a73e8]/10 px-3 py-2 text-sm font-medium text-[#1a73e8] hover:bg-[#1a73e8]/20">
                <Mail className="h-4 w-4" />
                Email follow-up
              </a>
              <a href={whatsappLink} target="_blank" rel="noreferrer" className="flex w-full items-center gap-2 rounded-lg bg-[#25D366]/10 px-3 py-2 text-sm font-medium text-[#128C7E] hover:bg-[#25D366]/20">
                <MessageCircle className="h-4 w-4" />
                WhatsApp follow-up
              </a>
              <button onClick={downloadPdf} className="flex w-full items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-dark-200 dark:text-gray-200 dark:hover:bg-dark-300">
                <FileText className="h-4 w-4" />
                Download summary (PDF)
              </button>
            </div>
          </section>
        </div>
      </div>
      {dialog}
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy link')
    }
  }
  return (
    <button onClick={copy} className="btn-ghost px-3 py-1.5 text-xs">
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}
