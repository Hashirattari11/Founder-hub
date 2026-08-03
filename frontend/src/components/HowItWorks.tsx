import { Lightbulb, Zap, Rocket } from 'lucide-react'
import { Reveal } from './Reveal'
import { SectionHeading } from './SectionHeading'

const steps = [
  {
    icon: Lightbulb,
    step: '01',
    title: 'Post your startup idea',
    description:
      'Drop your idea in minutes — what you are building, the problem it solves, and the skills you need. AI instantly shapes it into a shareable startup profile.',
  },
  {
    icon: Zap,
    step: '02',
    title: 'Get matched instantly',
    description:
      'Our matching engine scans 500+ founders, developers, and investors to surface the best-fit people for your stage, industry, and goals.',
  },
  {
    icon: Rocket,
    step: '03',
    title: 'Connect and build',
    description:
      'Start private conversations, move into the Deal Room, and begin building with your new team. Launch your product and raise your first round.',
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-white py-24 dark:bg-dark-50 lg:py-32">
      <div className="container-x">
        <SectionHeading
          eyebrow="How it Works"
          title="Three steps to your launch"
          description="From a rough idea to a funded team in record time."
        />

        <div className="relative mt-16 grid gap-10 md:grid-cols-3">
          <div className="absolute left-0 right-0 top-10 hidden h-px bg-gradient-to-r from-primary/0 via-primary/40 to-accent/0 md:block" />

          {steps.map((step, index) => (
            <Reveal key={step.step} delay={index * 0.15} className="relative text-center">
              <div className="relative z-10 mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-brand text-white shadow-xl shadow-primary/25">
                <step.icon className="h-9 w-9" />
                <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-bold text-primary shadow-md dark:bg-dark">
                  {step.step}
                </span>
              </div>
              <h3 className="mt-6 text-xl font-bold">{step.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                {step.description}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
