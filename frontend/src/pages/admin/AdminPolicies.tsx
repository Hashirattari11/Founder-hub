import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, FileText, Search, Scale } from 'lucide-react'
import { Badge, Card, PageHeader } from './adminUi'

interface PolicyMeta {
  title: string
  route: string
  description: string
  updated: string
  category: 'Legal' | 'Trust' | 'Community' | 'Billing'
}

const POLICIES: PolicyMeta[] = [
  { title: 'Terms of Service', route: '/terms', description: 'Platform rules, accounts, roles, UGC, AI features, liability.', updated: 'August 2026', category: 'Legal' },
  { title: 'Privacy Policy', route: '/privacy', description: 'Data collection, use, storage (Supabase), rights, deletion requests.', updated: 'August 2026', category: 'Legal' },
  { title: 'Cookie Policy', route: '/cookies', description: 'Essential localStorage (auth + theme). No third-party trackers.', updated: 'August 2026', category: 'Legal' },
  { title: 'Community Guidelines', route: '/community-guidelines', description: 'Respectful-use rules for founders, investors and talent.', updated: 'August 2026', category: 'Community' },
  { title: 'Acceptable Use Policy', route: '/acceptable-use', description: 'Prohibited conduct and the warning → termination enforcement ladder.', updated: 'August 2026', category: 'Trust' },
  { title: 'Intellectual Property Policy', route: '/intellectual-property', description: 'Ownership of UGC/startups/logos and how to report infringement.', updated: 'August 2026', category: 'Legal' },
  { title: 'Security', route: '/security', description: 'Account security, RBAC, data protection, responsible disclosure.', updated: 'August 2026', category: 'Trust' },
  { title: 'Disclaimer', route: '/disclaimer', description: 'No investment / legal / tax / funding / success advice or guarantees.', updated: 'August 2026', category: 'Trust' },
  { title: 'Investor Disclaimer', route: '/investor-disclaimer', description: 'Networking platform, not a broker-dealer; perform your own due diligence.', updated: 'August 2026', category: 'Trust' },
  { title: 'Refund & Cancellation Policy', route: '/refund-policy', description: 'Applies when paid services are introduced. No paid plans currently.', updated: 'August 2026', category: 'Billing' },
]

const CATEGORIES: (PolicyMeta['category'] | 'All')[] = ['All', 'Legal', 'Trust', 'Community', 'Billing']

const CATEGORY_TONE: Record<PolicyMeta['category'], 'green' | 'blue' | 'amber' | 'purple'> = {
  Legal: 'blue',
  Trust: 'green',
  Community: 'amber',
  Billing: 'purple',
}

export default function AdminPolicies() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('All')

  const filtered = POLICIES.filter((p) => {
    if (category !== 'All' && p.category !== category) return false
    if (query && !(`${p.title} ${p.description}`.toLowerCase().includes(query.toLowerCase()))) return false
    return true
  })

  return (
    <div>
      <PageHeader
        title="Policies & Trust Center"
        description="View and review FounderHub's legal and trust policies. Content is managed in source (StaticPages.tsx) and versioned via git."
        actions={
          <Link
            to="/legal"
            target="_blank"
            rel="noreferrer"
            className="btn-ghost inline-flex items-center gap-1.5 text-sm"
          >
            Open Legal Center <ExternalLink className="h-4 w-4" />
          </Link>
        }
      />

      {/* Important notice */}
      <Card className="mb-6 border-amber-300/60 bg-amber-50/60 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
        <p className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
          <Scale className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>
            These policies are product-level templates and should be reviewed by qualified legal counsel before launch — especially for investment/fundraising functionality and international users. Editing policy text currently requires a code change in <code className="rounded bg-amber-100 px-1 dark:bg-amber-500/20">frontend/src/pages/static/StaticPages.tsx</code>.
          </span>
        </p>
      </Card>

      {/* Controls */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search policies..."
            className="input pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                category === c
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-dark-300 dark:text-gray-300 dark:hover:bg-dark-200'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <Card className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400 dark:border-dark-300">
              <th className="px-4 py-3 font-semibold">Policy</th>
              <th className="px-4 py-3 font-semibold">Category</th>
              <th className="hidden px-4 py-3 font-semibold md:table-cell">Description</th>
              <th className="px-4 py-3 font-semibold">Last updated</th>
              <th className="px-4 py-3 font-semibold text-right">Open</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-400">
                  No policies match your search.
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr
                  key={p.route}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50 dark:border-dark-200 dark:hover:bg-dark-200"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
                      <FileText className="h-4 w-4 text-gray-400" />
                      {p.title}
                    </div>
                    <p className="mt-0.5 text-xs text-gray-400">{p.route}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={CATEGORY_TONE[p.category]}>{p.category}</Badge>
                  </td>
                  <td className="hidden px-4 py-3 text-gray-600 dark:text-gray-300">{p.description}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{p.updated}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={p.route}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
                    >
                      View <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      <p className="mt-4 text-xs text-gray-400">
        Showing {filtered.length} of {POLICIES.length} policies. All policies are public and crawlable; updates deploy with the next build.
      </p>
    </div>
  )
}
