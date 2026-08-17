import { motion } from 'framer-motion'
import { ArrowRight, Sparkles } from 'lucide-react'
import { MagneticButton } from './ui/MagneticButton'

export function FinalCTA({ onJoinWaitlist }: { onJoinWaitlist: () => void }) {
  return (
    <section className="relative py-24 lg:py-32">
      <div className="container-x">
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.97 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/15 via-dark to-accent/15 px-6 py-16 text-center sm:px-16 sm:py-20"
        >
          <div className="hero-grid pointer-events-none absolute inset-0 opacity-60" />
          <div className="animated-gradient pointer-events-none absolute -inset-1/2 animate-spin-slow opacity-20 blur-[100px]" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent to-dark/40" />

          <motion.div
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.15 }}
            className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-brand text-white shadow-xl shadow-primary/40 animate-pulse-ring"
          >
            <Sparkles className="h-8 w-8" />
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="relative mx-auto mt-8 max-w-3xl text-3xl font-extrabold tracking-tight sm:text-5xl"
          >
            Get Started With{' '}
            <span className="bg-gradient-brand bg-clip-text text-transparent">FounderHub</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="relative mx-auto mt-5 max-w-xl text-lg text-gray-300"
          >
            Join the waitlist today and get 3 months of Pro free when we launch. Your co-founder, team, and
            investors are already here.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.45 }}
            className="relative mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <MagneticButton onClick={onJoinWaitlist} className="btn-primary btn-shine text-base group">
              Get Early Access
              <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
            </MagneticButton>
            <span className="text-sm text-gray-400">Free forever plan · No credit card</span>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
