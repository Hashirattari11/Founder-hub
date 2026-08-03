import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Rocket, Menu, Settings, LogOut, User, ChevronLeft } from 'lucide-react'
import { useSession } from '../context/AuthContext'
import { Avatar } from './Avatar'
import { NotificationBell } from './dashboard/NotificationBell'

interface AppHeaderProps {
  title?: string
  backTo?: string
}

export function AppHeader({ title, backTo }: AppHeaderProps) {
  const { profile, user, signOut } = useSession()
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/80 backdrop-blur-xl dark:border-dark-300 dark:bg-dark/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
        {backTo ? (
          <button
            onClick={() => navigate(backTo)}
            aria-label="Back"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition-colors hover:border-primary hover:text-primary dark:border-dark-300 dark:text-gray-300"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        ) : (
          <Link to={user ? '/dashboard' : '/'} className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-brand text-white">
              <Rocket className="h-5 w-5" />
            </span>
            <span className="hidden text-sm font-bold text-gray-600 sm:block dark:text-gray-400">
              Back to Dashboard
            </span>
          </Link>
        )}

        {title && (
          <h1 className="hidden truncate text-base font-bold sm:block">{title}</h1>
        )}

        <div className="ml-auto flex items-center gap-3">
          <NotificationBell />

          <div className="relative">
            <button
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-label="User menu"
              className="flex items-center gap-2"
            >
              <Avatar src={profile?.avatar_url} name={profile?.full_name ?? user?.email} size="sm" />
              <Menu className="h-4 w-4 text-gray-500 lg:hidden" />
            </button>

            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-12 z-50 w-56 rounded-2xl border border-gray-200 bg-white p-2 shadow-2xl dark:border-dark-300 dark:bg-dark-100"
                >
                  <div className="border-b border-gray-200 px-3 py-2 dark:border-dark-300">
                    <p className="truncate text-sm font-semibold">{profile?.full_name ?? 'New Member'}</p>
                    <p className="truncate text-xs text-gray-500">{user?.email}</p>
                  </div>
                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      navigate('/dashboard')
                    }}
                    className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-dark-200"
                  >
                    <Rocket className="h-4 w-4" />
                    Dashboard
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      navigate(`/profile/${profile?.username ?? ''}`)
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-dark-200"
                  >
                    <User className="h-4 w-4" />
                    My Profile
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      navigate('/settings/profile')
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-dark-200"
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </button>
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
  )
}
