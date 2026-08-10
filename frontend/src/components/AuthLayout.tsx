import { Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'

interface AuthLayoutProps {
  title: string
  subtitle: string
  children: ReactNode
}

export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen bg-white dark:bg-dark">
      <div className="relative hidden w-1/2 overflow-hidden bg-dark lg:block">
        <div className="pointer-events-none absolute inset-0 bg-gradient-brand opacity-20 blur-3xl" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="FounderHub" className="h-9 w-auto" />
            <span className="text-xl font-bold tracking-tight text-white">FounderHub</span>
          </Link>

          <div>
            <h2 className="max-w-md text-3xl font-bold leading-tight text-white">
              From idea to funded startup — all in one place.
            </h2>
            <p className="mt-4 max-w-md text-gray-300">
              Join 500+ founders building with AI, co-founders, and investors on the
              Startup OS.
            </p>
            <div className="mt-8 flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur">
              <Sparkles className="h-5 w-5 flex-shrink-0 text-primary-300" />
              <p className="text-sm text-gray-300">
                “We raised our seed round 3× faster using FounderHub's matching engine.”
              </p>
            </div>
          </div>

          <p className="text-sm text-gray-500">© {new Date().getFullYear()} FounderHub AI</p>
        </div>
      </div>

      <div className="flex w-full items-center justify-center px-4 py-12 lg:w-1/2">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 flex items-center gap-2 lg:hidden">
            <img src="/logo.png" alt="FounderHub" className="h-9 w-auto" />
            <span className="text-xl font-bold tracking-tight">FounderHub</span>
          </Link>

          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">{subtitle}</p>

          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  )
}
