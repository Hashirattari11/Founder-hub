import { useEffect, useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string | number
  trend?: string
  trendUp?: boolean
  hint?: string
}

function AnimatedNumber({ value }: { value: string | number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const [display, setDisplay] = useState(0)
  const numeric = typeof value === 'number' ? value : parseInt(String(value).replace(/[^0-9.]/g, ''), 10) || 0
  const prefix = typeof value === 'string' ? String(value).replace(/[0-9.,]/g, '') : ''
  const suffix = typeof value === 'number' ? '' : String(value).match(/[^0-9.]/g)?.join('') ?? ''

  useEffect(() => {
    if (!inView) return
    const duration = 700
    const start = performance.now()
    let raf: number
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(Math.round(numeric * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [inView, numeric])

  return (
    <span ref={ref}>
      {prefix}
      {display.toLocaleString()}
      {suffix}
    </span>
  )
}

export function StatCard({ icon: Icon, label, value, trend, trendUp, hint }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      whileHover={{ y: -4 }}
      className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow duration-300 hover:shadow-xl hover:shadow-primary/10 dark:border-dark-300 dark:bg-dark-100"
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-brand opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-20" />
      <div className="group flex items-center justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 text-primary transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">
          <Icon className="h-5 w-5" />
        </span>
        {trend && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              trendUp
                ? 'bg-green-500/15 text-green-600 dark:text-green-400'
                : 'bg-red-500/15 text-red-500'
            }`}
          >
            {trend}
          </span>
        )}
      </div>
      <p className="mt-4 text-3xl font-extrabold tracking-tight">
        <AnimatedNumber value={value} />
      </p>
      <p className="mt-1 text-sm text-gray-500">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
    </motion.div>
  )
}
