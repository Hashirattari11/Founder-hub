import { Navigate } from 'react-router-dom'
import { useSession } from '../context/AuthContext'
import { ADMIN_ROLES, PROFESSIONAL_ROLES } from '../lib/permissions'
import FounderDashboard from './dashboard/FounderDashboard'
import DeveloperDashboard from './dashboard/DeveloperDashboard'
import InvestorDashboard from './dashboard/InvestorDashboard'
import ProfessionalDashboard from './dashboard/ProfessionalDashboard'

export function RoleDashboard() {
  const { profile, loading } = useSession()

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
      </div>
    )
  }

  const role = (profile?.role?.toLowerCase() ?? 'founder') as string

  // Administrators land in the admin console, not a user dashboard.
  if (ADMIN_ROLES.includes(role as never) || profile?.is_admin) {
    return <Navigate to="/admin/dashboard" replace />
  }

  switch (role) {
    case 'investor':
      return <InvestorDashboard />
    case 'developer':
    case 'designer':
    case 'marketer':
      return <DeveloperDashboard />
    default:
      break
  }

  // Mentor / recruiter / business analyst / legal advisor get their own
  // professional dashboard instead of being silently pushed to the founder
  // one. (Founder and anything unknown fall through to FounderDashboard.)
  if (PROFESSIONAL_ROLES.includes(role as never)) {
    return <ProfessionalDashboard />
  }

  return <FounderDashboard />
}

export default RoleDashboard
