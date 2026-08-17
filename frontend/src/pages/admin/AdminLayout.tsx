import { useState, Suspense } from 'react'
import { NavLink, Link, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity,
  BarChart3,
  Bell,
  ChevronLeft,
  CreditCard,
  Cpu,
  FileText,
  Flag,
  LayoutDashboard,
  ListTodo,
  Mail,
  Menu,
  Rocket,
  Scale,
  ScrollText,
  Settings,
  ShieldAlert,
  Sparkles,
  Radar,
  UserCog,
  Users,
  Users2,
  Video,
  Wallet,
  X,
} from 'lucide-react'
import { useSession } from '../../context/AuthContext'
import { Avatar } from '../../components/Avatar'
import { isAdminProfile, isSuperAdminProfile } from '../../lib/admin'
import { PageLoader } from '../../components/PageLoader'
import { PreviewBar } from '../../components/dashboard/PreviewBar'

interface NavItem {
  label: string
  to: string
  icon: typeof Users
  end?: boolean
}

const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', to: '/admin/dashboard', icon: LayoutDashboard, end: true },
    ],
  },
  {
    title: 'Management',
    items: [
      { label: 'Users', to: '/admin/users', icon: Users },
      { label: 'Startups', to: '/admin/startups', icon: Rocket },
      { label: 'Meetings', to: '/admin/meetings', icon: Video },
      { label: 'Investors', to: '/admin/investors', icon: Wallet },
      { label: 'Role Requests', to: '/admin/role-requests', icon: UserCog },
      { label: 'Reports', to: '/admin/reports', icon: Flag },
      { label: 'Startup Members', to: '/admin/startup-members', icon: Users2 },
      { label: 'Messages', to: '/admin/messages', icon: Mail },
      { label: 'Waitlist', to: '/admin/waitlist', icon: ListTodo },
      { label: 'Equity / Cap Tables', to: '/admin/equity', icon: Scale },
    ],
  },
  {
    title: 'Insights',
    items: [
      { label: 'Analytics', to: '/admin/analytics', icon: BarChart3 },
      { label: 'Health', to: '/admin/health', icon: Activity },
      { label: 'Audit Logs', to: '/admin/audit-logs', icon: ScrollText },
      { label: 'Notifications', to: '/admin/notifications', icon: Bell },
      { label: 'Email Logs', to: '/admin/emails', icon: Mail },
    ],
  },
  {
    title: 'Content & AI',
    items: [
      { label: 'CMS', to: '/admin/cms', icon: FileText },
      { label: 'Policies & Trust Center', to: '/admin/policies', icon: Scale },
      { label: 'AI Management', to: '/admin/ai', icon: Cpu },
      { label: 'AI Studio Tools', to: '/admin/ai-studio', icon: Sparkles },
      { label: 'AI Features', to: '/admin/ai-features', icon: Radar },
    ],
  },
  {
    title: 'System',
    items: [
      { label: 'Settings', to: '/admin/settings', icon: Settings },
      { label: 'Security', to: '/admin/security', icon: ShieldAlert },
      { label: 'Subscriptions', to: '/admin/subscriptions', icon: CreditCard },
    ],
  },
]

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { realProfile, user } = useSession()
  const superAdmin = isSuperAdminProfile(realProfile)
  const admin = isAdminProfile(realProfile)

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-5 py-6">
        <img src="/logo.png" alt="FounderHub" width="36" height="36" className="h-9 w-auto" />
        <div className="min-w-0">
          <p className="text-sm font-bold tracking-tight">Admin Console</p>
          <p className="text-[11px] text-gray-400">
            {superAdmin ? 'Super Admin' : admin ? 'Administrator' : 'Restricted'}
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-6">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-dark-200 dark:hover:text-white'
                    }`
                  }
                >
                  <item.icon className="h-4 w-4" />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-gray-200 p-4 dark:border-dark-300">
        <div className="flex items-center gap-3">
          <Avatar src={realProfile?.avatar_url} name={realProfile?.full_name} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{realProfile?.full_name ?? 'Admin'}</p>
            <p className="truncate text-xs text-gray-500">{user?.email ?? ''}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AdminLayout() {
  const { realProfile, user, signOut } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const closeSidebar = () => setSidebarOpen(false)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-gray-200 bg-white lg:block dark:border-dark-300 dark:bg-dark-100">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeSidebar}
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'tween', duration: 0.2 }}
              className="fixed inset-y-0 left-0 z-50 w-64 border-r border-gray-200 bg-white lg:hidden dark:border-dark-300 dark:bg-dark-100"
            >
              <button
                onClick={closeSidebar}
                aria-label="Close menu"
                className="absolute right-4 top-6 text-gray-500"
              >
                <X className="h-5 w-5" />
              </button>
              <SidebarContent onNavigate={closeSidebar} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main column */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/80 backdrop-blur-xl dark:border-dark-300 dark:bg-dark/80">
          <div className="flex h-16 items-center gap-4 px-4 sm:px-6">
            <button
              onClick={() => setSidebarOpen((prev) => !prev)}
              aria-label="Toggle admin menu"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-600 lg:hidden dark:border-dark-300 dark:text-gray-300"
            >
              <Menu className="h-5 w-5" />
            </button>

            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-2 text-sm font-medium text-gray-600 transition-colors hover:border-primary hover:text-primary dark:border-dark-300 dark:text-gray-300"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back to Dashboard</span>
            </button>

            <div className="ml-auto flex items-center gap-3">
              <Link
                to="/admin/notifications"
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:border-primary hover:text-primary dark:border-dark-300 dark:text-gray-400"
                aria-label="Admin notifications"
              >
                <Bell className="h-4 w-4" />
              </Link>
              <div className="flex items-center gap-2">
                <Avatar src={realProfile?.avatar_url} name={realProfile?.full_name ?? user?.email} size="sm" />
                <div className="hidden md:block">
                  <p className="text-sm font-semibold leading-tight">
                    {realProfile?.full_name ?? 'Admin'}
                  </p>
                  <p className="text-xs leading-tight text-gray-500">
                    {realProfile?.is_super_admin ? 'Super Admin' : 'Administrator'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 transition-colors hover:border-red-300 hover:text-red-500 dark:border-dark-300 dark:text-gray-300"
              >
                Sign out
              </button>
            </div>
          </div>
        </header>

        <main className="p-4 pb-24 sm:p-6 lg:p-8 lg:pb-8">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </motion.div>
        </main>
      </div>

      {/* Role preview switcher (admins only) */}
      <PreviewBar />
    </div>
  )
}
