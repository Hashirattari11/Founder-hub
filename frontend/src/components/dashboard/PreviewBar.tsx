import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, Eye, EyeOff } from 'lucide-react'
import { useSession } from '../../context/AuthContext'
import { isAdminProfile } from '../../lib/admin'
import { ROLE_LABELS } from '../../types'
import type { Role } from '../../types'

const PREVIEW_OPTIONS: { value: Role; label: string }[] = [
  { value: 'administrator', label: 'Admin Console' },
  { value: 'founder', label: 'Founder' },
  { value: 'investor', label: 'Investor' },
  { value: 'developer', label: 'Developer' },
  { value: 'designer', label: 'Designer' },
  { value: 'marketer', label: 'Marketer' },
  { value: 'mentor', label: 'Mentor' },
  { value: 'recruiter', label: 'Recruiter' },
  { value: 'business_analyst', label: 'Business Analyst' },
  { value: 'legal_advisor', label: 'Legal Advisor' },
]

/**
 * Floating role switcher visible only to real administrators. Lets the admin
 * preview what the site looks like for any role without touching their real
 * profile/role — founder dashboard, investor dashboard, and everything else.
 */
export function PreviewBar() {
  const { realProfile, previewRole, setPreviewRole } = useSession()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  if (!isAdminProfile(realProfile)) return null

  const current: Role = previewRole ?? 'administrator'
  const previewing = current !== 'administrator'

  const apply = (role: Role) => {
    setOpen(false)
    if (role === 'administrator') {
      setPreviewRole(null)
      navigate('/admin/dashboard')
    } else {
      setPreviewRole(role)
      navigate('/dashboard')
    }
  }

  return (
    <div className="fixed bottom-16 left-1/2 z-50 -translate-x-1/2 lg:bottom-5">
      <div className="flex items-center gap-2 rounded-full border border-primary/25 bg-white/95 py-1.5 pl-3 pr-1.5 shadow-xl shadow-primary/10 backdrop-blur-xl dark:bg-dark-100/95">
        <span className="flex items-center gap-1.5 text-xs font-bold text-primary">
          <Eye className="h-4 w-4" />
          {previewing ? `Viewing as ${ROLE_LABELS[current]}` : 'Preview mode'}
        </span>

        <div className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Switch preview role"
            className="flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors hover:border-primary hover:text-primary dark:border-dark-300 dark:bg-dark dark:text-gray-300"
          >
            {previewing ? ROLE_LABELS[current] : 'Admin'}
            <ChevronDown className="h-3.5 w-3.5" />
          </button>

          {open && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
              <div className="absolute bottom-full left-1/2 z-50 mb-2 w-48 -translate-x-1/2 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-2xl dark:border-dark-300 dark:bg-dark-100">
                <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  View as
                </p>
                {PREVIEW_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => apply(option.value)}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                      option.value === current
                        ? 'bg-primary/10 font-semibold text-primary'
                        : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-dark-200'
                    }`}
                  >
                    {option.label}
                    {option.value === current && (
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {previewing && (
          <button
            onClick={() => apply('administrator')}
            className="flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-white transition-opacity hover:opacity-90"
          >
            <EyeOff className="h-3.5 w-3.5" />
            Exit
          </button>
        )}
      </div>
    </div>
  )
}
