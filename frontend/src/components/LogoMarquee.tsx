import { Rocket, Zap, Globe, Users, TrendingUp, Shield, Code2, Briefcase } from 'lucide-react'

const logos = [
  { icon: Rocket, label: 'LaunchPad' },
  { icon: Zap, label: 'Velocity' },
  { icon: Globe, label: 'Orbit Global' },
  { icon: Users, label: 'Tribe VC' },
  { icon: TrendingUp, label: 'Ascend Fund' },
  { icon: Shield, label: 'Ironclad' },
  { icon: Code2, label: 'ByteForge' },
  { icon: Briefcase, label: 'Northwind' },
]

export function LogoMarquee() {
  return (
    <section className="border-b border-gray-200 bg-white py-12 dark:border-dark-300 dark:bg-dark-50">
      <div className="container-x">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">
          Trusted by founders and teams from
        </p>
        <div className="relative mt-8 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_15%,black_85%,transparent)]">
          <div className="marquee-track flex w-max items-center gap-16">
            {[...logos, ...logos].map((logo, i) => (
              <div
                key={`${logo.label}-${i}`}
                className="flex items-center gap-2 text-gray-400 opacity-70 transition-opacity duration-300 hover:opacity-100"
              >
                <logo.icon className="h-5 w-5" />
                <span className="whitespace-nowrap text-base font-bold tracking-tight">{logo.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
