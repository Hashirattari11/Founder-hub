import { NavLink } from 'react-router-dom'
import { Home, Compass, Briefcase, Users, Globe } from 'lucide-react'

const TABS = [
  { label: 'Home', to: '/dashboard', icon: Home },
  { label: 'Explore', to: '/explore', icon: Compass },
  { label: 'Jobs', to: '/jobs', icon: Briefcase },
  { label: 'Connections', to: '/connections', icon: Users },
  { label: 'Community', to: '/community', icon: Globe },
]

export function MobileBottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden dark:border-dark-300 dark:bg-dark/95">
      <div className="flex items-stretch justify-around">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-semibold transition-colors ${
                isActive
                  ? 'text-primary'
                  : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
              }`
            }
          >
            <tab.icon className="h-5 w-5" />
            <span className="truncate">{tab.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
