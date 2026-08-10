import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Radar, Plus, RefreshCw, Trash2, Calendar, User, Target, LayoutDashboard } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { StartupPicker } from '../../components/studio/StartupPicker'
import { ScoreRing, ScoreBar } from '../../components/studio/ScoreRing'
import type { DataCoverage } from '../../types/startupInsights'

interface Insight {
  id?: string
  insight_type: 'opportunity' | 'warning' | 'risk' | 'recommendation'
  title: string
  detail?: string
}

interface WarTask {
  id: string
  plan_id?: string | null
  title: string
  description?: string
  goal?: string
  priority: string
  assigned_role?: string
  assignee_id?: string | null
  deadline?: string | null
  status: string
  sort_order?: number
}

interface Plan {
  id: string
  duration_days: number
  goal?: string
  summary?: string
  status: string
  created_at?: string
  tasks?: WarTask[]
  task_count?: number
  done_count?: number
}

interface HealthData {
  score: number | null
  categories?: { key: string; label: string; score: number; note?: string }[]
  strengths?: { title: string; detail: string }[]
  weaknesses?: { title: string; detail: string }[]
  recommendations?: { action: string; priority: string }[]
}

const insightStyles: Record<Insight['insight_type'], string> = {
  opportunity: 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10',
  warning: 'border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10',
  risk: 'border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10',
  recommendation: 'border-blue-200 bg-blue-50 dark:border-blue-500/30 dark:bg-blue-500/10',
}

const insightDot: Record<Insight['insight_type'], string> = {
  opportunity: '🟢',
  warning: '🟡',
  risk: '🔴',
  recommendation: '🔵',
}

const taskStatusColor: Record<string, string> = {
  todo: 'bg-gray-100 text-gray-600 dark:bg-dark-300 dark:text-gray-400',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
  blocked: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
  done: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
}

const priorityColor: Record<string, string> = {
  high: 'text-red-600 dark:text-red-400',
  medium: 'text-amber-600 dark:text-amber-400',
  low: 'text-emerald-600 dark:text-emerald-400',
}

export default function WarRoom() {
  const [startupId, setStartupId] = useState<string | null>(null)
  const [data, setData] = useState<{
    startup?: { name?: string }
    coverage?: DataCoverage
    health?: HealthData
    readiness?: { score: number | null; summary?: string }
    team_gaps?: { summary?: string; gaps?: { role: string; label: string; why?: string }[] }
    insights?: Insight[]
    plans?: Plan[]
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [planning, setPlanning] = useState(false)
  const [duration, setDuration] = useState(30)
  const [focus, setFocus] = useState('')
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDeadline, setTaskDeadline] = useState('')
  const [taskRole, setTaskRole] = useState('founder')
  const [addingTask, setAddingTask] = useState(false)

  const load = useCallback(async (id: string, refreshInsights = false) => {
    setLoading(true)
    try {
      const result = await api.get<typeof data>(
        `/api/war-room/startups/${id}/dashboard${refreshInsights ? '?refresh_insights=true' : ''}`,
        { auth: true },
      )
      setData(result)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not load the War Room')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (startupId) void load(startupId)
  }, [startupId, load])

  const openPlan = async (planId: string) => {
    try {
      const plan = await api.get<Plan>(`/api/war-room/plans/${planId}`, { auth: true })
      setSelectedPlan(plan)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not load plan')
    }
  }

  const createPlan = async () => {
    if (!startupId) return
    setPlanning(true)
    try {
      const result = await api.post<{ plan: Plan; tasks: WarTask[] }>(
        `/api/war-room/startups/${startupId}/plans`,
        { duration_days: duration, focus },
        { auth: true },
      )
      toast.success(`${duration}-day plan created`)
      setSelectedPlan({ ...result.plan, tasks: result.tasks })
      setFocus('')
      await load(startupId)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create plan')
    } finally {
      setPlanning(false)
    }
  }

  const updateTask = async (taskId: string, patch: Partial<WarTask>) => {
    try {
      await api.patch(`/api/war-room/tasks/${taskId}`, patch, { auth: true })
      setSelectedPlan((p) =>
        p
          ? { ...p, tasks: (p.tasks ?? []).map((t) => (t.id === taskId ? { ...t, ...patch } : t)) }
          : p,
      )
      await load(startupId ?? '')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update task')
    }
  }

  const addTask = async () => {
    if (!taskTitle.trim()) {
      toast.error('Task title is required')
      return
    }
    setAddingTask(true)
    try {
      const task = await api.post<WarTask>(
        '/api/war-room/tasks',
        {
          plan_id: selectedPlan?.id ?? null,
          title: taskTitle.trim(),
          deadline: taskDeadline || undefined,
          assigned_role: taskRole,
        },
        { auth: true },
      )
      setSelectedPlan((p) => (p ? { ...p, tasks: [...(p.tasks ?? []), task] } : p))
      setTaskTitle('')
      setTaskDeadline('')
      toast.success('Task added')
      await load(startupId ?? '')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not add task')
    } finally {
      setAddingTask(false)
    }
  }

  const refreshInsights = async () => {
    if (!startupId) return
    setRefreshing(true)
    try {
      await api.post(`/api/war-room/startups/${startupId}/insights`, {}, { auth: true })
      toast.success('Insights refreshed')
      await load(startupId)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not refresh insights')
    } finally {
      setRefreshing(false)
    }
  }

  const deleteInsight = async (insightId: string) => {
    try {
      await api.delete(`/api/war-room/insights/${insightId}`, { auth: true })
      setData((d) => (d ? { ...d, insights: (d.insights ?? []).filter((i) => i.id !== insightId) } : d))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete insight')
    }
  }

  const base =
    'w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-sm text-gray-900 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark dark:text-white'

  const progress = selectedPlan?.task_count
    ? Math.round(((selectedPlan.done_count ?? 0) / selectedPlan.task_count) * 100)
    : 0

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Radar size={22} />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">AI Startup War Room</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Your command center — health, readiness, team gaps, insights and action plans.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refreshInsights}
            disabled={refreshing || !startupId}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-50 dark:border-dark-300 dark:text-gray-300 dark:hover:bg-dark-300"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} /> Refresh insights
          </button>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100 dark:border-dark-300 dark:text-gray-300 dark:hover:bg-dark-300"
          >
            <LayoutDashboard size={15} /> Back to Dashboard
          </Link>
        </div>
      </div>

      <StartupPicker
        startupId={startupId}
        onChange={setStartupId}
        onRefresh={() => startupId && load(startupId)}
        refreshing={false}
      />

      {loading && (
        <div className="mt-8 space-y-4">
          <div className="h-40 animate-pulse rounded-2xl bg-gray-200 dark:bg-dark-300" />
          <div className="h-24 animate-pulse rounded-2xl bg-gray-200 dark:bg-dark-300" />
        </div>
      )}

      {!loading && data && (
        <div className="mt-8 space-y-6">
          {/* Health / Readiness / Gaps */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white p-6 dark:border-dark-300 dark:bg-dark">
              <ScoreRing score={data.health?.score ?? null} label="Health Score" />
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-dark-300 dark:bg-dark">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Investor Readiness
              </h3>
              <div className="mb-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-gray-900 dark:text-white">
                  {data.readiness?.score ?? '—'}
                </span>
                <span className="text-sm text-gray-400">/100</span>
              </div>
              {data.readiness?.summary && (
                <p className="text-xs text-gray-500 dark:text-gray-400">{data.readiness.summary}</p>
              )}
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-dark-300 dark:bg-dark">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Team Gaps
              </h3>
              {(data.team_gaps?.gaps ?? []).length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {data.team_gaps?.summary ?? 'No gaps detected.'}
                </p>
              ) : (
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                  {(data.team_gaps?.gaps ?? []).slice(0, 4).map((g) => (
                    <li key={g.role}>
                      <span className="font-semibold text-gray-800 dark:text-gray-100">{g.label}</span> — {g.why}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Section bars */}
          {data.health?.categories && data.health.categories.length > 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-dark-300 dark:bg-dark">
              <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Health Breakdown
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                {data.health.categories.map((c) => (
                  <ScoreBar key={c.key} label={c.label} score={c.score} note={c.note} />
                ))}
              </div>
            </div>
          )}

          {/* Insights */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-dark-300 dark:bg-dark">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              AI Insights
            </h3>
            <div className="grid gap-3 md:grid-cols-2">
              {(data.insights ?? []).map((insight) => (
                <div
                  key={insight.id ?? insight.title}
                  className={`flex items-start gap-3 rounded-xl border p-4 ${insightStyles[insight.insight_type] ?? ''}`}
                >
                  <span className="text-lg leading-none">{insightDot[insight.insight_type] ?? '🟢'}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{insight.title}</p>
                      {insight.id && (
                        <button
                          onClick={() => deleteInsight(insight.id!)}
                          className="shrink-0 text-gray-400 transition-colors hover:text-red-500"
                          aria-label="Delete insight"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    {insight.detail && (
                      <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{insight.detail}</p>
                    )}
                  </div>
                </div>
              ))}
              {(data.insights ?? []).length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No insights yet — click “Refresh insights” to generate them from your real data.
                </p>
              )}
            </div>
          </div>

          {/* Plans */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-dark-300 dark:bg-dark">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Action Plans
            </h3>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className={`${base} sm:w-40`}
              >
                <option value={30}>30 days</option>
                <option value={60}>60 days</option>
                <option value={90}>90 days</option>
              </select>
              <input
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
                placeholder="Focus area (optional)"
                className={`${base} flex-1`}
              />
              <button
                onClick={createPlan}
                disabled={planning}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <Plus size={16} /> {planning ? 'Generating…' : 'Generate Plan'}
              </button>
            </div>

            {(data.plans ?? []).length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No plans yet — generate a 30/60/90-day plan and we’ll turn your real data into prioritized tasks.
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {(data.plans ?? []).map((plan) => (
                  <button
                    key={plan.id}
                    onClick={() => openPlan(plan.id)}
                    className="rounded-xl border border-gray-200 p-4 text-left transition-colors hover:border-primary/50 dark:border-dark-300"
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm font-bold text-gray-800 dark:text-gray-100">
                        {plan.duration_days}-day plan
                      </span>
                      <span className="text-xs text-gray-400">
                        {plan.done_count ?? 0}/{plan.task_count ?? 0} done
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{plan.goal}</p>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-dark-300">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${plan.task_count ? Math.round(((plan.done_count ?? 0) / plan.task_count) * 100) : 0}%` }}
                      />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected plan detail */}
          {selectedPlan && (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-dark-300 dark:bg-dark">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
                    <Target size={18} className="text-primary" /> {selectedPlan.duration_days}-day plan
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{selectedPlan.goal}</p>
                  {selectedPlan.summary && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{selectedPlan.summary}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span>Progress</span>
                  <div className="h-1.5 w-32 overflow-hidden rounded-full bg-gray-200 dark:bg-dark-300">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
                  </div>
                  <span className="font-semibold">{progress}%</span>
                </div>
              </div>

              <div className="mb-4 flex flex-col gap-2 rounded-xl bg-gray-50 p-3 sm:flex-row dark:bg-dark">
                <input
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="New task title"
                  className={`${base} flex-1`}
                />
                <select value={taskRole} onChange={(e) => setTaskRole(e.target.value)} className={`${base} sm:w-44`}>
                  {['founder', 'developer', 'designer', 'marketer', 'business_analyst', 'mentor', 'recruiter'].map((r) => (
                    <option key={r} value={r}>
                      {r.replace('_', ' ')}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={taskDeadline}
                  onChange={(e) => setTaskDeadline(e.target.value)}
                  className={`${base} sm:w-44`}
                />
                <button
                  onClick={addTask}
                  disabled={addingTask}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
                >
                  <Plus size={15} /> Add
                </button>
              </div>

              <div className="space-y-2">
                {(selectedPlan.tasks ?? []).map((task) => (
                  <div
                    key={task.id}
                    className="flex flex-col gap-2 rounded-xl border border-gray-200 p-4 sm:flex-row sm:items-center dark:border-dark-300"
                  >
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm font-semibold ${
                          task.status === 'done' ? 'line-through text-gray-400' : 'text-gray-800 dark:text-gray-100'
                        }`}
                      >
                        {task.title}
                      </p>
                      {task.description && (
                        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{task.description}</p>
                      )}
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                        <span className={`inline-flex items-center gap-1 font-semibold ${priorityColor[task.priority] ?? ''}`}>
                          ● {task.priority}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <User size={11} /> {task.assigned_role?.replace('_', ' ') ?? 'founder'}
                        </span>
                        {task.deadline && (
                          <span className="inline-flex items-center gap-1">
                            <Calendar size={11} /> {task.deadline}
                          </span>
                        )}
                      </div>
                    </div>
                    <select
                      value={task.status}
                      onChange={(e) => updateTask(task.id, { status: e.target.value })}
                      className={`rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-semibold outline-none dark:border-dark-300 dark:bg-dark ${taskStatusColor[task.status] ?? ''}`}
                    >
                      <option value="todo">To do</option>
                      <option value="in_progress">In progress</option>
                      <option value="blocked">Blocked</option>
                      <option value="done">Done</option>
                    </select>
                  </div>
                ))}
                {(selectedPlan.tasks ?? []).length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No tasks in this plan yet.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {!loading && !data && (
        <div className="mt-8 rounded-2xl border border-dashed border-gray-300 p-10 text-center dark:border-dark-300">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Select one of your startups to open its War Room.
          </p>
        </div>
      )}
    </div>
  )
}
