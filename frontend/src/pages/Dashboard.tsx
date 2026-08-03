import { useSession } from '../context/AuthContext'
import FounderDashboard from './dashboard/FounderDashboard'
import DeveloperDashboard from './dashboard/DeveloperDashboard'
import InvestorDashboard from './dashboard/InvestorDashboard'

export function RoleDashboard() {
  const { profile, loading } = useSession()

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
      </div>
    )
  }

  switch (profile?.role?.toLowerCase()) {
    case 'investor':
      return <InvestorDashboard />
    case 'developer':
    case 'designer':
    case 'marketer':
      return <DeveloperDashboard />
    case 'founder':
    default:
      return <FounderDashboard />
  }
}

export default RoleDashboard
