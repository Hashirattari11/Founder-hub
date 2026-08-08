import { motion } from 'framer-motion'
import { Quote, Star } from 'lucide-react'
import { SectionHeading } from './SectionHeading'

interface Testimonial {
  quote: string
  name: string
  role: string
  initials: string
  gradient: string
}

const testimonials: Testimonial[] = [
  {
    quote:
      'FounderHub matched me with a technical co-founder in under a week. We just closed our pre-seed round — this platform is magic.',
    name: 'Priya Sharma',
    role: 'Founder, FinSprint',
    initials: 'PS',
    gradient: 'from-primary to-accent',
  },
  {
    quote:
      'The Deal Room changed how we raise. Investors see everything organized, and the analytics told us exactly who to follow up with.',
    name: 'Marcus Chen',
    role: 'CEO, Loopware',
    initials: 'MC',
    gradient: 'from-accent to-accent-400',
  },
  {
    quote:
      'As an investor, the AI matching is genuinely impressive. I reviewed 12 quality deals in my first month — all aligned with my thesis.',
    name: 'Aisha Patel',
    role: 'Angel Investor',
    initials: 'AP',
    gradient: 'from-primary-500 to-primary-300',
  },
  {
    quote:
      'Went from a rough idea to a full business plan in one afternoon. The AI generator feels like having a co-founder who never sleeps.',
    name: 'Daniel Osei',
    role: 'Founder, Kite Analytics',
    initials: 'DO',
    gradient: 'from-accent-600 to-accent-400',
  },
  {
    quote:
      'Our startup studio runs three portfolio companies on FounderHub. The messaging and meeting tools keep everything in one place.',
    name: 'Sofia Reyes',
    role: 'Studio Partner, Northwind',
    initials: 'SR',
    gradient: 'from-primary-600 to-primary-400',
  },
  {
    quote:
      'The community is real. Founders actually give feedback, share resources, and refer each other. It feels like a genuine network.',
    name: 'Vikram Rao',
    role: 'Developer, matching.io',
    initials: 'VR',
    gradient: 'from-accent to-primary',
  },
]

export function Testimonials() {
  return (
    <section id="testimonials" className="bg-white py-24 dark:bg-dark-50 lg:py-32">
      <div className="container-x">
        <SectionHeading
          eyebrow="Wall of Love"
          title="Loved by founders and investors"
          description="Join thousands of builders who found their team, their funding, and their momentum on FounderHub."
        />

        <div className="mt-16 columns-1 gap-6 sm:columns-2 lg:columns-3 [&>*]:mb-6">
          {testimonials.map((t, index) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: (index % 3) * 0.1 }}
              className="break-inside-avoid"
            >
              <div className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10 dark:border-dark-300 dark:bg-dark-100">
                <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-brand opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-20" />
                <Quote className="h-6 w-6 text-primary/30" />
                <p className="mt-4 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                  {t.quote}
                </p>
                <div className="mt-5 flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-3 border-t border-gray-100 pt-4 dark:border-dark-300">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${t.gradient} text-xs font-bold text-white`}
                  >
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-sm font-bold">{t.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t.role}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
