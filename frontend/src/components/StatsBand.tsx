import { useEffect, useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import { TrendingUp, Rocket, Building2, Handshake } from 'lucide-react'

interface Stat {
  icon: typeof TrendingUp
  value: number
  suffix: string
  label: string
}

const stats: Stat[] = [
  { icon: Rocket, value: 500, suffix: '+', label: 'Startups building' },
  { icon: Building2, value: 120, suffix: '+', label: 'Investors on the platform' },
  { icon: Handshake, value: 1000, suffix: '+', label: 'Co-founder matches made' },
  { icon: TrendingUp, value: 40, suffix: '+', label: 'Business plans generated daily' },
]

function Counter({ value, suffix }: { value: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (!inView) return
    const duration = 1400
    const start = performance.now()
    let raf: number
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(Math.round(eased * value))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [inView, value])

  return (
    <span ref={ref}>
      {display}
      {suffix}
    </span>
  )
}

export function StatsBand() {
  return (
    <section className="relative border-y border-gray-200 bg-white py-16 dark:border-dark-300 dark:bg-dark-50">
      <div className="hero-grid pointer-events-none absolute inset-0 opacity-40" />
      <div className="container-x relative grid grid-cols-2 gap-8 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            className="group flex flex-col items-center text-center"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-brand text-white shadow-lg shadow-primary/25 transition-transform duration-300 group-hover:-translate-y-1 group-hover:rotate-6">
              <stat.icon className="h-6 w-6" />
            </div>
            <p className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              <Counter value={stat.value} suffix={stat.suffix} />
            </p>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{stat.label}</p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
