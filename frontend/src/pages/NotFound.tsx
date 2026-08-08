import { Link } from 'react-router-dom'
import { Rocket, Home, ArrowLeft } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-dark px-6 text-center">
      {/* Ambient background */}
      <div className="hero-grid pointer-events-none absolute inset-0" />
      <div className="animated-gradient pointer-events-none absolute -inset-1/2 animate-spin-slow opacity-[0.15] blur-[90px]" />
      <div className="pointer-events-none absolute left-[10%] top-[15%] h-48 w-48 animate-float rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[12%] right-[8%] h-56 w-56 animate-float-slow rounded-full bg-accent/15 blur-3xl" />

      <div className="relative">
        <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
          <div className="absolute inset-0 animate-pulse rounded-3xl bg-gradient-brand opacity-40 blur-xl" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-brand text-white shadow-2xl">
            <Rocket className="h-9 w-9" />
          </div>
        </div>
        <h1 className="mt-8 text-8xl font-black tracking-tighter text-white sm:text-9xl">
          <span className="bg-gradient-brand bg-clip-text text-transparent">404</span>
        </h1>
        <p className="mt-4 text-lg font-semibold text-white">This page went to orbit</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-white/50">
          The page you&apos;re looking for doesn&apos;t exist or has been moved. Let&apos;s get you back on course.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/"
            className="group inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-6 py-3 text-sm font-bold text-white shadow-lg shadow-primary/30 transition-all hover:scale-[1.03] hover:shadow-primary/50"
          >
            <Home className="h-4 w-4" />
            Back to Home
          </Link>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-bold text-white backdrop-blur-md transition-all hover:border-white/30 hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            My Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
