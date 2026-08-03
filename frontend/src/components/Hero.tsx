import { motion } from 'framer-motion'
import { Play, ArrowRight, Users, Sparkles } from 'lucide-react'

interface HeroProps {
  onJoinWaitlist: () => void
}

export function Hero({ onJoinWaitlist }: HeroProps) {
  return (
    <section id="top" className="relative overflow-hidden bg-dark">
      <div className="animated-gradient pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent to-dark" />

      <div className="container-x relative flex min-h-screen flex-col items-center justify-center pt-24 pb-16 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm text-primary-300"
        >
          <Sparkles className="h-4 w-4" />
          Introducing FounderHub AI — the Startup OS
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="max-w-4xl text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-6xl lg:text-7xl"
        >
          From Idea to{' '}
          <span className="bg-gradient-brand bg-clip-text text-transparent">
            Funded Startup
          </span>{' '}
          — All in One Place
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mt-6 max-w-2xl text-lg text-gray-300 sm:text-xl"
        >
          Connect with co-founders, developers, investors, and AI tools — everything
          your startup needs.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mt-10 flex flex-col items-center gap-4 sm:flex-row"
        >
          <button onClick={onJoinWaitlist} className="btn-primary text-base">
            Start for Free
            <ArrowRight className="h-5 w-5" />
          </button>
          <button className="btn-ghost border-white/20 text-white hover:border-white/50 hover:text-white">
            <Play className="h-5 w-5" />
            Watch Demo
          </button>
        </motion.div>

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
                className={`flex h-10 w-10 items-center justify-center rounded-full border-2 border-dark text-xs font-bold text-white ${
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
      </div>

      <style>{`
        .animated-gradient {
          background: linear-gradient(135deg, #7C3AED 0%, #3B82F6 50%, #7C3AED 100%);
          background-size: 300% 300%;
          opacity: 0.18;
          filter: blur(80px);
          animation: gradientShift 8s ease infinite;
        }
        @keyframes gradientShift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>
    </section>
  )
}
