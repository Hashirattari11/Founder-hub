import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, FileText, Plus, RefreshCw, Share2, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { deleteBusinessPlan, listBusinessPlans } from '../../lib/businessPlan'
import { EmptyState } from '../../components/EmptyState'
import { SkeletonRow } from '../../components/dashboard/Skeleton'
import { timeAgo } from '../../lib/helpers'
import type { BusinessPlanSummary } from '../../types/businessPlan'

function readinessColor(score?: number) {
  if (score == null) return 'bg-gray-100 text-gray-600 dark:bg-dark-300 dark:text-gray-300'
  if (score >= 80) return 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400'
  if (score >= 65) return 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-400'
  if (score >= 45) return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
  return 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400'
}

export default function BusinessPlanDashboard() {
  const navigate = useNavigate()
  const [plans, setPlans] = useState<BusinessPlanSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await listBusinessPlans()
      setPlans(res.plans ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load business plans')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete the business plan for "${name}"? This cannot be undone.`)) return
    try {
      await deleteBusinessPlan(id)
      setPlans((p) => p.filter((x) => x.id !== id))
      toast.success('Business plan deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete business plan')
    }
  }

  const handleShare = (plan: BusinessPlanSummary) => {
    if (!plan.share_token) {
      toast.error('This plan has no share link yet')
      return
    }
    const url = `${window.location.origin}/business-plan/share/${plan.share_token}`
    navigator.clipboard?.writeText(url).catch(() => {})
    toast.success('Share link copied to clipboard')
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">AI Business Plans</h1>
          <p className="mt-1 text-sm text-gray-500">
            Your generated plans, pitch decks and financial models — saved here for editing and export.
          </p>
        </div>
        <Link to="/business-plan/new" className="btn-primary inline-flex items-center gap-2">
          <Plus className="h-4 w-4" />
          New Plan
        </Link>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </div>
      ) : plans.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No business plans yet"
          description="Describe your startup idea and the AI will build a complete plan, pitch deck and financial model."
          action={
            <Link to="/business-plan/new" className="btn-primary">
              Create your first plan
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="group rounded-2xl border border-gray-200 bg-white p-5 transition-colors hover:border-primary/40 dark:border-dark-300 dark:bg-dark-100"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <button onClick={() => navigate(`/business-plan/${plan.id}`)} className="min-w-0 text-left">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate font-bold group-hover:text-primary">{plan.startup_name}</h2>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${readinessColor(plan.readiness)}`}>
                      {plan.readiness != null ? `${plan.readiness}/100` : '—'}
                    </span>
                    {plan.provider === 'ai' && (
                      <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">AI</span>
                    )}
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-sm text-gray-500">
                    {[plan.industry, plan.stage, plan.readiness_label].filter(Boolean).join(' · ') || 'Business plan'}
                  </p>
                </button>
                <span className="text-xs text-gray-400">updated {timeAgo(plan.updated_at ?? plan.created_at)}</span>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-200 pt-4 dark:border-dark-300">
                <Link
                  to={`/business-plan/${plan.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                  Open plan
                </Link>
                <button
                  onClick={() => handleShare(plan)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:border-primary hover:text-primary dark:border-dark-300 dark:text-gray-300"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  Share
                </button>
                <button
                  onClick={() => handleDelete(plan.id, plan.startup_name)}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-500 transition-colors hover:bg-red-50 dark:border-red-500/30 dark:hover:bg-red-500/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={load}
        className="mt-6 inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 transition-colors hover:text-primary"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Refresh
      </button>
    </div>
  )
}
