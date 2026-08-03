import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Loader2,
  AlertTriangle,
  Eye,
  Users,
  FileText,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from 'recharts'
import { getStartupById, getStartupViews } from '../../lib/startups'
import { getApplicationsForStartup } from '../../lib/applications'
import { useSession } from '../../context/AuthContext'
import { AppHeader } from '../../components/AppHeader'
import type { Application, Startup } from '../../types'

const STATUS_COLORS: Record<string, string> = {
  pending: '#F59E0B',
  shortlisted: '#3B82F6',
  accepted: '#22C55E',
  rejected: '#EF4444',
}

const DAY_MS = 24 * 60 * 60 * 1000

export default function StartupAnalytics() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useSession()
  const [startup, setStartup] = useState<Startup | null>(null)
  const [applications, setApplications] = useState<Application[]>([])
  const [views, setViews] = useState<{ viewer_id: string | null; viewed_at: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!id) return
    Promise.all([getStartupById(id), getStartupViews(id), getApplicationsForStartup(id)])
      .then(([startupData, viewsData, appsData]) => {
        if (!startupData) {
          setNotFound(true)
          return
        }
        if (startupData.founder_id !== user?.id) {
          toast.error("You don't own this startup")
          navigate('/dashboard/startups')
          return
        }
        setStartup(startupData)
        setViews(viewsData)
        setApplications(appsData)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id, user, navigate])

  const stats = useMemo(() => {
    const byStatus = { pending: 0, shortlisted: 0, accepted: 0, rejected: 0 }
    for (const app of applications) {
      if (app.status in byStatus) byStatus[app.status as keyof typeof byStatus] += 1
    }
    const uniqueViewers = new Set(views.map((v) => v.viewer_id).filter(Boolean)).size
    const totalViews = views.length
    const accepted = byStatus.accepted
    const decided = byStatus.accepted + byStatus.rejected
    return {
      byStatus,
      uniqueViewers,
      totalViews,
      accepted,
      acceptanceRate: decided > 0 ? Math.round((accepted / decided) * 100) : 0,
    }
  }, [applications, views])

  const viewsByDay = useMemo(() => {
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(Date.now() - (13 - i) * DAY_MS)
      return {
        date: d.toISOString().slice(0, 10),
        label: d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
        views: 0,
      }
    })
    const map = new Map(days.map((d) => [d.date, d]))
    for (const v of views) {
      const key = v.viewed_at.slice(0, 10)
      const bucket = map.get(key)
      if (bucket) bucket.views += 1
    }
    return days
  }, [views])

  const statusData = useMemo(
    () =>
      (Object.keys(STATUS_COLORS) as Array<keyof typeof stats.byStatus>).map((status) => ({
        name: status,
        count: stats.byStatus[status],
        color: STATUS_COLORS[status],
      })),
    [stats.byStatus],
  )

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-dark">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (notFound || !startup) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 px-4 text-center dark:bg-dark">
        <AlertTriangle className="h-10 w-10 text-amber-500" />
        <h1 className="text-xl font-extrabold">Startup not found</h1>
        <p className="text-sm text-gray-500">This startup may have been deleted or you don't have access.</p>
        <Link to="/dashboard/startups" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">
          Back to My Startups
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark">
      <AppHeader title="Analytics" backTo="/dashboard/startups" />
      <main className="container-x py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold sm:text-3xl">{startup.name}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {startup.tagline} — {applications.length} applications · {stats.totalViews} views
          </p>
        </div>

        {/* Stat cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100">
            <div className="flex items-center gap-2 text-primary">
              <Eye className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Total Views</span>
            </div>
            <p className="mt-2 text-3xl font-extrabold">{stats.totalViews}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Unique Viewers</span>
            </div>
            <p className="mt-2 text-3xl font-extrabold">{stats.uniqueViewers}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Applications</span>
            </div>
            <p className="mt-2 text-3xl font-extrabold">{applications.length}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Acceptance Rate</span>
            </div>
            <p className="mt-2 text-3xl font-extrabold">{stats.acceptanceRate}%</p>
          </div>
        </div>

        {/* Views over time */}
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-500">
            <Eye className="h-4 w-4 text-primary" /> Views — last 14 days
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={viewsByDay} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-gray-200 dark:text-dark-300" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="currentColor" className="text-gray-400" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="currentColor" className="text-gray-400" />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #e5e7eb',
                    background: 'var(--tw-color-bg, #fff)',
                    fontSize: 12,
                  }}
                  labelClassName="font-semibold"
                />
                <Line
                  type="monotone"
                  dataKey="views"
                  stroke="#7C3AED"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#7C3AED' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Applications by status */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-500">
              <CheckCircle2 className="h-4 w-4 text-primary" /> Applications by status
            </h2>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-gray-200 dark:text-dark-300" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="currentColor" className="text-gray-400" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="currentColor" className="text-gray-400" />
                  <Tooltip
                    cursor={{ fill: 'rgba(124,58,237,0.05)' }}
                    contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {statusData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent applicants */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-500">Recent applicants</h2>
            {applications.length === 0 ? (
              <p className="text-sm text-gray-500">No applications yet. Share your startup to attract talent.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {applications.slice(0, 5).map((app) => (
                  <li key={app.id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{app.profiles?.full_name ?? 'Applicant'}</p>
                      <p className="truncate text-xs text-primary">{app.role_applying_for ?? 'General'}</p>
                    </div>
                    <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize" style={{ color: STATUS_COLORS[app.status], background: `${STATUS_COLORS[app.status]}22` }}>
                      {app.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
