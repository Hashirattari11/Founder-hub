import { motion } from 'framer-motion'
import {
  Wand2,
  Handshake,
  MessageSquare,
  LineChart,
  Lock,
  Users,
} from 'lucide-react'
import { SectionHeading } from './SectionHeading'

const features = [
  {
    icon: Wand2,
    title: 'AI Startup Generator',
    description:
      'Describe your idea and watch it become a full business plan, pitch deck outline, and product roadmap in seconds — powered by our AI engine.',
    gradient: 'from-primary to-primary-400',
  },
  {
    icon: Handshake,
    title: 'Smart Matching',
    description:
      'Our matching engine pairs founders with complementary developers and investors based on skills, stage, and vision — not just keywords.',
    gradient: 'from-accent to-accent-400',
  },
  {
    icon: MessageSquare,
    title: 'Real-time Messaging',
    description:
      'Chat instantly with your team, co-founders, and investors. Every conversation stays organized in one workspace, from first hello to exit.',
    gradient: 'from-primary to-accent',
  },
  {
    icon: LineChart,
    title: 'Investor Dashboard',
    description:
      'Track engagement, schedule calls, and manage your fundraising pipeline with a dashboard built for founders who move fast.',
    gradient: 'from-primary-500 to-primary-300',
  },
  {
    icon: Lock,
    title: 'Deal Room',
    description:
      'Securely share your pitch deck, financials, and term sheets behind a vault-grade room. Control exactly who sees what, and when.',
    gradient: 'from-accent-600 to-accent-400',
  },
  {
    icon: Users,
    title: 'Community Feed',
    description:
      'Get feedback, share wins, and find your next hire or co-founder in a feed curated around your industry and stage.',
    gradient: 'from-primary-600 to-primary-400',
  },
]

function TiltCard({ children }: { children: React.ReactNode }) {
  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const rect = el.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    el.style.transform = `perspective(900px) rotateX(${y * -6}deg) rotateY(${x * 8}deg) translateY(-6px)`
  }
  const handleLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg)'
  }
  return (
    <div onMouseMove={handleMove} onMouseLeave={handleLeave} className="transition-transform duration-300 ease-out will-change-transform">
      {children}
    </div>
  )
}

export function Features() {
  return (
    <section id="features" className="relative py-24 lg:py-32">
      <div className="hero-grid pointer-events-none absolute inset-0 opacity-60" />
      <div className="container-x relative">
        <SectionHeading
          eyebrow="Features"
          title="Everything You Need to Build a Startup"
          description="FounderHub combines AI, community, and deal-making tools into one operating system for your startup."
        />

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: index * 0.08 }}
            >
              <TiltCard>
                <div className="group relative h-full overflow-hidden rounded-2xl border border-gray-200 bg-white p-8 transition-shadow duration-300 hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/15 dark:border-dark-300 dark:bg-dark-100">
                  <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-gradient-brand opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-25" />
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${feature.gradient} text-white shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6`}
                  >
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-6 text-lg font-bold">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                    {feature.description}
                  </p>
                </div>
              </TiltCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
