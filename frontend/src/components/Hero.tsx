import { useRef, useState, useEffect, Suspense, lazy } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { Play, ArrowRight, Users, Sparkles, Rocket, Handshake, LineChart, ChevronDown } from 'lucide-react'
import { MagneticButton } from './ui/MagneticButton'

const HeroScene = lazy(() => import('./three/HeroScene'))

interface HeroProps {
  onJoinWaitlist: () => void
}

export function Hero({ onJoinWaitlist }: HeroProps) {
  const sectionRef = useRef<HTMLElement>(null)
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const sx = useSpring(mx, { stiffness: 120, damping: 20 })
  const sy = useSpring(my, { stiffness: 120, damping: 20 })

  // Parallax layers: far objects move less, near objects move more.
  const layerFarX = useTransform(sx, (v) => v * -18)
  const layerFarY = useTransform(sy, (v) => v * -12)
  const layerMidX = useTransform(sx, (v) => v * -30)
  const layerMidY = useTransform(sy, (v) => v * -20)
  const layerNearX = useTransform(sx, (v) => v * -45)
  const layerNearY = useTransform(sy, (v) => v * -30)
  const cardRotateX = useTransform(sy, (v) => v * -6)
  const cardRotateY = useTransform(sx, (v) => v * 8)

  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])

  const handleMouse = (e: React.MouseEvent) => {
    if (reduced || !sectionRef.current) return
    const rect = sectionRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    mx.set(x)
    my.set(y)
  }

  return (
    <section
      id="top"
      ref={sectionRef}
      onMouseMove={handleMouse}
      className="perspective-1000 relative overflow-hidden bg-dark"
    >
      <div className="hero-grid pointer-events-none absolute inset-0" />
      <div className="animated-gradient pointer-events-none absolute -inset-1/2 animate-spin-slow opacity-[0.13] blur-[90px]" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent to-dark" />

      {/* Interactive 3D WebGL scene */}
      {!reduced && (
        <div className="pointer-events-none absolute inset-0 opacity-70">
          <Suspense fallback={null}>
            <HeroScene />
          </Suspense>
        </div>
      )}

      {/* Floating 3D background orbs */}
      <motion.div style={{ x: layerFarX, y: layerFarY }} className="pointer-events-none absolute inset-0">
        <div className="animate-float absolute left-[8%] top-[18%] h-40 w-40 rounded-full bg-primary/25 blur-2xl" />
        <div className="animate-float-slow absolute right-[10%] top-[24%] h-56 w-56 rounded-full bg-accent/20 blur-3xl" />
        <div className="animate-float absolute bottom-[18%] left-[42%] h-32 w-32 rounded-full bg-primary/20 blur-2xl" style={{ animationDelay: '2s' }} />
      </motion.div>

      {/* Floating glass cards (3D depth) */}
      <motion.div
        style={{ x: layerMidX, y: layerMidY }}
        className="pointer-events-none absolute inset-0 hidden md:block"
      >
        <div className="animate-float absolute right-[12%] top-[20%]">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-brand text-white">
              <Handshake className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-bold text-white">Co-founder matched</p>
              <p className="text-[11px] text-white/60">94% compatibility</p>
            </div>
          </div>
        </div>
        <div className="animate-float absolute bottom-[24%] left-[8%]" style={{ animationDelay: '1.5s' }}>
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-400 text-white">
              <LineChart className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-bold text-white">Investor interest</p>
              <p className="text-[11px] text-white/60">3 new inbounds</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Center content */}
      <div className="container-x relative flex min-h-screen flex-col items-center justify-center pt-24 pb-16 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm text-primary-300"
        >
          <Sparkles className="h-4 w-4" />
          Introducing FounderHub — the Startup OS
        </motion.div>

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
          <MagneticButton
            onClick={onJoinWaitlist}
            className="btn-primary text-base group"
          >
            Start for Free
            <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
          </MagneticButton>
          <MagneticButton className="btn-ghost border-white/20 text-white hover:border-white/50 hover:text-white">
            <Play className="h-5 w-5" />
            Watch Demo
          </MagneticButton>
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

        {/* Interactive 3D product card at the bottom */}
        <motion.div
          style={{
            rotateX: cardRotateX,
            rotateY: cardRotateY,
            transformStyle: 'preserve-3d',
          }}
          className="relative mt-20 w-full max-w-3xl"
        >
          <motion.div
            style={{ x: layerNearX, y: layerNearY }}
            className="relative z-10 rounded-3xl border border-white/15 bg-gradient-to-b from-white/10 to-white/5 p-6 shadow-2xl backdrop-blur-xl sm:p-8"
          >
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
          </motion.div>
          <div className="absolute -inset-3 -z-10 rounded-[2rem] bg-gradient-brand opacity-30 blur-2xl" />
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

      <style>{`
        @keyframes gradientShift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>
    </section>
  )
}
