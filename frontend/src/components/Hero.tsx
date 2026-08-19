import { motion } from 'framer-motion'
import { Play, ArrowRight, Users, Sparkles, Rocket, ChevronDown } from 'lucide-react'

interface HeroProps {
  onJoinWaitlist: () => void
}

export function Hero({ onJoinWaitlist }: HeroProps) {
  return (
    <section id="top" className="relative overflow-hidden bg-dark">
      {/* Subtle background decoration — pure CSS, zero JS */}
      <div className="hero-grid pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute -inset-1/2 animate-spin-slow opacity-[0.10] blur-[100px]">
        <div className="animated-gradient absolute inset-0" />
      </div>
      {/* Soft gradient orbs — lightweight CSS */}
      <div className="pointer-events-none absolute inset-0">
        <div className="animate-float absolute left-[8%] top-[15%] h-64 w-64 rounded-full bg-primary/20 blur-[100px]" />
        <div className="animate-float-slow absolute right-[10%] top-[20%] h-80 w-80 rounded-full bg-accent/15 blur-[120px]" />
        <div className="animate-float absolute bottom-[20%] left-[45%] h-48 w-48 rounded-full bg-primary/15 blur-[90px]" style={{ animationDelay: '2s' }} />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-dark/50 to-dark" />

      {/* Center content */}
      <div className="container-x relative flex min-h-screen flex-col items-center justify-center px-6 pt-24 pb-16 text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm text-primary-300"
        >
          <Sparkles className="h-4 w-4" />
          Introducing FounderHub — the Startup OS
        </motion.div>

        {/* H1 */}
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="max-w-4xl text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-6xl lg:text-7xl"
        >
          FounderHub —{' '}
          <span className="bg-gradient-brand bg-clip-text text-transparent">
            Build, Connect & Grow
          </span>{' '}
          Your Startup
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mt-6 max-w-2xl text-lg text-gray-300 sm:text-xl"
        >
          Connect with co-founders, developers, investors, and AI tools — everything
          your startup needs.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mt-10 flex flex-col items-center gap-4 sm:flex-row"
        >
          <button
            onClick={onJoinWaitlist}
            className="btn-primary text-base group inline-flex items-center gap-2"
          >
            Start for Free
            <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
          </button>
          <button className="btn-ghost inline-flex items-center gap-2 border-white/20 text-white hover:border-white/50 hover:text-white">
            <Play className="h-5 w-5" />
            Watch Demo
          </button>
        </motion.div>

        {/* Social proof */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-16 flex items-center gap-4"
        >
          <div className="flex -space-x-3">
            {['JD', 'MK', 'AS', 'RP'].map((initials, i) => (
              <div
                key={initials}
                className={`flex h-10 w-10 items-center justify-center rounded-full border-2 border-dark text-xs font-bold text-white transition-transform duration-300 hover:z-10 hover:scale-110 ${
                  ['bg-primary', 'bg-accent', 'bg-primary-500', 'bg-accent-400'][i]
                }`}
              >
                {initials}
              </div>
            ))}
          </div>
          <div className="text-left">
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <svg key={i} className="h-4 w-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.958a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.367 2.446a1 1 0 00-.364 1.118l1.286 3.958c.3.922-.755 1.688-1.538 1.118l-3.367-2.446a1 1 0 00-1.175 0l-3.367 2.446c-.783.57-1.838-.196-1.538-1.118l1.286-3.958a1 1 0 00-.364-1.118L2.924 9.385c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.958z" />
                </svg>
              ))}
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-300">
              <Users className="h-4 w-4 text-primary-300" />
              <span className="font-semibold text-white">500+ founders</span> already building
            </p>
          </div>
        </motion.div>

        {/* Product dashboard preview card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="relative mt-20 w-full max-w-3xl"
        >
          <div className="relative z-10 rounded-3xl border border-white/15 bg-gradient-to-b from-white/10 to-white/5 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-brand text-white">
                  <Rocket className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-sm font-bold text-white">FounderHub Dashboard</p>
                  <p className="text-xs text-white/60">Your startup operating system</p>
                </div>
              </div>
              <span className="rounded-full bg-green-500/15 px-3 py-1 text-xs font-bold text-green-400">
                ● Live now
              </span>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-3">
              {[
                { label: 'Matches', value: '128' },
                { label: 'Investors', value: '42' },
                { label: 'Meetings', value: '8' },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
                  <p className="text-lg font-extrabold text-white">{stat.value}</p>
                  <p className="text-[11px] text-white/50">{stat.label}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-2/3 rounded-full bg-gradient-brand" />
            </div>
          </div>
          <div className="absolute -inset-3 -z-10 rounded-[2rem] bg-gradient-brand opacity-20 blur-2xl" />
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.a
        href="#features"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.8 }}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/50 transition-colors hover:text-white"
        aria-label="Scroll to features"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
        >
          <ChevronDown className="h-6 w-6" />
        </motion.div>
      </motion.a>
    </section>
  )
}
