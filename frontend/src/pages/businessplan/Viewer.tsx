import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  BarChart3,
  Check,
  Download,
  FileText,
  Gauge,
  LayoutDashboard,
  Lightbulb,
  Loader2,
  Pencil,
  PieChart,
  Rocket,
  Share2,
  Users,
  X,
} from 'lucide-react'
import {
  ResponsiveContainer,
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart as RePieChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  buildShareUrl,
  downloadBusinessPlanExport,
  getBusinessPlan,
  updateBusinessPlan,
} from '../../lib/businessPlan'
import type { BusinessPlanRecord, BusinessPlanSection } from '../../types/businessPlan'

const inputCls =
  'w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark'

const TABS = [
  { key: 'overview', label: 'Overview', icon: Gauge },
  { key: 'plan', label: 'Business Plan', icon: FileText },
  { key: 'pitch', label: 'Pitch Deck', icon: Rocket },
  { key: 'financials', label: 'Financials', icon: BarChart3 },
  { key: 'team', label: 'Team', icon: Users },
  { key: 'recommendations', label: 'AI Recommendations', icon: Lightbulb },
] as const

type TabKey = (typeof TABS)[number]['key']

function fmt(n: number | null | undefined) {
  if (n == null) return '—'
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

export function ReadinessRing({ score, label }: { score: number; label: string }) {
  const r = 52
  const c = 2 * Math.PI * r
  const pct = Math.min(100, Math.max(0, score))
  const color = pct >= 80 ? '#10b981' : pct >= 65 ? '#14b8a6' : pct >= 45 ? '#f59e0b' : '#ef4444'
  return (
    <div className="flex flex-col items-center">
      <div className="relative h-32 w-32">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle cx="60" cy="60" r={r} fill="none" strokeWidth="10" className="stroke-gray-200 dark:stroke-dark-300" />
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * c} ${c}`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-extrabold">{pct}</span>
          <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">/ 100</span>
        </div>
      </div>
      <span className="mt-2 rounded-full px-3 py-1 text-xs font-bold" style={{ color, backgroundColor: `${color}1a` }}>
        {label}
      </span>
    </div>
  )
}

export function SectionBody({ content }: { content: string }) {
  const blocks = content.split('\n\n')
  return (
    <div className="space-y-3">
      {blocks.map((block, i) => {
        const lines = block.split('\n')
        const isBullets = lines.length > 0 && lines.every((l) => !l.trim() || l.trim().startsWith('-'))
        if (isBullets) {
          return (
            <ul key={i} className="space-y-1.5">
              {lines
                .filter((l) => l.trim())
                .map((l, j) => (
                  <li key={j} className="flex gap-2 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                    <span className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary/60" />
                    <span>{l.trim().replace(/^-\s*/, '')}</span>
                  </li>
                ))}
            </ul>
          )
        }
        return (
          <p key={i} className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            {block}
          </p>
        )
      })}
    </div>
  )
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-dark-300 dark:bg-dark-100">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`mt-1.5 text-xl font-extrabold ${accent ? 'text-primary' : ''}`}>{value}</p>
    </div>
  )
}

function OverviewTab({ plan, onExport, onShare }: { plan: BusinessPlanRecord; onExport: (f: 'pdf' | 'docx' | 'markdown') => void; onShare: () => void }) {
  const fin = plan.financial_projection
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-dark-300 dark:bg-dark-100">
        <h3 className="text-sm font-bold uppercase tracking-wide text-gray-400">Investor Readiness Score</h3>
        <div className="mt-4 flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <ReadinessRing score={plan.investor_readiness.overall} label={plan.investor_readiness.label} />
          <div className="w-full flex-1">
            <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">{plan.investor_readiness.summary}</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {plan.investor_readiness.scores.map((s) => (
                <div key={s.label}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-semibold text-gray-600 dark:text-gray-300">{s.label}</span>
                    <span className="font-bold">{s.score}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-dark-300">
                    <div className="h-full rounded-full bg-gradient-brand" style={{ width: `${s.score}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Year-1 revenue" value={fmt(fin.year1_revenue)} accent />
        <StatCard label="Year-3 revenue" value={fmt(fin.year3_revenue)} accent />
        <StatCard label="Monthly burn" value={fmt(fin.monthly_budget)} />
        <StatCard
          label="Break-even"
          value={fin.break_even_month ? `Month ${fin.break_even_month}` : 'Beyond 12 months'}
        />
        <StatCard label="Runway" value={fin.runway_months ? `${fin.runway_months} months` : '—'} />
        <StatCard label="Burn rate" value={`${fmt(fin.burn_rate)}/mo`} />
        <StatCard label="Funding ask" value={fmt(fin.funding_requirement)} accent />
        <StatCard label="Sections" value={`${plan.business_plan.length}`} />
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => onExport('pdf')} className="btn-ghost inline-flex items-center gap-2">
          <Download className="h-4 w-4" />
          Export PDF
        </button>
        <button onClick={() => onExport('docx')} className="btn-ghost inline-flex items-center gap-2">
          <Download className="h-4 w-4" />
          Export DOCX
        </button>
        <button onClick={() => onExport('markdown')} className="btn-ghost inline-flex items-center gap-2">
          <Download className="h-4 w-4" />
          Export Markdown
        </button>
        <button onClick={onShare} className="btn-primary inline-flex items-center gap-2">
          <Share2 className="h-4 w-4" />
          Copy Share Link
        </button>
      </div>
    </div>
  )
}

function PlanTab({
  sections,
  onSave,
}: {
  sections: BusinessPlanSection[]
  onSave: (next: BusinessPlanSection[]) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<BusinessPlanSection[]>(sections)
  const [open, setOpen] = useState<string[]>(['executive_summary'])
  const [saving, setSaving] = useState(false)

  useEffect(() => setDraft(sections), [sections])

  const toggle = (key: string) =>
    setOpen((o) => (o.includes(key) ? o.filter((k) => k !== key) : [...o, key]))

  const save = async () => {
    setSaving(true)
    try {
      await onSave(draft)
      setEditing(false)
      toast.success('Business plan updated')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save changes')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{sections.length} sections · click a section to expand</p>
        {!editing ? (
          <button onClick={() => setEditing(true)} className="btn-ghost inline-flex items-center gap-2">
            <Pencil className="h-4 w-4" />
            Edit sections
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="btn-ghost inline-flex items-center gap-1.5">
              <X className="h-4 w-4" />
              Cancel
            </button>
            <button onClick={save} disabled={saving} className="btn-primary inline-flex items-center gap-1.5 disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Save
            </button>
          </div>
        )}
      </div>

      {draft.map((section, idx) => {
        const expanded = open.includes(section.key)
        return (
          <div
            key={section.key}
            className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-dark-300 dark:bg-dark-100"
          >
            <button
              onClick={() => toggle(section.key)}
              className="flex w-full items-center justify-between px-5 py-3.5 text-left"
            >
              <span className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                  {idx + 1}
                </span>
                <span className="font-bold">{section.title}</span>
              </span>
              <span className="text-gray-400">{expanded ? '−' : '+'}</span>
            </button>
            {expanded && (
              <div className="border-t border-gray-100 px-5 py-4 dark:border-dark-300">
                {editing ? (
                  <textarea
                    value={draft[idx].content}
                    onChange={(e) =>
                      setDraft((d) => d.map((s, i) => (i === idx ? { ...s, content: e.target.value } : s)))
                    }
                    rows={6}
                    className={`${inputCls} resize-y`}
                  />
                ) : (
                  <SectionBody content={section.content} />
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function PitchTab({ plan }: { plan: BusinessPlanRecord }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {plan.pitch_deck.map((slide, i) => (
        <div
          key={slide.key}
          className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100"
        >
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-brand text-xs font-bold text-white">
              {i + 1}
            </span>
            <h3 className="font-bold">{slide.title}</h3>
          </div>
          <ul className="mt-3 space-y-1.5">
            {slide.bullets.map((b, j) => (
              <li key={j} className="flex gap-2 text-sm text-gray-600 dark:text-gray-300">
                <span className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent/70" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
          {slide.note && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">{slide.note}</p>}
        </div>
      ))}
    </div>
  )
}

export function FinancialsTab({ plan }: { plan: BusinessPlanRecord }) {
  const fin = plan.financial_projection
  const monthly = useMemo(
    () =>
      fin.monthly_revenue.map((r, i) => ({
        month: `M${i + 1}`,
        Revenue: r,
        Expenses: fin.monthly_expenses[i],
        'Cash flow': fin.monthly_cash_flow[i],
        Cumulative: fin.cumulative_cash[i],
      })),
    [fin],
  )
  const useOfFunds = fin.use_of_funds.map((u) => ({ name: u.label, value: u.amount }))
  const expenseData = [
    { name: 'Salaries', value: fin.expense_breakdown.salaries },
    { name: 'Marketing', value: fin.expense_breakdown.marketing },
    { name: 'Infra & tools', value: fin.expense_breakdown.infrastructure_tools },
    { name: 'Operations', value: fin.expense_breakdown.operations },
    { name: 'Other', value: fin.expense_breakdown.other },
  ]
  const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ec4899', '#8b5cf6']

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Year-1 revenue" value={fmt(fin.year1_revenue)} accent />
        <StatCard label="Year-2 revenue" value={fmt(fin.year2_revenue)} accent />
        <StatCard label="Year-3 revenue" value={fmt(fin.year3_revenue)} accent />
        <StatCard label="Monthly budget" value={fmt(fin.monthly_budget)} />
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100">
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-400">Revenue vs Expenses (12 months)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthly} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
              <XAxis dataKey="month" fontSize={11} />
              <YAxis fontSize={11} tickFormatter={(v) => fmt(v)} />
              <Tooltip formatter={(v) => fmt(Number(v))} />
              <Legend />
              <Line type="monotone" dataKey="Revenue" stroke="#6366f1" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Expenses" stroke="#ef4444" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100">
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-400">Cumulative cash position</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthly} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                <XAxis dataKey="month" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v) => fmt(v)} />
                <Tooltip formatter={(v) => fmt(Number(v))} />
                <Area type="monotone" dataKey="Cumulative" stroke="#10b981" fill="#10b981" fillOpacity={0.25} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100">
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-400">Monthly expense breakdown</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie data={expenseData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                  {expenseData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => fmt(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </RePieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-400">
          <PieChart className="h-4 w-4" />
          Use of funds
        </h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={useOfFunds} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
              <XAxis dataKey="name" fontSize={10} />
              <YAxis fontSize={11} tickFormatter={(v) => fmt(v)} />
              <Tooltip formatter={(v) => fmt(Number(v))} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {useOfFunds.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {fin.use_of_funds.map((u) => (
            <div key={u.label} className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2 text-sm dark:bg-dark">
              <span className="text-gray-500">{u.label}</span>
              <span className="font-bold">
                {u.percent}% · {fmt(u.amount)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-400">Key assumptions</h3>
        <ul className="space-y-1.5">
          {fin.key_assumptions.map((a, i) => (
            <li key={i} className="flex gap-2 text-sm text-gray-600 dark:text-gray-300">
              <span className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary/60" />
              <span>{a}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export function TeamTab({ plan }: { plan: BusinessPlanRecord }) {
  return (
    <div className="space-y-3">
      {plan.team_recommendations.map((role) => (
        <div
          key={role.role}
          className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold">{role.role}</h3>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                x{role.count}
              </span>
              {role.remote_ok && (
                <span className="rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-bold text-teal-700 dark:bg-teal-500/15 dark:text-teal-400">
                  Remote OK
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-gray-500">{role.reason}</p>
          </div>
          <span className="text-xs font-semibold text-gray-400">{role.seniority}</span>
        </div>
      ))}
    </div>
  )
}

export function RecommendationsTab({ plan }: { plan: BusinessPlanRecord }) {
  const groups: { key: keyof typeof plan.ai_recommendations; title: string }[] = [
    { key: 'missing_features', title: 'Missing features to add' },
    { key: 'weaknesses', title: 'Current weaknesses' },
    { key: 'improvements', title: 'Improvements to make' },
    { key: 'risks', title: 'Risks to manage' },
    { key: 'scaling_plan', title: 'Scaling plan' },
    { key: 'internationalization', title: 'Internationalization' },
  ]
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {groups.map((g) => (
        <div key={g.key} className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100">
          <h3 className="mb-3 flex items-center gap-2 font-bold">
            <Lightbulb className="h-4 w-4 text-accent" />
            {g.title}
          </h3>
          <ul className="space-y-2">
            {(plan.ai_recommendations[g.key] ?? []).map((item, i) => (
              <li key={i} className="flex gap-2 text-sm text-gray-600 dark:text-gray-300">
                <span className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent/70" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

export default function BusinessPlanViewer() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [plan, setPlan] = useState<BusinessPlanRecord | null>(null)
  const [tab, setTab] = useState<TabKey>('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError('')
    try {
      const data = await getBusinessPlan(id)
      setPlan(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load business plan')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const handleExport = async (format: 'pdf' | 'docx' | 'markdown') => {
    if (!plan) return
    try {
      await downloadBusinessPlanExport(plan.id, format, plan.startup_name)
      toast.success(`Exported ${format.toUpperCase()}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Could not export ${format}`)
    }
  }

  const handleShare = () => {
    if (!plan) return
    const url = buildShareUrl(plan)
    if (!url) {
      toast.error('No share link available for this plan')
      return
    }
    navigator.clipboard?.writeText(url).catch(() => {})
    toast.success('Share link copied to clipboard')
  }

  const handleSaveSections = async (next: BusinessPlanSection[]) => {
    if (!plan) return
    const updated = await updateBusinessPlan(plan.id, { business_plan: next })
    setPlan(updated)
  }

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-4xl items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !plan) {
    return (
      <div className="mx-auto w-full max-w-4xl">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          {error || 'Business plan not found'}
        </div>
        <button onClick={() => navigate('/business-plan')} className="btn-ghost mt-4">
          Back to plans
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-6">
        <button
          onClick={() => navigate('/business-plan')}
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-gray-400 transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          All plans
        </button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-extrabold">{plan.startup_name}</h1>
            <p className="mt-1 line-clamp-2 max-w-2xl text-sm text-gray-500">{plan.idea}</p>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
            <LayoutDashboard className="h-3.5 w-3.5" />
            {plan.provider === 'ai' ? 'AI enhanced' : 'Auto-generated'}
          </span>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-1.5 overflow-x-auto rounded-2xl border border-gray-200 bg-white p-1.5 dark:border-dark-300 dark:bg-dark-100">
        {TABS.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors ${
                tab === t.key
                  ? 'bg-gradient-brand text-white'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-dark-300 dark:hover:text-gray-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'overview' && <OverviewTab plan={plan} onExport={handleExport} onShare={handleShare} />}
      {tab === 'plan' && <PlanTab sections={plan.business_plan} onSave={handleSaveSections} />}
      {tab === 'pitch' && <PitchTab plan={plan} />}
      {tab === 'financials' && <FinancialsTab plan={plan} />}
      {tab === 'team' && <TeamTab plan={plan} />}
      {tab === 'recommendations' && <RecommendationsTab plan={plan} />}
    </div>
  )
}
