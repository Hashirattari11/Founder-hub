import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  Sparkles,
  Square,
  TrendingUp,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import { AppHeader } from '../../components/AppHeader'
import { EmptyState } from '../../components/EmptyState'
import { useSession } from '../../context/AuthContext'
import {
  HOLDER_TYPES,
  ROUND_TYPES,
  SHARE_CLASSES,
  addEntry,
  addRound,
  deleteEntry,
  deleteRound,
  getCapTable,
  saveCapTable,
  updateRound,
} from '../../lib/capTable'
import { formatDate } from '../../lib/helpers'
import type { CapTableEntry, CapTableResponse, FundingRound, HolderType, ShareClass } from '../../types'
import type { LucideIcon } from 'lucide-react'

const TYPE_LABELS: Record<HolderType, string> = {
  founder: 'Founder',
  investor: 'Investor',
  employee: 'Employee',
  advisor: 'Advisor',
  esop: 'ESOP Pool',
  other: 'Other',
}

const TYPE_CHIP: Record<HolderType, string> = {
  founder: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  investor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  employee: 'bg-green-500/10 text-green-600 dark:text-green-400',
  advisor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  esop: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
  other: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
}

const CHART_COLORS: Record<HolderType, string> = {
  founder: '#7C3AED',
  investor: '#185FA5',
  employee: '#0F6E56',
  advisor: '#854F0B',
  esop: '#085041',
  other: '#444441',
}

const ROUND_TYPE_LABELS: Record<string, string> = {
  pre_seed: 'Pre-Seed',
  seed: 'Seed',
  series_a: 'Series A',
  series_b: 'Series B',
  bridge: 'Bridge',
  angel: 'Angel',
  grant: 'Grant',
}

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8001'

const fmtMoney = (n: number | null | undefined) =>
  n == null ? '—' : `$${n.toLocaleString()}`

function formatCurrency(n: number | null | undefined) {
  if (n == null) return '—'
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

function calculateVested(entry: CapTableEntry): number | null {
  if (!entry.vesting_start || !entry.vesting_total_months) return null
  const now = new Date()
  const start = new Date(entry.vesting_start)
  const monthsElapsed = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30))
  const cliff = entry.vesting_cliff_months ?? 0
  if (monthsElapsed < cliff) return 0
  const vestedMonths = Math.min(monthsElapsed, entry.vesting_total_months)
  return Math.floor((vestedMonths / entry.vesting_total_months) * entry.shares)
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

export default function CapTablePage() {
  const { id } = useParams<{ id: string }>()

  const [data, setData] = useState<CapTableResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [shareholderOpen, setShareholderOpen] = useState(false)
  const [roundOpen, setRoundOpen] = useState(false)
  const [splitOpen, setSplitOpen] = useState(false)
  const [editingTotal, setEditingTotal] = useState(false)
  const [totalDraft, setTotalDraft] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setLoadError(null)
    try {
      const res = await getCapTable(id)
      setData(res)
      if (res.cap_table) setTotalDraft(String(res.cap_table.total_shares))
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load cap table')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const totalShares = data?.cap_table?.total_shares ?? 10_000_000
  const entries = useMemo(
    () => [...(data?.entries ?? [])].sort((a, b) => b.shares - a.shares),
    [data],
  )
  const canManage = data?.can_manage ?? false

  const stats = useMemo(() => {
    const investorShares = entries.filter((e) => e.holder_type === 'investor')
    const raised = investorShares.reduce((sum, e) => sum + (e.investment_amount ?? 0), 0)
    const esopShares = entries.filter((e) => e.holder_type === 'esop').reduce((sum, e) => sum + e.shares, 0)
    const founderPct = entries.find((e) => e.holder_type === 'founder')?.shares ?? 0
    const valuation = data?.rounds?.[0]?.post_money_valuation
    return {
      holders: entries.length,
      raised,
      valuation: valuation ?? (totalShares > 0 ? (founderPct / totalShares) * (10_000_000) : 0),
      esopPct: totalShares > 0 ? ((esopShares / totalShares) * 100).toFixed(1) : '0',
    }
  }, [entries, totalShares, data])

  const saveTotal = async () => {
    const value = Number(totalDraft)
    if (!value || value <= 0) {
      toast.error('Total shares must be a positive number')
      return
    }
    await saveCapTable(id!, { total_shares: value })
    toast.success('Total shares updated')
    setEditingTotal(false)
    load()
  }

  const exportCsv = () => {
    if (!data) return
    const headers = ['Name', 'Type', 'Shares', 'Ownership %', 'Investment', 'Share Class', 'Vesting']
    const rows = entries.map((e) => [
      e.holder_name,
      TYPE_LABELS[e.holder_type] ?? e.holder_type,
      e.shares,
      ((e.shares / totalShares) * 100).toFixed(2) + '%',
      e.investment_amount ? '$' + e.investment_amount.toLocaleString() : '-',
      e.share_class,
      e.vesting_total_months ? `${e.vesting_cliff_months ?? 0}mo cliff / ${e.vesting_total_months}mo total` : 'None',
    ])
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
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
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.text(`${data.startup.name} — Cap Table`, 14, 18)
    doc.setFontSize(10)
    doc.text(`Total shares: ${totalShares.toLocaleString()}   Updated: ${data.cap_table?.last_updated ? formatDate(data.cap_table.last_updated) : '—'}`, 14, 26)
    const headers = ['Name', 'Type', 'Shares', 'Ownership %', 'Investment', 'Class']
    const widths = [52, 22, 30, 28, 34, 20]
    let y = 36
    doc.setFontSize(9)
    doc.setFillColor(240, 240, 240)
    doc.rect(14, y - 4, 170, 8, 'F')
    headers.forEach((h, i) => doc.text(h, 15 + widths.slice(0, i).reduce((a, b) => a + b, 0), y))
    y += 8
    for (const e of entries) {
      if (y > 280) {
        doc.addPage()
        y = 16
      }
      const row = [
        e.holder_name.slice(0, 24),
        TYPE_LABELS[e.holder_type] ?? e.holder_type,
        e.shares.toLocaleString(),
        ((e.shares / totalShares) * 100).toFixed(2) + '%',
        e.investment_amount ? fmtMoney(e.investment_amount) : '-',
        e.share_class,
      ]
      row.forEach((c, i) => doc.text(String(c), 15 + widths.slice(0, i).reduce((a, b) => a + b, 0), y))
      y += 8
    }
    doc.save(`${(data.startup.name || 'startup').toLowerCase().replace(/\s+/g, '_')}_cap_table.pdf`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark">
        <AppHeader title="Cap Table" backTo={id ? `/startups/${id}` : '/dashboard'} backLabel="Back to Startup" />
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <div className="h-8 w-56 animate-pulse rounded-lg bg-gray-200 dark:bg-dark-200" />
          <div className="mt-8 grid gap-4 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
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
        <AppHeader title="Cap Table" backTo={id ? `/startups/${id}` : '/dashboard'} backLabel="Back to Startup" />
        <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
          <EmptyState
            icon={PieIcon}
            title="Cap table unavailable"
            description={loadError ?? 'Something went wrong.'}
          />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24 dark:bg-dark lg:pb-0">
      <AppHeader title="Cap Table" backTo={`/startups/${id}`} backLabel="Back to Startup" />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <PieIcon className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-xl font-extrabold">{data.startup.name} — Cap Table</h1>
              {data.cap_table?.last_updated && (
                <p className="text-sm text-gray-500">Last updated {formatDate(data.cap_table.last_updated)}</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={exportCsv} className="btn-ghost">
              <Download className="h-4 w-4" /> Export CSV
            </button>
            <button onClick={exportPdf} className="btn-ghost">
              <FileDown className="h-4 w-4" /> Export PDF
            </button>
            {canManage && (
              <>
                <button onClick={() => setSplitOpen(true)} className="btn-ghost">
                  <Sparkles className="h-4 w-4" /> Suggest Fair Split
                </button>
                <button onClick={() => setShareholderOpen(true)} className="btn-primary">
                  <Plus className="h-4 w-4" /> Add Shareholder
                </button>
              </>
            )}
          </div>
        </div>

        {/* Summary stats */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon={Users} label="Shareholders" value={String(stats.holders)} tint="text-primary" />
          <StatCard icon={Coins} label="Total raised" value={formatCurrency(stats.raised)} tint="text-green-600 dark:text-green-400" />
          <StatCard icon={TrendingUp} label="Valuation" value={formatCurrency(stats.valuation)} tint="text-accent" />
          <StatCard icon={Briefcase} label="ESOP pool" value={`${stats.esopPct}%`} tint="text-teal-600 dark:text-teal-400" />
        </div>

        {/* Total shares */}
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-dark-300 dark:bg-dark-100">
          <BarChart3 className="h-5 w-5 text-primary" />
          {editingTotal && canManage ? (
            <>
              <input
                type="number"
                value={totalDraft}
                onChange={(e) => setTotalDraft(e.target.value)}
                className="w-40 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm outline-none focus:border-primary dark:border-dark-300 dark:bg-dark"
              />
              <button onClick={saveTotal} className="btn-primary !px-3 !py-1.5 text-xs">
                Save
              </button>
              <button onClick={() => setEditingTotal(false)} className="btn-ghost !px-3 !py-1.5 text-xs">
                Cancel
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-500">Total shares</p>
              <p className="text-base font-extrabold">{totalShares.toLocaleString()}</p>
              {canManage && (
                <button onClick={() => setEditingTotal(true)} className="btn-ghost !px-3 !py-1.5 text-xs">
                  Edit
                </button>
              )}
            </>
          )}
          <p className="ml-auto text-sm text-gray-500">
            Sum of ownership:{' '}
            <span className={`font-bold ${Math.abs(entries.reduce((s, e) => s + e.shares, 0) - totalShares) < 1 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
              {totalShares > 0 ? ((entries.reduce((s, e) => s + e.shares, 0) / totalShares) * 100).toFixed(1) : 0}%
            </span>
          </p>
        </div>

        {/* Pie chart */}
        {entries.length > 0 && (
          <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 dark:border-dark-300 dark:bg-dark-100">
            <h2 className="mb-4 flex items-center gap-2 text-base font-bold">
              <PieIcon className="h-4 w-4 text-primary" /> Ownership breakdown
            </h2>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={entries.map((e) => ({
                      name: e.holder_name,
                      value: parseFloat(((e.shares / totalShares) * 100).toFixed(2)),
                      type: e.holder_type,
                    }))}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={120}
                    label={({ name, value }: { name?: string; value?: number }) => `${name}: ${value}%`}
                    labelLine={false}
                  >
                    {entries.map((e) => (
                      <Cell key={e.id} fill={CHART_COLORS[e.holder_type] ?? '#444441'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${value}%`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex flex-wrap justify-center gap-3">
              {entries.map((e) => (
                <span key={e.id} className="flex items-center gap-1.5 text-xs text-gray-500">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: CHART_COLORS[e.holder_type] ?? '#444441' }} />
                  {e.holder_name}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Cap table */}
        <section className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-dark-300 dark:bg-dark-100">
          <div className="border-b border-gray-100 px-5 py-3.5 dark:border-dark-300">
            <h2 className="text-base font-bold">Shareholders</h2>
          </div>
          {entries.length === 0 ? (
            <div className="p-10 text-center">
              <Users className="mx-auto h-10 w-10 text-gray-400" />
              <p className="mt-3 text-sm text-gray-500">
                {canManage ? 'Add your first shareholder to build the cap table.' : 'No shareholders listed yet.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400 dark:border-dark-300">
                    <th className="px-5 py-3 font-semibold">Name</th>
                    <th className="px-3 py-3 font-semibold">Type</th>
                    <th className="px-3 py-3 text-right font-semibold">Shares</th>
                    <th className="px-3 py-3 text-right font-semibold">Ownership %</th>
                    <th className="px-3 py-3 text-right font-semibold">Investment</th>
                    <th className="px-3 py-3 font-semibold">Class</th>
                    <th className="px-3 py-3 font-semibold">Vesting</th>
                    <th className="px-3 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-dark-300">
                  {entries.map((e) => {
                    const vested = calculateVested(e)
                    return (
                      <tr key={e.id} className="align-top hover:bg-gray-50 dark:hover:bg-dark-200">
                        <td className="px-5 py-3">
                          <p className="font-bold">{e.holder_name}</p>
                          {e.notes && <p className="mt-0.5 max-w-[180px] truncate text-xs text-gray-500">{e.notes}</p>}
                        </td>
                        <td className="px-3 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${TYPE_CHIP[e.holder_type]}`}>
                            {TYPE_LABELS[e.holder_type] ?? e.holder_type}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right font-semibold tabular-nums">{e.shares.toLocaleString()}</td>
                        <td className="px-3 py-3 text-right font-semibold tabular-nums text-primary">
                          {totalShares > 0 ? ((e.shares / totalShares) * 100).toFixed(2) : 0}%
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">{fmtMoney(e.investment_amount)}</td>
                        <td className="px-3 py-3 capitalize">{e.share_class}</td>
                        <td className="px-3 py-3">
                          {vested !== null ? (
                            <VestingBar entry={e} vested={vested} />
                          ) : (
                            <span className="text-xs text-gray-400">None</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {canManage && (
                            <button
                              onClick={async () => {
                                if (!window.confirm(`Remove ${e.holder_name} from the cap table?`)) return
                                await deleteEntry(e.id)
                                toast.success('Entry removed')
                                load()
                              }}
                              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Funding rounds */}
        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-bold">
              <Wallet className="h-4 w-4 text-primary" /> Funding rounds
            </h2>
            {canManage && (
              <button onClick={() => setRoundOpen(true)} className="btn-primary !px-3 !py-1.5 text-xs">
                <Plus className="h-4 w-4" /> Add Round
              </button>
            )}
          </div>
          {(data.rounds ?? []).length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">No funding rounds yet.</p>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {(data.rounds ?? []).map((r) => (
                <RoundCard key={r.id} round={r} entries={entries} canManage={canManage} onChanged={load} />
              ))}
            </div>
          )}
        </section>
      </main>

      {canManage && (
        <>
          <AddShareholderModal
            open={shareholderOpen}
            onClose={() => setShareholderOpen(false)}
            totalShares={totalShares}
            onSubmit={async (payload) => {
              if (!id) return
              await addEntry(id, payload)
              toast.success('Shareholder added')
              setShareholderOpen(false)
              load()
            }}
          />
          <AddRoundModal
            open={roundOpen}
            onClose={() => setRoundOpen(false)}
            totalShares={totalShares}
            onSubmit={async (payload) => {
              if (!id) return
              await addRound(id, payload)
              toast.success('Funding round added')
              setRoundOpen(false)
              load()
            }}
          />
          <EquitySplitModal open={splitOpen} onClose={() => setSplitOpen(false)} sessionToken={undefined} />
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Vesting bar
// ---------------------------------------------------------------------------

function VestingBar({ entry, vested }: { entry: CapTableEntry; vested: number }) {
  const pct = entry.shares > 0 ? Math.min(100, Math.max(0, (vested / entry.shares) * 100)) : 0
  const months = entry.vesting_total_months ?? 0
  return (
    <div className="w-36">
      <div className="flex items-center justify-between text-[10px] text-gray-500">
        <span>{vested.toLocaleString()} / {entry.shares.toLocaleString()} vested</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-dark-300">
        <div className="h-full rounded-full bg-green-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-[10px] text-gray-400">
        {entry.vesting_cliff_months ?? 0}mo cliff · {months}mo total
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Add shareholder modal
// ---------------------------------------------------------------------------

function AddShareholderModal({
  open,
  onClose,
  totalShares,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  totalShares: number
  onSubmit: (payload: {
    holder_name: string
    holder_type: HolderType
    shares: number
    share_class: ShareClass
    investment_amount: number | null
    investment_date: string | null
    vesting_start: string | null
    vesting_cliff_months: number | null
    vesting_total_months: number | null
    notes: string | null
  }) => void
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState<HolderType>('founder')
  const [shares, setShares] = useState('')
  const [shareClass, setShareClass] = useState<ShareClass>('common')
  const [investment, setInvestment] = useState('')
  const [investDate, setInvestDate] = useState('')
  const [vesting, setVesting] = useState(false)
  const [vestStart, setVestStart] = useState('')
  const [cliff, setCliff] = useState(12)
  const [totalMonths, setTotalMonths] = useState(48)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const sharesNum = Number(shares) || 0
  const ownershipPct = totalShares > 0 ? ((sharesNum / totalShares) * 100).toFixed(2) : '0'

  const submit = async () => {
    if (!name.trim() || sharesNum <= 0) {
      toast.error('Name and shares are required')
      return
    }
    setSaving(true)
    try {
      await onSubmit({
        holder_name: name.trim(),
        holder_type: type,
        shares: sharesNum,
        share_class: shareClass,
        investment_amount: investment ? Number(investment) : null,
        investment_date: investDate || null,
        vesting_start: vesting ? vestStart || null : null,
        vesting_cliff_months: vesting ? cliff : null,
        vesting_total_months: vesting ? totalMonths : null,
        notes: notes.trim() || null,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add shareholder')
    } finally {
      setSaving(false)
    }
  }

  const showVesting = type === 'employee' || type === 'advisor'

  return (
    <Modal open={open} onClose={onClose} title="Add Shareholder" subtitle="Ownership is calculated automatically" wide>
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Holder name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sarah Chen"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as HolderType)}
              className="w-full cursor-pointer rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-primary dark:border-dark-300 dark:bg-dark"
            >
              {HOLDER_TYPES.map((t) => (
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
            <input
              type="number"
              value={shares}
              onChange={(e) => setShares(e.target.value)}
              placeholder="e.g. 1000000"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Share class</label>
            <select
              value={shareClass}
              onChange={(e) => setShareClass(e.target.value as ShareClass)}
              className="w-full cursor-pointer rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-primary dark:border-dark-300 dark:bg-dark"
            >
              {SHARE_CLASSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Ownership (auto)</label>
            <div className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5 text-sm font-bold text-primary">
              {ownershipPct}%
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Investment amount ($, optional)</label>
            <input
              type="number"
              value={investment}
              onChange={(e) => setInvestment(e.target.value)}
              placeholder="e.g. 250000"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Investment date</label>
            <input
              type="date"
              value={investDate}
              onChange={(e) => setInvestDate(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark"
            />
          </div>
        </div>

        {showVesting && (
          <div className="rounded-xl border border-gray-200 p-4 dark:border-dark-300">
            <label className="flex cursor-pointer items-center justify-between">
              <span className="text-sm font-semibold">Vesting schedule</span>
              <input
                type="checkbox"
                checked={vesting}
                onChange={(e) => setVesting(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
            </label>
            {vesting && (
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-500">Start date</label>
                  <input
                    type="date"
                    value={vestStart}
                    onChange={(e) => setVestStart(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-2 text-sm outline-none focus:border-primary dark:border-dark-300 dark:bg-dark"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-500">Cliff</label>
                  <select
                    value={cliff}
                    onChange={(e) => setCliff(Number(e.target.value))}
                    className="w-full cursor-pointer rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-2 text-sm outline-none dark:border-dark-300 dark:bg-dark"
                  >
                    <option value={0}>None</option>
                    <option value={6}>6 months</option>
                    <option value={12}>12 months</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-500">Total vesting</label>
                  <select
                    value={totalMonths}
                    onChange={(e) => setTotalMonths(Number(e.target.value))}
                    className="w-full cursor-pointer rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-2 text-sm outline-none dark:border-dark-300 dark:bg-dark"
                  >
                    <option value={24}>24 months</option>
                    <option value={36}>36 months</option>
                    <option value={48}>48 months</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-semibold">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="e.g. CTO, technical co-founder"
            className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark"
          />
        </div>

        <button onClick={submit} disabled={saving} className="btn-primary w-full disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add Shareholder
        </button>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Add funding round modal
// ---------------------------------------------------------------------------

function AddRoundModal({
  open,
  onClose,
  totalShares,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  totalShares: number
  onSubmit: (payload: {
    round_name: string
    round_type: string
    target_amount: number | null
    pre_money_valuation: number | null
    post_money_valuation: number | null
    share_price: number | null
    open_date: string | null
    close_date: string | null
  }) => void
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState('seed')
  const [target, setTarget] = useState('')
  const [preMoney, setPreMoney] = useState('')
  const [openDate, setOpenDate] = useState('')
  const [closeDate, setCloseDate] = useState('')
  const [saving, setSaving] = useState(false)

  const targetNum = Number(target) || 0
  const preNum = Number(preMoney) || 0
  const postNum = targetNum + preNum
  const sharePrice = totalShares > 0 ? (preNum / totalShares) : 0

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
        share_price: preMoney && totalShares > 0 ? Number(sharePrice.toFixed(4)) : null,
        open_date: openDate || null,
        close_date: closeDate || null,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add funding round')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Funding Round" subtitle="Post-money and share price auto-calculate" wide>
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Round name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Seed Round"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Round type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full cursor-pointer rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-primary dark:border-dark-300 dark:bg-dark"
            >
              {ROUND_TYPES.map((r) => (
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
            <input
              type="number"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="e.g. 500000"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Pre-money valuation ($)</label>
            <input
              type="number"
              value={preMoney}
              onChange={(e) => setPreMoney(e.target.value)}
              placeholder="e.g. 2000000"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Post-money (auto)</label>
            <div className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5 text-sm font-bold text-primary">
              {fmtMoney(preMoney ? postNum : 0)}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Share price (auto)</label>
            <div className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5 text-sm font-bold text-primary">
              ${sharePrice.toFixed(4)}
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Open date</label>
            <input
              type="date"
              value={openDate}
              onChange={(e) => setOpenDate(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-primary dark:border-dark-300 dark:bg-dark"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Close date</label>
            <input
              type="date"
              value={closeDate}
              onChange={(e) => setCloseDate(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-primary dark:border-dark-300 dark:bg-dark"
            />
          </div>
        </div>

        <button onClick={submit} disabled={saving} className="btn-primary w-full disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add Funding Round
        </button>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Funding round card
// ---------------------------------------------------------------------------

function RoundCard({
  round,
  entries,
  canManage,
  onChanged,
}: {
  round: FundingRound
  entries: CapTableEntry[]
  canManage: boolean
  onChanged: () => void
}) {
  const target = round.target_amount ?? 0
  const raised = round.raised_amount ?? 0
  const pct = target > 0 ? Math.min(100, Math.max(0, (raised / target) * 100)) : 0
  const investors = entries.filter((e) => e.holder_type === 'investor')

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
                : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
          }`}
        >
          {round.status}
        </span>
      </div>

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
          <p className="text-gray-400">Share price</p>
          <p className="font-bold">${round.share_price ?? '-'}</p>
        </div>
      </div>

      {investors.length > 0 && (
        <div className="mt-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Investors in this round</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {investors.map((inv) => (
              <span key={inv.id} className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400">
                {inv.holder_name}
              </span>
            ))}
          </div>
        </div>
      )}

      {canManage && (
        <div className="mt-4 flex gap-2">
          {round.status === 'open' && (
            <button
              onClick={async () => {
                await updateRound(round.id, { status: 'closed', close_date: new Date().toISOString().slice(0, 10) })
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
              await deleteRound(round.id)
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

// ---------------------------------------------------------------------------
// AI equity split
// ---------------------------------------------------------------------------

function EquitySplitModal({
  open,
  onClose,
  sessionToken,
}: {
  open: boolean
  onClose: () => void
  sessionToken: string | undefined
}) {
  const { session } = useSession()
  const [founders, setFounders] = useState([
    { name: '', role: 'Co-Founder', commitment: 'full-time', experience: 0 },
    { name: '', role: 'Co-Founder', commitment: 'full-time', experience: 0 },
  ])
  const [esop, setEsop] = useState(10)
  const [investor, setInvestor] = useState(0)
  const [output, setOutput] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (open) {
      setOutput('')
      setError(null)
      setGenerating(false)
    }
  }, [open])

  const generate = async () => {
    if (generating) return
    const valid = founders.filter((f) => f.name.trim())
    if (valid.length === 0) {
      toast.error('Add at least one founder')
      return
    }
    setGenerating(true)
    setOutput('')
    setError(null)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const token = session?.access_token ?? sessionToken
      const res = await fetch(`${API_URL}/api/ai/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token ?? ''}`,
        },
        body: JSON.stringify({
          feature: 'equity_split',
          context: {
            founders: valid.map((f) => ({
              name: f.name.trim(),
              role: f.role,
              commitment: f.commitment,
              experience: Number(f.experience) || 0,
            })),
            esop,
            investor,
          },
        }),
        signal: controller.signal,
      })
      if (!res.ok) {
        let detail = 'AI generation failed'
        try {
          const data = await res.json()
          if (data.detail) detail = data.detail
        } catch {
          // ignore
        }
        throw new Error(detail)
      }
      if (!res.body) throw new Error('No response body')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let done = false
      let streamError: string | null = null
      while (!done) {
        const { done: streamDone, value } = await reader.read()
        if (streamDone) break
        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop() ?? ''
        for (const event of events) {
          if (!event.startsWith('data: ')) continue
          const payload = event.slice(6).trim()
          if (payload === '[DONE]') {
            done = true
            break
          }
          try {
            const parsed = JSON.parse(payload)
            if (parsed.error) {
              streamError = parsed.error
              done = true
              break
            } else if (typeof parsed.text === 'string') {
              setOutput((prev) => prev + parsed.text)
            } else if (typeof parsed === 'string') {
              setOutput((prev) => prev + parsed)
            }
          } catch {
            // ignore partial frames
          }
        }
      }
      if (streamError) throw new Error(streamError)
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        setError(err instanceof Error ? err.message : 'AI generation failed')
      }
    } finally {
      setGenerating(false)
    }
  }

  const stop = () => abortRef.current?.abort()

  return (
    <Modal open={open} onClose={onClose} title="Suggest Fair Split" subtitle="AI-generated equity allocation based on YC guidelines" wide>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold">Founders</h3>
            <button
              onClick={() => setFounders((p) => [...p, { name: '', role: 'Co-Founder', commitment: 'full-time', experience: 0 }])}
              className="btn-ghost !px-3 !py-1 text-xs"
            >
              <Plus className="h-3.5 w-3.5" /> Add founder
            </button>
          </div>
          {founders.map((f, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-xl border border-gray-200 p-3 sm:flex-row sm:items-center dark:border-dark-300">
              <input
                value={f.name}
                onChange={(e) => setFounders((p) => p.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                placeholder={`Founder ${i + 1} name`}
                className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-primary dark:border-dark-300 dark:bg-dark"
              />
              <select
                value={f.role}
                onChange={(e) => setFounders((p) => p.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)))}
                className="cursor-pointer rounded-lg border border-gray-200 bg-gray-50 px-2 py-2 text-sm outline-none dark:border-dark-300 dark:bg-dark"
              >
                {['Co-Founder', 'CTO', 'COO', 'CMO', 'Design Lead', 'Product Lead'].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
              <select
                value={f.commitment}
                onChange={(e) => setFounders((p) => p.map((x, j) => (j === i ? { ...x, commitment: e.target.value } : x)))}
                className="cursor-pointer rounded-lg border border-gray-200 bg-gray-50 px-2 py-2 text-sm outline-none dark:border-dark-300 dark:bg-dark"
              >
                <option value="full-time">Full-time</option>
                <option value="part-time">Part-time</option>
              </select>
              <input
                type="number"
                value={f.experience}
                onChange={(e) => setFounders((p) => p.map((x, j) => (j === i ? { ...x, experience: Number(e.target.value) || 0 } : x)))}
                placeholder="Exp (yrs)"
                className="w-24 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-primary dark:border-dark-300 dark:bg-dark"
              />
              {founders.length > 1 && (
                <button
                  onClick={() => setFounders((p) => p.filter((_, j) => j !== i))}
                  className="rounded-lg p-1.5 text-gray-400 hover:text-red-500"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold">ESOP pool %</label>
            <input
              type="number"
              value={esop}
              onChange={(e) => setEsop(Number(e.target.value) || 0)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-primary dark:border-dark-300 dark:bg-dark"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Investor pool %</label>
            <input
              type="number"
              value={investor}
              onChange={(e) => setInvestor(Number(e.target.value) || 0)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-primary dark:border-dark-300 dark:bg-dark"
            />
          </div>
        </div>

        <div className="flex gap-2">
          {generating ? (
            <button onClick={stop} className="btn-ghost flex-1">
              <Square className="h-4 w-4" /> Stop
            </button>
          ) : (
            <button onClick={generate} className="btn-primary flex-1">
              <Sparkles className="h-4 w-4" /> Generate Split
            </button>
          )}
        </div>

        {generating && (
          <p className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin text-primary" /> Generating recommendation…
          </p>
        )}

        {error && <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-500">{error}</p>}

        {output && (
          <div className="max-h-72 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm leading-relaxed whitespace-pre-wrap dark:border-dark-300 dark:bg-dark">
            {output}
          </div>
        )}
      </div>
    </Modal>
  )
}
