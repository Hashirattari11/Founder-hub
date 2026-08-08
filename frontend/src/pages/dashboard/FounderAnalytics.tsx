import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Loader2,
  Eye,
  UserPlus,
  Users,
  FileText,
  CheckCircle2,
  TrendingUp,
  MessageSquare,
  CalendarClock,
  Handshake,
  BarChart3,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react'
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart as ReBarChart,
  Bar as ReBar,
  Cell as ReCell,
} from 'recharts'
import { AppHeader } from '../../components/AppHeader'
import { getFounderAnalytics, type FounderAnalytics, type SeriesPoint } from '../../lib/analytics'
import { StatCard } from '../../components/dashboard/StatCard'

const FUNNEL_COLORS = ['#F59E0B', '#7C3AED', '#3B82F6', '#22C55E', '#EF4444']

export default function FounderAnalytics() {
  const [data, setData] = useState<FounderAnalytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getFounderAnalytics()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  const funnelData = useMemo(() => {
    if (!data) return []
    return [
      { name: 'Profile views', count: data.funnel.profile_views, color: FUNNEL_COLORS[0] },
      { name: 'Startup views', count: data.funnel.startup_views, color: FUNNEL_COLORS[1] },
      { name: 'Applications', count: data.funnel.applications, color: FUNNEL_COLORS[2] },
      { name: 'Shortlisted', count: data.funnel.shortlisted, color: FUNNEL_COLORS[3] },
      { name: 'Accepted', count: data.funnel.accepted, color: FUNNEL_COLORS[4] },
    ]
  }, [data])

  const mergedSeries = useMemo(() => {
    if (!data) return []
    const map = new Map<string, SeriesPoint & { startups: number }>()
    for (const p of data.profile.views_30d) {
      map.set(p.label, { ...p, startups: 0 })
    }
    for (const s of data.startups.views_30d) {
      const existing = map.get(s.label)
      if (existing) existing.startups = s.count
      else map.set(s.label, { ...s, startups: s.count })
    }
    return Array.from(map.values())
  }, [data])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-dark">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 px-4 text-center dark:bg-dark">
        <BarChart3 className="h-10 w-10 text-amber-500" />
        <h1 className="text-xl font-extrabold">Analytics unavailable</h1>
        <p className="text-sm text-gray-500">Could not load your analytics right now. Please try again.</p>
        <Link to="/dashboard" className="btn-primary">
          Back to Dashboard
        </Link>
      </div>
    )
  }

  const { profile, startups, engagement, rates, by_startup } = data

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark">
      <AppHeader title="Analytics" backTo="/dashboard" backLabel="Back to Dashboard" />

      <main className="container-x pt-8 pb-24 lg:pb-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold sm:text-3xl">Analytics</h1>
            <p className="mt-1 text-sm text-gray-500">
              Profile views, applicant funnels, and engagement metrics across {startups.total} startup{startups.total === 1 ? '' : 's'}.
            </p>
          </div>
          <Link to="/dashboard/startups" className="btn-secondary inline-flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> Manage startups
          </Link>
        </div>

        {/* Top stat cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Profile views"
            value={profile.views}
            icon={Eye}
            hint={`${profile.unique_viewers} unique`}
          />
          <StatCard
            label="Startup views"
            value={startups.views}
            icon={TrendingUp}
            hint={`${startups.unique_viewers} unique`}
          />
          <StatCard
            label="Applications"
            value={data.funnel.applications}
            icon={FileText}
            hint={`${data.funnel.shortlisted} shortlisted`}
          />
          <StatCard
            label="Connections"
            value={engagement.connections_accepted}
            icon={Handshake}
            hint={`${engagement.connections_received} received`}
          />
        </div>

        {/* Views over time */}
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-500">
              <Eye className="h-4 w-4 text-primary" /> Views — last 30 days
            </h2>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-primary" /> Profile
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-accent" /> Startups
              </span>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={mergedSeries} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-gray-200 dark:text-dark-300" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="currentColor" className="text-gray-400" interval={4} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="currentColor" className="text-gray-400" />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', background: 'var(--tw-color-bg, #fff)', fontSize: 12 }}
                  labelClassName="font-semibold"
                />
                <Bar dataKey="startups" name="Startup views" fill="#F59E0B" radius={[4, 4, 0, 0]} opacity={0.9} />
                <Line type="monotone" dataKey="count" name="Profile views" stroke="#7C3AED" strokeWidth={2.5} dot={{ r: 3, fill: '#7C3AED' }} activeDot={{ r: 5 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Funnel + rates */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-500">
              <UserPlus className="h-4 w-4 text-primary" /> Applicant funnel
            </h2>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <ReBarChart data={funnelData} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-gray-200 dark:text-dark-300" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="currentColor" className="text-gray-400" interval={0} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="currentColor" className="text-gray-400" />
                  <Tooltip cursor={{ fill: 'rgba(124,58,237,0.05)' }} contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }} />
                  <ReBar dataKey="count" radius={[6, 6, 0, 0]}>
                    {funnelData.map((entry) => (
                      <ReCell key={entry.name} fill={entry.color} />
                    ))}
                  </ReBar>
                </ReBarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-500">
              <TrendingUp className="h-4 w-4 text-primary" /> Conversion rates
            </h2>
            <div className="flex flex-col gap-5">
              <RateRow label="Views → Applications" value={rates.conversion_rate} />
              <RateRow label="Applications → Shortlist" value={rates.response_rate} />
              <RateRow label="Shortlist → Accepted" value={rates.acceptance_rate} />
              <div className="rounded-xl bg-gradient-brand p-4 text-white">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide opacity-90">
                  <Sparkles className="h-3.5 w-3.5" /> Tip
                </p>
                <p className="mt-1 text-sm leading-relaxed">
                  {rates.conversion_rate < 10
                    ? 'Low view-to-application rate — try adding a clearer tagline or publishing open roles on your startup page.'
                    : rates.response_rate < 30
                      ? 'You respond well — keep shortlisting fast. Faster reviews lead to stronger hires.'
                      : 'Great funnel health! Consider scaling by publishing more roles.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Engagement */}
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-500">
            <Users className="h-4 w-4 text-primary" /> Engagement
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <EngagementCard icon={<MessageSquare className="h-5 w-5" />} label="Messages sent" value={engagement.messages_sent} accent="text-primary" />
            <EngagementCard icon={<Handshake className="h-5 w-5" />} label="Connections" value={engagement.connections_accepted} accent="text-emerald-500" />
            <EngagementCard icon={<UserPlus className="h-5 w-5" />} label="Requests received" value={engagement.connections_received} accent="text-amber-500" />
            <EngagementCard icon={<CalendarClock className="h-5 w-5" />} label="Meetings" value={engagement.meetings} accent="text-accent" />
          </div>
        </div>

        {/* Per-startup breakdown */}
        {by_startup.length > 0 && (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-500">
              <CheckCircle2 className="h-4 w-4 text-primary" /> Performance by startup
            </h2>
            <ul className="flex flex-col divide-y divide-gray-100 dark:divide-dark-300">
              {by_startup.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{s.name}</p>
                    <p className="text-xs text-gray-500">
                      {s.applications} application{s.applications === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                      <Eye className="h-3 w-3" /> {s.views} views
                    </span>
                    <Link
                      to={`/startups/${s.id}/analytics`}
                      className="flex items-center gap-0.5 text-xs font-semibold text-primary hover:underline"
                    >
                      Detail <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  )
}

function RateRow({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-gray-500">{label}</span>
        <span className="font-bold">{value}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-dark-300">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-700"
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  )
}

function EngagementCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-dark-300 dark:bg-dark-200">
      <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${accent} bg-white shadow-sm dark:bg-dark-100`}>{icon}</span>
      <div>
        <p className="text-lg font-extrabold">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  )
}
