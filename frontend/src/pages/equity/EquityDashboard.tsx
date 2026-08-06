import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import {
  BarChart3,
  Briefcase,
  Coins,
  Download,
  FileDown,
  Loader2,
  PieChart as PieIcon,
  Plus,
  Scale,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import { AppHeader } from '../../components/AppHeader'
import { EmptyState } from '../../components/EmptyState'
import {
  EQUITY_HOLDER_TYPES,
  INVESTMENT_ROUND_TYPES,
  ROUND_STATUSES,
  SCHEDULE_TYPES,
  SHARE_CLASS_TYPES,
  VESTING_FREQUENCIES,
  addHolder,
  addInvestmentRound,
  addShareClass,
  deleteHolder,
  deleteInvestmentRound,
  deleteShareClass,
  downloadEquityPdf,
  getEquityDashboard,
  runDilution,
  saveEquityCapTable,
  updateInvestmentRound,
} from '../../lib/equity'
import { formatDate } from '../../lib/helpers'
import type {
  DilutionResult,
  EquityDashboardResponse,
  EquityHolder,
  EquityHolderType,
  InvestmentRound,
  InvestmentRoundStatus,
  RoundType,
  ScheduleType,
  ShareClass,
  ShareClassDef,
  VestingFrequency,
} from '../../types'
import type { LucideIcon } from 'lucide-react'

const TYPE_LABELS: Record<EquityHolderType, string> = {
  founder: 'Founder',
  investor: 'Investor',
  employee: 'Employee',
  advisor: 'Advisor',
  esop: 'ESOP Pool',
  other: 'Other',
}

const TYPE_CHIP: Record<EquityHolderType, string> = {
  founder: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  investor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  employee: 'bg-green-500/10 text-green-600 dark:text-green-400',
  advisor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  esop: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
  other: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
}

const TYPE_BAR: Record<EquityHolderType, string> = {
  founder: '#7C3AED',
  investor: '#185FA5',
  employee: '#0F6E56',
  advisor: '#B45309',
  esop: '#0D9488',
  other: '#52525B',
}

const CLASS_BAR: Record<ShareClass, string> = {
  common: '#7C3AED',
  preferred: '#185FA5',
  options: '#0F6E56',
  warrants: '#B45309',
}

const ROUND_TYPE_LABELS: Record<string, string> = {
  pre_seed: 'Pre-Seed',
  seed: 'Seed',
  series_a: 'Series A',
  series_b: 'Series B',
  series_c: 'Series C',
  bridge: 'Bridge',
  angel: 'Angel',
  grant: 'Grant',
  other: 'Other',
}

function formatCurrency(n: number | null | undefined) {
  if (n == null) return '—'
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  wide = false,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className={`max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-gray-200 bg-white p-6 dark:border-dark-300 dark:bg-dark-100 sm:rounded-3xl ${
              wide ? 'max-w-2xl' : 'max-w-lg'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-extrabold">{title}</h2>
                {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function StatCard({ icon: Icon, label, value, tint }: { icon: LucideIcon; label: string; value: string; tint: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-dark-300 dark:bg-dark-100">
      <div className="flex items-center gap-2 text-gray-400">
        <Icon className="h-4 w-4" />
        <p className="text-xs font-semibold uppercase tracking-wide">{label}</p>
      </div>
      <p className={`mt-1.5 text-lg font-extrabold ${tint}`}>{value}</p>
    </div>
  )
}

const inputCls =
  'w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark'

export default function EquityDashboardPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<EquityDashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [holderOpen, setHolderOpen] = useState(false)
  const [roundOpen, setRoundOpen] = useState(false)
  const [classOpen, setClassOpen] = useState(false)
  const [dilutionOpen, setDilutionOpen] = useState(false)
  const [editingTotal, setEditingTotal] = useState(false)
  const [totalDraft, setTotalDraft] = useState('')
  const [esopDraft, setEsopDraft] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setLoadError(null)
    try {
      const res = await getEquityDashboard(id)
      setData(res)
      if (res.cap_table) {
        setTotalDraft(String(res.cap_table.total_shares))
        setEsopDraft(String(res.cap_table.esop_pool_shares ?? 0))
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load cap table')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const canManage = data?.can_manage ?? false
  const totalShares = data?.summary?.total_shares ?? 0
  const holders = useMemo(() => data?.holders ?? [], [data])
  const rounds = data?.rounds ?? []
  const shareClasses = data?.share_classes ?? []
  const summary = data?.summary

  const saveSettings = async () => {
    const total = Number(totalDraft)
    if (!total || total <= 0) {
      toast.error('Total shares must be a positive number')
      return
    }
    const esop = Number(esopDraft) || 0
    await saveEquityCapTable(id!, { total_shares: total, esop_pool_shares: esop })
    toast.success('Cap table settings updated')
    setEditingTotal(false)
    load()
  }

  const exportCsv = () => {
    if (!data) return
    const headers = ['Name', 'Title', 'Type', 'Class', 'Shares', 'Ownership %', 'Investment', 'Vesting']
    const rows = holders.map((h) => [
      h.name,
      h.title ?? '',
      TYPE_LABELS[h.holder_type] ?? h.holder_type,
      h.share_class_name ?? '',
      h.shares,
      h.ownership_pct.toFixed(2) + '%',
      h.investment_amount ? '$' + h.investment_amount.toLocaleString() : '',
      h.vesting_schedules[0]
        ? `${h.vesting_schedules[0].cliff_months ?? 0}mo cliff / ${h.vesting_schedules[0].total_months ?? 0}mo total`
        : '',
    ])
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(data.startup.name || 'startup').toLowerCase().replace(/\s+/g, '_')}_cap_table.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportPdf = async () => {
    if (!data) return
    try {
      await downloadEquityPdf(data.startup.id, data.startup.name)
      toast.success('Cap table PDF downloaded')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to export PDF')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark">
        <AppHeader title="Equity & Cap Table" backTo={id ? `/startups/${id}` : '/dashboard'} backLabel="Back to Startup" />
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <div className="h-8 w-56 animate-pulse rounded-lg bg-gray-200 dark:bg-dark-200" />
          <div className="mt-8 grid gap-4 sm:grid-cols-4">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-gray-200 dark:bg-dark-200" />
            ))}
          </div>
        </main>
      </div>
    )
  }

  if (loadError || !data) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark">
        <AppHeader title="Equity & Cap Table" backTo={id ? `/startups/${id}` : '/dashboard'} backLabel="Back to Startup" />
        <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
          <EmptyState icon={PieIcon} title="Cap table unavailable" description={loadError ?? 'Something went wrong.'} />
        </main>
      </div>
    )
  }

  const typeBreakdown = EQUITY_HOLDER_TYPES.map((t) => ({
    type: t.value,
    label: t.label,
    shares: summary?.by_holder_type[t.value]?.shares ?? 0,
    pct: summary?.by_holder_type[t.value]?.pct ?? 0,
  })).filter((t) => t.shares > 0)

  return (
    <div className="min-h-screen bg-gray-50 pb-24 dark:bg-dark lg:pb-0">
      <AppHeader title="Equity & Cap Table" backTo={`/startups/${id}`} backLabel="Back to Startup" />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Scale className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-xl font-extrabold">{data.startup.name} — Equity & Cap Table</h1>
              {data.cap_table?.last_updated && (
                <p className="text-sm text-gray-500">Last updated {formatDate(data.cap_table.last_updated)}</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={exportCsv} className="btn-ghost">
              <Download className="h-4 w-4" /> CSV
            </button>
            <button onClick={exportPdf} className="btn-ghost">
              <FileDown className="h-4 w-4" /> PDF
            </button>
            <button onClick={() => setDilutionOpen(true)} className="btn-ghost">
              <TrendingUp className="h-4 w-4" /> Dilution Calc
            </button>
            {canManage && (
              <>
                <button onClick={() => setClassOpen(true)} className="btn-ghost">
                  <Plus className="h-4 w-4" /> Share Class
                </button>
                <button onClick={() => setRoundOpen(true)} className="btn-ghost">
                  <Wallet className="h-4 w-4" /> Round
                </button>
                <button onClick={() => setHolderOpen(true)} className="btn-primary">
                  <Plus className="h-4 w-4" /> Add Holder
                </button>
              </>
            )}
          </div>
        </div>

        {/* Summary stats */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon={Users} label="Holders" value={String(holders.length)} tint="text-primary" />
          <StatCard icon={BarChart3} label="Allocated" value={`${summary?.allocated_pct ?? 0}%`} tint="text-green-600 dark:text-green-400" />
          <StatCard icon={Coins} label="Valuation" value={formatCurrency(summary?.valuation)} tint="text-accent" />
          <StatCard icon={TrendingUp} label="ESOP pool" value={`${summary?.esop_pct ?? 0}%`} tint="text-teal-600 dark:text-teal-400" />
          <StatCard icon={Briefcase} label="Founders" value={`${summary?.founder_pct ?? 0}%`} tint="text-purple-600 dark:text-purple-400" />
          <StatCard icon={Wallet} label="Investors" value={`${summary?.investor_pct ?? 0}%`} tint="text-blue-600 dark:text-blue-400" />
          <StatCard icon={Users} label="Employees" value={`${summary?.employee_pct ?? 0}%`} tint="text-green-600 dark:text-green-400" />
          <StatCard icon={BarChart3} label="Unallocated" value={`${summary?.unallocated_pct ?? 0}%`} tint="text-gray-600 dark:text-gray-400" />
        </div>

        {/* Total shares + ESOP */}
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-dark-300 dark:bg-dark-100">
          <BarChart3 className="h-5 w-5 text-primary" />
          {editingTotal && canManage ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-500">Total shares</span>
                <input
                  type="number"
                  value={totalDraft}
                  onChange={(e) => setTotalDraft(e.target.value)}
                  className="w-40 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm outline-none focus:border-primary dark:border-dark-300 dark:bg-dark"
                />
                <span className="text-xs font-semibold text-gray-500">ESOP pool</span>
                <input
                  type="number"
                  value={esopDraft}
                  onChange={(e) => setEsopDraft(e.target.value)}
                  className="w-40 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm outline-none focus:border-primary dark:border-dark-300 dark:bg-dark"
                />
                <button onClick={saveSettings} className="btn-primary !px-3 !py-1.5 text-xs">
                  Save
                </button>
                <button onClick={() => setEditingTotal(false)} className="btn-ghost !px-3 !py-1.5 text-xs">
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-500">Total shares</p>
              <p className="text-base font-extrabold">{totalShares.toLocaleString()}</p>
              <p className="text-sm text-gray-500">· ESOP pool</p>
              <p className="text-base font-extrabold text-teal-600 dark:text-teal-400">
                {(summary?.esop_pool_shares ?? 0).toLocaleString()}
              </p>
              {canManage && (
                <button onClick={() => setEditingTotal(true)} className="btn-ghost !px-3 !py-1.5 text-xs">
                  Edit
                </button>
              )}
            </>
          )}
          <p className="ml-auto text-sm text-gray-500">
            Sum of ownership:{' '}
            <span className={`font-bold ${(summary?.allocated_pct ?? 0) > 99.5 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
              {summary?.allocated_pct ?? 0}%
            </span>
          </p>
        </div>

        {/* Charts */}
        {holders.length > 0 && (
          <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 dark:border-dark-300 dark:bg-dark-100">
            <h2 className="mb-4 flex items-center gap-2 text-base font-bold">
              <PieIcon className="h-4 w-4 text-primary" /> Ownership breakdown
            </h2>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={holders.map((h) => ({
                        name: h.name,
                        value: Number(h.ownership_pct.toFixed(2)),
                        type: h.holder_type,
                      }))}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={110}
                      label={({ name, value }: { name?: string; value?: number }) => `${name}: ${value}%`}
                      labelLine={false}
                    >
                      {holders.map((h) => (
                        <Cell key={h.id} fill={TYPE_BAR[h.holder_type] ?? '#52525B'} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${value}%`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col justify-center gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">By holder type</p>
                  <div className="mt-2 flex h-3 w-full overflow-hidden rounded-full">
                    {typeBreakdown.map((t) => (
                      <div key={t.type} style={{ width: `${t.pct}%`, background: TYPE_BAR[t.type] }} title={`${t.label}: ${t.pct}%`} />
                    ))}
                    {(summary?.unallocated_pct ?? 0) > 0 && (
                      <div
                        style={{ width: `${summary?.unallocated_pct}%`, background: '#CBD5E1' }}
                        className="dark:opacity-40"
                        title={`Unallocated: ${summary?.unallocated_pct}%`}
                      />
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3">
                    {typeBreakdown.map((t) => (
                      <span key={t.type} className="flex items-center gap-1.5 text-xs text-gray-500">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: TYPE_BAR[t.type] }} />
                        {t.label} {t.pct}%
                      </span>
                    ))}
                    {(summary?.unallocated_pct ?? 0) > 0 && (
                      <span className="flex items-center gap-1.5 text-xs text-gray-500">
                        <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                        Unallocated {summary?.unallocated_pct}%
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">By share class</p>
                  <div className="mt-2 flex h-3 w-full overflow-hidden rounded-full">
                    {Object.values(summary?.by_share_class ?? {}).map((c) => (
                      <div
                        key={c.name}
                        style={{ width: `${c.pct}%`, background: CLASS_BAR[c.class_type] ?? '#52525B' }}
                        title={`${c.name}: ${c.pct}%`}
                      />
                    ))}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3">
                    {Object.values(summary?.by_share_class ?? {}).map((c) => (
                      <span key={c.name} className="flex items-center gap-1.5 text-xs text-gray-500">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: CLASS_BAR[c.class_type] ?? '#52525B' }} />
                        {c.name} {c.pct}%
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Share classes */}
        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-bold">
              <Scale className="h-4 w-4 text-primary" /> Share classes
            </h2>
          </div>
          {shareClasses.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">No share classes yet. Add one to start.</p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {shareClasses.map((c) => (
                <div key={c.id} className="rounded-xl border border-gray-200 p-4 dark:border-dark-300">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold">{c.name}</p>
                      <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${TYPE_CHIP_CLASS(c.class_type)}`}>
                        {c.class_type}
                      </span>
                    </div>
                    {canManage && (
                      <button
                        onClick={async () => {
                          if (!window.confirm(`Delete the "${c.name}" share class?`)) return
                          try {
                            await deleteShareClass(c.id)
                            toast.success('Share class deleted')
                            load()
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : 'Failed to delete')
                          }
                        }}
                        className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-gray-400">Par value</p>
                      <p className="font-semibold">${c.par_value ?? 0.0001}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Liquidation pref</p>
                      <p className="font-semibold">{c.liquidation_preference ?? 1}x</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Voting</p>
                      <p className="font-semibold">{c.voting_rights ? 'Yes' : 'No'}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Ownership</p>
                      <p className="font-semibold text-primary">{summary?.by_share_class[c.id]?.pct ?? 0}%</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Holders table */}
        <section className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-dark-300 dark:bg-dark-100">
          <div className="border-b border-gray-100 px-5 py-3.5 dark:border-dark-300">
            <h2 className="text-base font-bold">Equity holders</h2>
          </div>
          {holders.length === 0 ? (
            <div className="p-10 text-center">
              <Users className="mx-auto h-10 w-10 text-gray-400" />
              <p className="mt-3 text-sm text-gray-500">
                {canManage ? 'Add your first equity holder to build the cap table.' : 'No equity holders listed yet.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400 dark:border-dark-300">
                    <th className="px-5 py-3 font-semibold">Name</th>
                    <th className="px-3 py-3 font-semibold">Type</th>
                    <th className="px-3 py-3 font-semibold">Class</th>
                    <th className="px-3 py-3 text-right font-semibold">Shares</th>
                    <th className="px-3 py-3 text-right font-semibold">Ownership %</th>
                    <th className="px-3 py-3 text-right font-semibold">Investment</th>
                    <th className="px-3 py-3 font-semibold">Vesting</th>
                    <th className="px-3 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-dark-300">
                  {holders.map((h) => (
                    <tr key={h.id} className="align-top hover:bg-gray-50 dark:hover:bg-dark-200">
                      <td className="px-5 py-3">
                        <p className="font-bold">{h.name}</p>
                        <p className="mt-0.5 text-xs text-gray-500">{h.title ?? h.email ?? h.notes}</p>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${TYPE_CHIP[h.holder_type]}`}>
                          {TYPE_LABELS[h.holder_type] ?? h.holder_type}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs font-semibold">{h.share_class_name ?? '—'}</td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums">{h.shares.toLocaleString()}</td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums text-primary">{h.ownership_pct.toFixed(2)}%</td>
                      <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(h.investment_amount)}</td>
                      <td className="px-3 py-3">
                        <VestingCell holder={h} />
                      </td>
                      <td className="px-3 py-3">
                        {canManage && (
                          <button
                            onClick={async () => {
                              if (!window.confirm(`Remove ${h.name} from the cap table?`)) return
                              await deleteHolder(h.id)
                              toast.success('Holder removed')
                              load()
                            }}
                            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Investment rounds */}
        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-bold">
              <Wallet className="h-4 w-4 text-primary" /> Investment rounds
            </h2>
          </div>
          {rounds.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">No investment rounds yet.</p>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {rounds.map((r) => (
                <RoundCard key={r.id} round={r} canManage={canManage} onChanged={load} />
              ))}
            </div>
          )}
        </section>
      </main>

      {canManage && (
        <>
          <AddHolderModal
            open={holderOpen}
            onClose={() => setHolderOpen(false)}
            shareClasses={shareClasses}
            defaultCliff={data.cap_table?.default_vesting_cliff_months ?? 12}
            defaultTotal={data.cap_table?.default_vesting_total_months ?? 48}
            onSubmit={async (payload) => {
              if (!id) return
              await addHolder(id, payload)
              toast.success('Equity holder added')
              setHolderOpen(false)
              load()
            }}
          />
          <AddRoundModal
            open={roundOpen}
            onClose={() => setRoundOpen(false)}
            onSubmit={async (payload) => {
              if (!id) return
              await addInvestmentRound(id, payload)
              toast.success('Investment round added')
              setRoundOpen(false)
              load()
            }}
          />
          <AddClassModal
            open={classOpen}
            onClose={() => setClassOpen(false)}
            onSubmit={async (payload) => {
              if (!id) return
              await addShareClass(id, payload)
              toast.success('Share class added')
              setClassOpen(false)
              load()
            }}
          />
        </>
      )}
      <DilutionModal open={dilutionOpen} onClose={() => setDilutionOpen(false)} startupId={data.startup.id} />

      {!canManage && (
        <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
          You're viewing this cap table through data room access. Only the startup founder can make changes.
        </div>
      )}
    </div>
  )
}

function TYPE_CHIP_CLASS(t: ShareClass): string {
  switch (t) {
    case 'preferred':
      return 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
    case 'options':
      return 'bg-green-500/10 text-green-600 dark:text-green-400'
    case 'warrants':
      return 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
    default:
      return 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
  }
}

// ---------------------------------------------------------------------------
// Vesting cell
// ---------------------------------------------------------------------------

function VestingCell({ holder }: { holder: EquityHolder }) {
  const sched = holder.vesting_schedules[0]
  if (!sched) {
    return <span className="text-xs text-gray-400">None</span>
  }
  const pct = Math.min(100, Math.max(0, holder.vested_pct))
  return (
    <div className="w-36">
      <div className="flex items-center justify-between text-[10px] text-gray-500">
        <span>{holder.vested_shares != null ? `${holder.vested_shares.toLocaleString()} / ${holder.shares.toLocaleString()} vested` : 'Not started'}</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-dark-300">
        <div className="h-full rounded-full bg-green-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-[10px] text-gray-400">
        {sched.cliff_months ?? 0}mo cliff · {sched.total_months ?? 0}mo total · {sched.vesting_frequency}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Add holder modal
// ---------------------------------------------------------------------------

function AddHolderModal({
  open,
  onClose,
  shareClasses,
  defaultCliff,
  defaultTotal,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  shareClasses: ShareClassDef[]
  defaultCliff: number
  defaultTotal: number
  onSubmit: (payload: {
    name: string
    email: string | null
    title: string | null
    holder_type: EquityHolderType
    share_class_id: string | null
    shares: number
    investment_amount: number | null
    investment_date: string | null
    notes: string | null
    vesting: {
      schedule_type: ScheduleType
      start_date: string | null
      cliff_months: number | null
      total_months: number | null
      vesting_frequency: VestingFrequency
      exercise_price: number | null
    } | null
  }) => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [title, setTitle] = useState('')
  const [type, setType] = useState<EquityHolderType>('founder')
  const [classId, setClassId] = useState(shareClasses[0]?.id ?? '')
  const [shares, setShares] = useState('')
  const [investment, setInvestment] = useState('')
  const [investDate, setInvestDate] = useState('')
  const [notes, setNotes] = useState('')
  const [vesting, setVesting] = useState(false)
  const [schedType, setSchedType] = useState<ScheduleType>('standard')
  const [vestStart, setVestStart] = useState('')
  const [cliff, setCliff] = useState(defaultCliff)
  const [totalMonths, setTotalMonths] = useState(defaultTotal)
  const [frequency, setFrequency] = useState<VestingFrequency>('monthly')
  const [exercisePrice, setExercisePrice] = useState('')
  const [saving, setSaving] = useState(false)

  const sharesNum = Number(shares) || 0

  const submit = async () => {
    if (!name.trim() || sharesNum <= 0) {
      toast.error('Name and shares are required')
      return
    }
    setSaving(true)
    try {
      await onSubmit({
        name: name.trim(),
        email: email.trim() || null,
        title: title.trim() || null,
        holder_type: type,
        share_class_id: classId || null,
        shares: sharesNum,
        investment_amount: investment ? Number(investment) : null,
        investment_date: investDate || null,
        notes: notes.trim() || null,
        vesting: vesting
          ? {
              schedule_type: schedType,
              start_date: vestStart || null,
              cliff_months: cliff,
              total_months: totalMonths,
              vesting_frequency: frequency,
              exercise_price: exercisePrice ? Number(exercisePrice) : null,
            }
          : null,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add holder')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Equity Holder" subtitle="Ownership % is calculated automatically" wide>
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Full name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sarah Chen" className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Role / title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. CTO" className={inputCls} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Email (optional)</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="sarah@startup.com" className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as EquityHolderType)} className={`${inputCls} cursor-pointer`}>
              {EQUITY_HOLDER_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Number of shares</label>
            <input type="number" value={shares} onChange={(e) => setShares(e.target.value)} placeholder="e.g. 1000000" className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Share class</label>
            <select value={classId} onChange={(e) => setClassId(e.target.value)} className={`${inputCls} cursor-pointer`}>
              {shareClasses.length === 0 && <option value="">No classes yet</option>}
              {shareClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Investment ($, optional)</label>
            <input type="number" value={investment} onChange={(e) => setInvestment(e.target.value)} placeholder="e.g. 250000" className={inputCls} />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold">Investment date</label>
          <input type="date" value={investDate} onChange={(e) => setInvestDate(e.target.value)} className={inputCls} />
        </div>

        <div className="rounded-xl border border-gray-200 p-4 dark:border-dark-300">
          <label className="flex cursor-pointer items-center justify-between">
            <span className="text-sm font-semibold">Vesting schedule</span>
            <input type="checkbox" checked={vesting} onChange={(e) => setVesting(e.target.checked)} className="h-4 w-4 accent-primary" />
          </label>
          {vesting && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-500">Schedule type</label>
                <select value={schedType} onChange={(e) => setSchedType(e.target.value as ScheduleType)} className={`${inputCls} cursor-pointer`}>
                  {SCHEDULE_TYPES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-500">Start date</label>
                <input type="date" value={vestStart} onChange={(e) => setVestStart(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-500">Cliff (months)</label>
                <input type="number" value={cliff} onChange={(e) => setCliff(Number(e.target.value))} className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-500">Total (months)</label>
                <input type="number" value={totalMonths} onChange={(e) => setTotalMonths(Number(e.target.value))} className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-500">Frequency</label>
                <select value={frequency} onChange={(e) => setFrequency(e.target.value as VestingFrequency)} className={`${inputCls} cursor-pointer`}>
                  {VESTING_FREQUENCIES.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-500">Exercise price ($, options only)</label>
                <input type="number" value={exercisePrice} onChange={(e) => setExercisePrice(e.target.value)} placeholder="e.g. 0.25" className={inputCls} />
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold">Notes (optional)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="e.g. Technical co-founder" className={`${inputCls} resize-none`} />
        </div>

        <button onClick={submit} disabled={saving} className="btn-primary w-full disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add Holder
        </button>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Add round modal
// ---------------------------------------------------------------------------

function AddRoundModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (payload: {
    round_name: string
    round_type: RoundType
    target_amount: number | null
    pre_money_valuation: number | null
    post_money_valuation: number | null
    new_shares_issued: number | null
    share_price: number | null
    status: InvestmentRoundStatus
    open_date: string | null
    close_date: string | null
  }) => void
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState<RoundType>('seed')
  const [status, setStatus] = useState<InvestmentRoundStatus>('planned')
  const [target, setTarget] = useState('')
  const [preMoney, setPreMoney] = useState('')
  const [newShares, setNewShares] = useState('')
  const [openDate, setOpenDate] = useState('')
  const [closeDate, setCloseDate] = useState('')
  const [saving, setSaving] = useState(false)

  const targetNum = Number(target) || 0
  const preNum = Number(preMoney) || 0
  const postNum = targetNum + preNum

  const submit = async () => {
    if (!name.trim()) {
      toast.error('Round name is required')
      return
    }
    setSaving(true)
    try {
      await onSubmit({
        round_name: name.trim(),
        round_type: type,
        target_amount: target ? targetNum : null,
        pre_money_valuation: preMoney ? preNum : null,
        post_money_valuation: preMoney ? postNum : null,
        new_shares_issued: newShares ? Number(newShares) : null,
        share_price: preNum > 0 && postNum > 0 ? Number((preNum / postNum).toFixed(4)) : null,
        status,
        open_date: openDate || null,
        close_date: closeDate || null,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add round')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Investment Round" subtitle="Post-money auto-calculates from target + pre-money" wide>
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Round name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Seed Round" className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Round type</label>
            <select value={type} onChange={(e) => setType(e.target.value as RoundType)} className={`${inputCls} cursor-pointer`}>
              {INVESTMENT_ROUND_TYPES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Target amount ($)</label>
            <input type="number" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="e.g. 500000" className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Pre-money valuation ($)</label>
            <input type="number" value={preMoney} onChange={(e) => setPreMoney(e.target.value)} placeholder="e.g. 2000000" className={inputCls} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Post-money (auto)</label>
            <div className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5 text-sm font-bold text-primary">
              {formatCurrency(preNum ? postNum : 0)}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold">New shares issued</label>
            <input type="number" value={newShares} onChange={(e) => setNewShares(e.target.value)} placeholder="e.g. 1250000" className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as InvestmentRoundStatus)} className={`${inputCls} cursor-pointer`}>
              {ROUND_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Open date</label>
            <input type="date" value={openDate} onChange={(e) => setOpenDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Close date</label>
            <input type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} className={inputCls} />
          </div>
        </div>
        <button onClick={submit} disabled={saving} className="btn-primary w-full disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add Round
        </button>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Add share class modal
// ---------------------------------------------------------------------------

function AddClassModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (payload: {
    name: string
    class_type: ShareClass
    par_value: number | null
    liquidation_preference: number | null
    voting_rights: boolean
    conversion_ratio: number | null
  }) => void
}) {
  const [name, setName] = useState('')
  const [classType, setClassType] = useState<ShareClass>('common')
  const [parValue, setParValue] = useState('0.0001')
  const [liqPref, setLiqPref] = useState('1')
  const [voting, setVoting] = useState(true)
  const [conversion, setConversion] = useState('1')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!name.trim()) {
      toast.error('Share class name is required')
      return
    }
    setSaving(true)
    try {
      await onSubmit({
        name: name.trim(),
        class_type: classType,
        par_value: parValue ? Number(parValue) : null,
        liquidation_preference: liqPref ? Number(liqPref) : null,
        voting_rights: voting,
        conversion_ratio: conversion ? Number(conversion) : null,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add share class')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Share Class" subtitle="Define the rights attached to a class of shares">
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Series A Preferred" className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Class type</label>
            <select value={classType} onChange={(e) => setClassType(e.target.value as ShareClass)} className={`${inputCls} cursor-pointer`}>
              {SHARE_CLASS_TYPES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Par value ($)</label>
            <input type="number" step="0.0001" value={parValue} onChange={(e) => setParValue(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Liquidation pref</label>
            <input type="number" step="0.1" value={liqPref} onChange={(e) => setLiqPref(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Conversion ratio</label>
            <input type="number" step="0.1" value={conversion} onChange={(e) => setConversion(e.target.value)} className={inputCls} />
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={voting} onChange={(e) => setVoting(e.target.checked)} className="h-4 w-4 accent-primary" />
          Voting rights
        </label>
        <button onClick={submit} disabled={saving} className="btn-primary w-full disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add Share Class
        </button>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Dilution calculator modal
// ---------------------------------------------------------------------------

function DilutionModal({ open, onClose, startupId }: { open: boolean; onClose: () => void; startupId: string }) {
  const [raise, setRaise] = useState('')
  const [preMoney, setPreMoney] = useState('')
  const [result, setResult] = useState<DilutionResult | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setRaise('')
      setPreMoney('')
      setResult(null)
      setError(null)
    }
  }, [open])

  const run = async () => {
    const raiseNum = Number(raise)
    const preNum = Number(preMoney)
    if (!raiseNum || raiseNum <= 0) {
      toast.error('Enter a raise amount')
      return
    }
    if (!preNum || preNum <= 0) {
      toast.error('Enter a pre-money valuation')
      return
    }
    setRunning(true)
    setError(null)
    try {
      const res = await runDilution(startupId, { raise_amount: raiseNum, pre_money_valuation: preNum })
      setResult(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run dilution')
    } finally {
      setRunning(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Dilution Calculator" subtitle="See how a new round dilutes every current holder" wide>
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Raise amount ($)</label>
            <input type="number" value={raise} onChange={(e) => setRaise(e.target.value)} placeholder="e.g. 1000000" className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Pre-money valuation ($)</label>
            <input type="number" value={preMoney} onChange={(e) => setPreMoney(e.target.value)} placeholder="e.g. 5000000" className={inputCls} />
          </div>
        </div>
        <button onClick={run} disabled={running} className="btn-primary w-full disabled:opacity-60">
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Calculate Dilution
        </button>

        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">{error}</p>}

        {result && (
          <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-dark-300">
            <div className="grid grid-cols-3 gap-3 border-b border-gray-100 bg-gray-50 p-4 dark:border-dark-300 dark:bg-dark-200">
              <div>
                <p className="text-xs text-gray-400">New shares</p>
                <p className="text-sm font-extrabold">{result.new_shares.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">New total</p>
                <p className="text-sm font-extrabold">{result.new_total.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">New investor</p>
                <p className="text-sm font-extrabold text-primary">{result.investor_pct}%</p>
              </div>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400 dark:border-dark-300">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Holder</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Before</th>
                  <th className="px-4 py-2.5 text-right font-semibold">After</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Dilution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-dark-300">
                {result.holders.map((h) => (
                  <tr key={h.id}>
                    <td className="px-4 py-2.5 font-medium">{h.name}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{h.before_pct}%</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{h.after_pct}%</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-red-500 tabular-nums">-{h.dilution_pp}pp</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Round card
// ---------------------------------------------------------------------------

function RoundCard({
  round,
  canManage,
  onChanged,
}: {
  round: InvestmentRound
  canManage: boolean
  onChanged: () => void
}) {
  const target = round.target_amount ?? 0
  const raised = round.raised_amount ?? 0
  const pct = target > 0 ? Math.min(100, Math.max(0, (raised / target) * 100)) : 0

  return (
    <div className="rounded-2xl border border-gray-200 p-5 dark:border-dark-300">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold">{round.round_name}</h3>
          <p className="text-xs text-gray-500">{ROUND_TYPE_LABELS[round.round_type] ?? round.round_type}</p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
            round.status === 'closed'
              ? 'bg-green-500/10 text-green-600 dark:text-green-400'
              : round.status === 'cancelled'
                ? 'bg-red-500/10 text-red-500'
                : round.status === 'planned'
                  ? 'bg-gray-500/10 text-gray-500'
                  : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
          }`}
        >
          {round.status}
        </span>
      </div>

      {target > 0 && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>
              Raised {formatCurrency(raised)} of {formatCurrency(target)}
            </span>
            <span className="font-bold">{pct.toFixed(0)}%</span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-dark-300">
            <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-gray-400">Pre-money</p>
          <p className="font-bold">{formatCurrency(round.pre_money_valuation)}</p>
        </div>
        <div>
          <p className="text-gray-400">Post-money</p>
          <p className="font-bold">{formatCurrency(round.post_money_valuation)}</p>
        </div>
        <div>
          <p className="text-gray-400">New shares</p>
          <p className="font-bold">{round.new_shares_issued != null ? round.new_shares_issued.toLocaleString() : '—'}</p>
        </div>
      </div>

      {canManage && (
        <div className="mt-4 flex gap-2">
          {round.status === 'open' && (
            <button
              onClick={async () => {
                await updateInvestmentRound(round.id, { status: 'closed', close_date: new Date().toISOString().slice(0, 10) })
                toast.success('Round closed')
                onChanged()
              }}
              className="btn-ghost !px-3 !py-1.5 text-xs"
            >
              Mark Closed
            </button>
          )}
          <button
            onClick={async () => {
              if (!window.confirm(`Delete the ${round.round_name}?`)) return
              await deleteInvestmentRound(round.id)
              toast.success('Round deleted')
              onChanged()
            }}
            className="btn-ghost !px-3 !py-1.5 text-xs !text-red-500"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  )
}
