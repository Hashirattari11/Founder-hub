import { useState, Suspense } from 'react'
import { NavLink, Link, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Rocket,
  Home,
  FileText,
  BarChart3,
  Settings,
  Search,
  Menu,
  X,
  LogOut,
  User,
  Compass,
  Bookmark,
  Layers,
  Users,
  Bell,
  Mail,
  Briefcase,
  Video,
  Sparkles,
  Cpu,
  Handshake,
  Wallet,
  Scale,
  Shield,
} from 'lucide-react'
import { useSession } from '../../context/AuthContext'
import { useDashboardStore } from '../../store/dashboardStore'
import { useUnreadChatsCount } from '../../hooks/useUnreadChatsCount'
import { useAIStudioConfig } from '../../lib/aiStudio'
import { GuardedOutlet } from '../RoleGuard'
import { Avatar } from '../Avatar'
import { NotificationBell } from './NotificationBell'
import { MessagesButton } from '../MessagesButton'
import { MobileBottomNav } from '../MobileBottomNav'
import { PageLoader } from '../PageLoader'
import { PreviewBar } from './PreviewBar'
import { ROLE_LABELS } from '../../types'
import type { Role } from '../../types'

const navByRole: Record<Role, { label: string; to: string; icon: typeof Home }[]> = {
  founder: [
    { label: 'Home', to: '/dashboard', icon: Home },
    { label: 'Post a Startup', to: '/startups/create', icon: Rocket },
    { label: 'My Startups', to: '/dashboard/startups', icon: Layers },
    { label: 'Applications', to: '/dashboard/applications', icon: FileText },
    { label: 'Equity & Cap Table', to: '/dashboard/equity', icon: Scale },
    { label: 'AI Business Plan', to: '/business-plan', icon: FileText },
    { label: 'Jobs', to: '/jobs', icon: Briefcase },
    { label: 'Post a Job', to: '/jobs/post', icon: Rocket },
    { label: 'Manage Jobs', to: '/dashboard/manage-jobs', icon: FileText },
    { label: 'Find Co-Founder', to: '/co-founder', icon: Handshake },
    { label: 'Analytics', to: '/dashboard/analytics', icon: BarChart3 },
    { label: 'Community', to: '/community', icon: Users },
    { label: 'Connections', to: '/connections', icon: Users },
    { label: 'Meetings', to: '/meetings', icon: Video },
  ],
  developer: [
    { label: 'Home', to: '/dashboard', icon: Home },
    { label: 'Explore Startups', to: '/explore', icon: Compass },
    { label: 'Jobs', to: '/jobs', icon: Briefcase },
    { label: 'My Applications', to: '/dashboard/my-applications', icon: FileText },
    { label: 'My Job Applications', to: '/dashboard/job-applications', icon: FileText },
    { label: 'Resume Builder', to: '/resume-builder', icon: FileText },
    { label: 'Find Co-Founder', to: '/co-founder', icon: Handshake },
    { label: 'Community', to: '/community', icon: Users },
    { label: 'Connections', to: '/connections', icon: Users },
    { label: 'Meetings', to: '/meetings', icon: Video },
  ],
  designer: [
    { label: 'Home', to: '/dashboard', icon: Home },
    { label: 'Explore Startups', to: '/explore', icon: Compass },
    { label: 'Jobs', to: '/jobs', icon: Briefcase },
    { label: 'My Applications', to: '/dashboard/my-applications', icon: FileText },
    { label: 'My Job Applications', to: '/dashboard/job-applications', icon: FileText },
    { label: 'Resume Builder', to: '/resume-builder', icon: FileText },
    { label: 'Find Co-Founder', to: '/co-founder', icon: Handshake },
    { label: 'Community', to: '/community', icon: Users },
    { label: 'Connections', to: '/connections', icon: Users },
    { label: 'Meetings', to: '/meetings', icon: Video },
  ],
  marketer: [
    { label: 'Home', to: '/dashboard', icon: Home },
    { label: 'Explore Startups', to: '/explore', icon: Compass },
    { label: 'Jobs', to: '/jobs', icon: Briefcase },
    { label: 'My Applications', to: '/dashboard/my-applications', icon: FileText },
    { label: 'My Job Applications', to: '/dashboard/job-applications', icon: FileText },
    { label: 'Resume Builder', to: '/resume-builder', icon: FileText },
    { label: 'Find Co-Founder', to: '/co-founder', icon: Handshake },
    { label: 'Community', to: '/community', icon: Users },
    { label: 'Connections', to: '/connections', icon: Users },
    { label: 'Meetings', to: '/meetings', icon: Video },
  ],
  investor: [
    { label: 'Home', to: '/dashboard', icon: Home },
    { label: 'Explore Startups', to: '/explore', icon: Compass },
    { label: 'Investor Requests', to: '/investor/requests', icon: Handshake },
    { label: 'Investor Profile', to: '/investor/profile/setup', icon: Wallet },
    { label: 'Jobs', to: '/jobs', icon: Briefcase },
    { label: 'Saved', to: '/dashboard/saved', icon: Bookmark },
    { label: 'Community', to: '/community', icon: Users },
    { label: 'Connections', to: '/connections', icon: Users },
    { label: 'Meetings', to: '/meetings', icon: Video },
  ],
  legal_advisor: [
    { label: 'Home', to: '/dashboard', icon: Home },
    { label: 'Explore Startups', to: '/explore', icon: Compass },
    { label: 'Jobs', to: '/jobs', icon: Briefcase },
    { label: 'Find Co-Founder', to: '/co-founder', icon: Handshake },
    { label: 'Community', to: '/community', icon: Users },
    { label: 'Connections', to: '/connections', icon: Users },
    { label: 'Meetings', to: '/meetings', icon: Video },
  ],
  business_analyst: [
    { label: 'Home', to: '/dashboard', icon: Home },
    { label: 'Explore Startups', to: '/explore', icon: Compass },
    { label: 'Jobs', to: '/jobs', icon: Briefcase },
    { label: 'Find Co-Founder', to: '/co-founder', icon: Handshake },
    { label: 'Community', to: '/community', icon: Users },
    { label: 'Connections', to: '/connections', icon: Users },
    { label: 'Meetings', to: '/meetings', icon: Video },
  ],
  mentor: [
    { label: 'Home', to: '/dashboard', icon: Home },
    { label: 'Explore Startups', to: '/explore', icon: Compass },
    { label: 'Jobs', to: '/jobs', icon: Briefcase },
    { label: 'Find Co-Founder', to: '/co-founder', icon: Handshake },
    { label: 'Community', to: '/community', icon: Users },
    { label: 'Connections', to: '/connections', icon: Users },
    { label: 'Meetings', to: '/meetings', icon: Video },
  ],
  recruiter: [
    { label: 'Home', to: '/dashboard', icon: Home },
    { label: 'Explore Startups', to: '/explore', icon: Compass },
    { label: 'Jobs', to: '/jobs', icon: Briefcase },
    { label: 'Post a Job', to: '/jobs/post', icon: Rocket },
    { label: 'Manage Jobs', to: '/dashboard/manage-jobs', icon: FileText },
    { label: 'Community', to: '/community', icon: Users },
    { label: 'Connections', to: '/connections', icon: Users },
    { label: 'Meetings', to: '/meetings', icon: Video },
  ],
  administrator: [
    { label: 'Home', to: '/dashboard', icon: Home },
    { label: 'Admin Console', to: '/admin/dashboard', icon: Shield },
    { label: 'AI Studio Admin', to: '/admin/ai-studio', icon: Cpu },
    { label: 'Email Logs', to: '/admin/emails', icon: Mail },
    { label: 'Cap Table Admin', to: '/admin/equity', icon: Scale },
    { label: 'Community', to: '/community', icon: Users },
    { label: 'Connections', to: '/connections', icon: Users },
    { label: 'Meetings', to: '/meetings', icon: Video },
  ],
}

function SidebarContent({
  onNavigate,
  unreadCount,
}: {
  onNavigate?: () => void
  unreadCount: number
}) {
  const { profile, isPreviewing } = useSession()
  const { config: studioConfig } = useAIStudioConfig(profile?.id)
  const primaryRole = (profile?.role?.toLowerCase() as Role) ?? 'founder'
  const roles: Role[] = isPreviewing
    ? [primaryRole]
    : (studioConfig?.roles?.length ? studioConfig.roles : [primaryRole]) as Role[]
  const seen = new Set<string>()
  const links = roles.flatMap((r) => navByRole[r] ?? []).filter((link) => {
    if (seen.has(link.to)) return false
    seen.add(link.to)
    return true
  })
  if (!seen.has('/dashboard')) {
    links.unshift({ label: 'Home', to: '/dashboard', icon: Home })
  }

  return (
    <div className="flex h-full flex-col">
      <Link to="/" className="group flex items-center gap-2 px-6 py-6" onClick={onNavigate}>
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-brand text-white shadow-lg shadow-primary/30 transition-transform duration-300 group-hover:rotate-6 group-hover:scale-110">
          <Rocket className="h-5 w-5" />
        </span>
        <span className="text-xl font-bold tracking-tight">FounderHub</span>
      </Link>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {links.map((link) => (
          <NavLink
            key={link.to + link.label}
            to={link.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              `group relative flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-gray-600 hover:translate-x-0.5 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-dark-200 dark:hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId="sidebar-active"
                    className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-gradient-brand"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <link.icon className={`h-5 w-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-primary' : ''}`} />
                <span className="flex-1 truncate">{link.label}</span>
                {link.to === '/messages' && unreadCount > 0 && (
                  <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}

        <NavLink
          to="/ai-studio"
          onClick={onNavigate}
          className={({ isActive }) =>
            `group relative flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-gray-600 hover:translate-x-0.5 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-dark-200 dark:hover:text-white'
            }`
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <motion.span
                  layoutId="sidebar-active-ai"
                  className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-gradient-brand"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <Sparkles className={`h-5 w-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-primary' : ''}`} />
              <span className="flex-1 truncate">AI Studio</span>
            </>
          )}
        </NavLink>
      </nav>

      <div className="border-t border-gray-200 p-4 dark:border-dark-300">
        <div className="flex items-center gap-3">
          <Avatar src={profile?.avatar_url} name={profile?.full_name} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {profile?.full_name ?? 'New Member'}
            </p>
            <p className="truncate text-xs text-gray-500">
              {profile?.role ? ROLE_LABELS[profile.role.toLowerCase() as Role] : 'Set up your profile'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export function DashboardLayout() {
  const { user, profile, realProfile, signOut } = useSession()
  const { sidebarOpen, toggleSidebar, closeSidebar } = useDashboardStore()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const unreadCount = useUnreadChatsCount()
  // Admin shortcuts use the REAL profile so they stay available in preview mode.
  const isAdmin = Boolean(
    realProfile?.is_admin ||
      (realProfile?.role && ['administrator', 'admin'].includes(realProfile.role.toLowerCase())),
  )

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-gray-200 bg-white lg:block dark:border-dark-300 dark:bg-dark-100">
        <SidebarContent unreadCount={unreadCount} />
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
              <SidebarContent onNavigate={closeSidebar} unreadCount={unreadCount} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main column */}
      <div className="lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/80 backdrop-blur-xl dark:border-dark-300 dark:bg-dark/80">
          <div className="flex h-16 items-center gap-4 px-4 sm:px-6">
            <button
              onClick={toggleSidebar}
              aria-label="Toggle sidebar"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-600 lg:hidden dark:border-dark-300 dark:text-gray-300"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="relative hidden max-w-md flex-1 sm:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search startups, people, skills..."
                className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm outline-none transition-colors placeholder:text-gray-400 focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark"
              />
            </div>

            <div className="ml-auto flex items-center gap-3">
              <MessagesButton />
              <NotificationBell />

              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen((prev) => !prev)}
                  aria-label="User menu"
                  className="flex items-center gap-2"
                >
                  <Avatar src={profile?.avatar_url} name={profile?.full_name ?? user?.email} size="sm" />
                </button>

                <AnimatePresence>
                  {userMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-12 z-50 w-56 rounded-2xl border border-gray-200 bg-white p-2 shadow-2xl dark:border-dark-300 dark:bg-dark-100"
                    >
                      <div className="border-b border-gray-200 px-3 py-2 dark:border-dark-300">
                        <p className="truncate text-sm font-semibold">
                          {profile?.full_name ?? 'New Member'}
                        </p>
                        <p className="truncate text-xs text-gray-500">{user?.email}</p>
                      </div>
                      <button
                        onClick={() => {
                          setUserMenuOpen(false)
                          navigate(`/profile/${profile?.username ?? ''}`)
                        }}
                        className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-dark-200"
                      >
                        <User className="h-4 w-4" />
                        My Profile
                      </button>
                      <button
                        onClick={() => {
                          setUserMenuOpen(false)
                          navigate('/settings/profile')
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-dark-200"
                      >
                        <Settings className="h-4 w-4" />
                        Settings
                      </button>
                      <button
                        onClick={() => {
                          setUserMenuOpen(false)
                          navigate('/settings/notifications')
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-dark-200"
                      >
                        <Bell className="h-4 w-4" />
                        Notification Settings
                      </button>
                      <button
                        onClick={() => {
                          setUserMenuOpen(false)
                          navigate('/settings/ai')
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-dark-200"
                      >
                        <Cpu className="h-4 w-4" />
                        AI Settings
                      </button>
                      <button
                        onClick={() => {
                          setUserMenuOpen(false)
                          navigate('/settings/availability')
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-dark-200"
                      >
                        <Video className="h-4 w-4" />
                        My Availability
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => {
                            setUserMenuOpen(false)
                            navigate('/admin/dashboard')
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-dark-200"
                        >
                          <Shield className="h-4 w-4" />
                          Admin Console
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => {
                            setUserMenuOpen(false)
                            navigate('/admin/ai-studio')
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-dark-200"
                        >
                          <Cpu className="h-4 w-4" />
                          AI Studio Admin
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => {
                            setUserMenuOpen(false)
                            navigate('/admin/emails')
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-dark-200"
                        >
                          <Mail className="h-4 w-4" />
                          Email Logs
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => {
                            setUserMenuOpen(false)
                            navigate('/admin/equity')
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-dark-200"
                        >
                          <Scale className="h-4 w-4" />
                          Cap Table Admin
                        </button>
                      )}
                      <button
                        onClick={handleSignOut}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign Out
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </header>

        <main className="p-4 pb-24 sm:p-6 lg:p-8 lg:pb-8">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >
            <Suspense fallback={<PageLoader />}>
              <GuardedOutlet />
              <Outlet />
            </Suspense>
          </motion.div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <MobileBottomNav />

      {/* Role preview switcher (admins only) */}
      <PreviewBar />
    </div>
  )
}
