import { Link } from 'react-router-dom'
import { ShieldX, ArrowLeft, Home } from 'lucide-react'

export default function Forbidden() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-dark px-6 text-center">
      {/* Ambient background */}
      <div className="hero-grid pointer-events-none absolute inset-0" />
      <div className="animated-gradient pointer-events-none absolute -inset-1/2 animate-spin-slow opacity-[0.12] blur-[90px]" />
      <div className="pointer-events-none absolute left-[12%] top-[18%] h-44 w-44 animate-float rounded-full bg-red-500/15 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[14%] right-[10%] h-52 w-52 animate-float-slow rounded-full bg-primary/15 blur-3xl" />

      <div className="relative">
        <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
          <div className="absolute inset-0 animate-pulse rounded-3xl bg-red-500/30 blur-xl" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl border border-red-500/30 bg-red-500/10 shadow-2xl backdrop-blur-md">
            <ShieldX className="h-9 w-9 text-red-400" />
          </div>
        </div>
        <h1 className="mt-8 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">Access denied</h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-white/50">
          This section is only available for your current role. If you think this is a
          mistake, request a role change or contact an administrator.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/dashboard"
            className="group inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-6 py-3 text-sm font-bold text-white shadow-lg shadow-primary/30 transition-all hover:scale-[1.03] hover:shadow-primary/50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-bold text-white backdrop-blur-md transition-all hover:border-white/30 hover:bg-white/10"
          >
            <Home className="h-4 w-4" />
            Go Home
          </Link>
        </div>
      </div>
    </div>
  )
}
