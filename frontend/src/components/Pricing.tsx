import { Check } from 'lucide-react'
import { motion } from 'framer-motion'
import { SectionHeading } from './SectionHeading'

interface PricingProps {
  onJoinWaitlist: () => void
}

const tiers = [
  {
    name: 'Free',
    monthlyPrice: '$0',
    yearlyPrice: '$0',
    description: 'Everything you need to validate your idea.',
    features: [
      'Startup profile & community feed',
      'Basic founder matching',
      'Unlimited public messages',
      '1 active project',
      'Community support',
    ],
    cta: 'Start for Free',
    highlighted: false,
  },
  {
    name: 'Pro',
    monthlyPrice: '$29',
    yearlyPrice: '$24',
    description: 'For founders ready to raise and scale.',
    features: [
      'Everything in Free',
      'AI Startup Generator + pitch deck builder',
      'Priority matching with investors',
      'Deal Room with investor analytics',
      'Unlimited projects',
      'Advanced community insights',
    ],
    cta: 'Join Waitlist',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    monthlyPrice: 'Custom',
    yearlyPrice: 'Custom',
    description: 'For accelerators, VCs, and startup studios.',
    features: [
      'Everything in Pro',
      'White-label platform & API access',
      'Dedicated deal-flow pipeline',
      'Custom AI model training',
      'SSO, SLA, and dedicated support',
    ],
    cta: 'Contact Sales',
    highlighted: false,
  },
]

export function Pricing({ onJoinWaitlist }: PricingProps) {
  return (
    <section id="pricing" className="py-24 lg:py-32">
      <div className="container-x">
        <SectionHeading
          eyebrow="Pricing"
          title="Simple pricing that scales with you"
          description="Start free. Upgrade when you are ready to raise. Custom plans for teams."
        />

        <div className="mt-16 grid gap-8 lg:grid-cols-3">
          {tiers.map((tier, index) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={`relative flex flex-col rounded-2xl border p-8 ${
                tier.highlighted
                  ? 'border-transparent bg-gradient-to-b from-primary/10 to-accent/5 shadow-2xl shadow-primary/20 dark:border-primary/40'
                  : 'border-gray-200 bg-white dark:border-dark-300 dark:bg-dark-100'
              }`}
            >
              {tier.highlighted && (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-brand px-4 py-1 text-xs font-bold uppercase tracking-wider text-white">
                  Most Popular
                </span>
              )}

              <h3 className="text-lg font-bold">{tier.name}</h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{tier.description}</p>

              <div className="mt-6 flex items-end gap-1">
                <span className="text-4xl font-extrabold tracking-tight">{tier.monthlyPrice}</span>
                {tier.name !== 'Enterprise' && (
                  <span className="pb-1 text-sm text-gray-500">/ month</span>
                )}
              </div>
              {tier.name === 'Pro' && (
                <p className="mt-1 text-xs font-medium text-primary">
                  or {tier.yearlyPrice}/mo billed yearly
                </p>
              )}

              <ul className="mt-8 flex flex-col gap-3">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300">
                    <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                onClick={onJoinWaitlist}
                className={tier.highlighted ? 'btn-primary mt-8' : 'btn-ghost mt-8'}
              >
                {tier.cta}
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
