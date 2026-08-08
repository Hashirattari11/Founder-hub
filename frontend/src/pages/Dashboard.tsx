import { Navigate } from 'react-router-dom'
import { useSession } from '../context/AuthContext'
import { ADMIN_ROLES } from '../lib/permissions'
import FounderDashboard from './dashboard/FounderDashboard'
import DeveloperDashboard from './dashboard/DeveloperDashboard'
import DesignerDashboard from './dashboard/DesignerDashboard'
import MarketerDashboard from './dashboard/MarketerDashboard'
import InvestorDashboard from './dashboard/InvestorDashboard'
import MentorDashboard from './dashboard/MentorDashboard'
import RecruiterDashboard from './dashboard/RecruiterDashboard'
import BusinessAnalystDashboard from './dashboard/BusinessAnalystDashboard'
import LegalAdvisorDashboard from './dashboard/LegalAdvisorDashboard'

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

  // Every role gets a dashboard designed around its own purpose.
  switch (role) {
    case 'investor':
      return <InvestorDashboard />
    case 'developer':
      return <DeveloperDashboard />
    case 'designer':
      return <DesignerDashboard />
    case 'marketer':
      return <MarketerDashboard />
    case 'mentor':
      return <MentorDashboard />
    case 'recruiter':
      return <RecruiterDashboard />
    case 'business_analyst':
      return <BusinessAnalystDashboard />
    case 'legal_advisor':
      return <LegalAdvisorDashboard />
    default:
      // Founder and anything unknown fall through to the founder dashboard.
      return <FounderDashboard />
  }
}

export default RoleDashboard
