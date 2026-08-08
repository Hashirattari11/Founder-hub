import { Link } from 'react-router-dom'
import { Shield, FileText, Cookie, Users, Mail, Rocket, ArrowRight } from 'lucide-react'
import { Seo } from '../../components/Seo'

interface Section {
  heading: string
  body: string
}

interface StaticPageProps {
  seoTitle: string
  seoDescription: string
  path: string
  icon: typeof Shield
  eyebrow: string
  title: string
  subtitle: string
  updated: string
  sections: Section[]
}

function StaticPageShell({ seoTitle, seoDescription, path, icon: Icon, eyebrow, title, subtitle, updated, sections }: StaticPageProps) {
  return (
    <div className="min-h-screen bg-white text-gray-900 dark:bg-dark dark:text-[#FAFAFA]">
      <Seo title={seoTitle} description={seoDescription} path={path} />
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-gray-200 bg-gradient-to-br from-gray-50 via-white to-primary/5 px-6 py-16 dark:border-dark-300 dark:from-dark dark:via-dark dark:to-primary/10">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary dark:border-dark-300 dark:bg-dark-100">
            <Icon className="h-3.5 w-3.5" />
            {eyebrow}
          </span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mx-auto mt-3 max-w-2xl text-gray-500 dark:text-gray-400">{subtitle}</p>
          <p className="mt-4 text-xs font-medium text-gray-400">Last updated: {updated}</p>
        </div>
      </section>

      {/* Content */}
      <section className="px-6 py-12">
        <div className="mx-auto max-w-3xl space-y-8">
          {sections.map((s, i) => (
            <article key={i} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-dark-300 dark:bg-dark-100">
              <h2 className="text-lg font-bold">{s.heading}</h2>
              <p className="mt-2 whitespace-pre-line leading-relaxed text-gray-600 dark:text-gray-300">{s.body}</p>
            </article>
          ))}
          <p className="text-center text-sm text-gray-400">
            Questions? <Link to="/contact" className="font-semibold text-primary hover:underline">Contact us</Link> or join the{' '}
            <Link to="/community" className="font-semibold text-primary hover:underline">FounderHub community</Link>.
          </p>
        </div>
      </section>
    </div>
  )
}

export function PrivacyPage() {
  return (
    <StaticPageShell
      seoTitle="Privacy Policy — FounderHub AI"
      seoDescription="How FounderHub AI collects, uses and protects your personal data."
      path="/privacy"
      icon={Shield}
      eyebrow="Legal"
      title="Privacy Policy"
      subtitle="Your data stays yours. Here's exactly what we collect, why, and how we protect it."
      updated="August 2026"
      sections={[
        { heading: '1. Information We Collect', body: 'Account details (name, email, profile role and skills you provide), content you publish (startups, applications, messages, community posts), and usage data (pages visited, AI tool usage). We never sell your personal data.' },
        { heading: '2. How We Use Your Data', body: 'To operate FounderHub (matching, messaging, notifications, meetings), send transactional emails (Brevo), personalize AI recommendations, and improve the platform. AI Studio requests are processed by your configured provider.' },
        { heading: '3. Data You Control', body: 'You can edit your profile anytime, adjust notification preferences, request role changes, and delete content you authored. Contact us to request account data deletion.' },
        { heading: '4. Sharing', body: 'Your public profile and published startups are visible to other members. Private messages and data rooms are only shared with the people you choose.' },
        { heading: '5. Security', body: 'We use Supabase-managed authentication (JWT), role-based access control, rate limiting, and encrypted AI API keys. No plaintext secrets are stored in code.' },
        { heading: '6. Cookies & Tracking', body: 'We use localStorage for your theme preference and Supabase auth sessions. See our Cookie Policy for details.' },
      ]}
    />
  )
}

export function TermsPage() {
  return (
    <StaticPageShell
      seoTitle="Terms of Service — FounderHub AI"
      seoDescription="The terms that govern your use of the FounderHub AI platform."
      path="/terms"
      icon={FileText}
      eyebrow="Legal"
      title="Terms of Service"
      subtitle="Clear, fair rules for everyone building on FounderHub."
      updated="August 2026"
      sections={[
        { heading: '1. Acceptance of Terms', body: 'By creating an account or using FounderHub AI, you agree to these Terms. If you do not agree, please do not use the platform.' },
        { heading: '2. Your Account', body: 'You are responsible for safeguarding your credentials and for activity under your account. You must provide accurate profile information and keep it current.' },
        { heading: '3. Acceptable Use', body: 'Do not post illegal content, spam, malware, or infringing material. Do not attempt to access other users\' data or disrupt platform infrastructure.' },
        { heading: '4. Content Ownership', body: 'You retain ownership of the content you publish. By publishing, you grant FounderHub a limited license to host, display and process it to operate the platform.' },
        { heading: '5. AI Features', body: 'AI Studio tools are provided as-is. Output should be reviewed before business use. FounderHub is not liable for decisions made based on AI output.' },
        { heading: '6. Termination', body: 'We may suspend accounts that violate these Terms. You may delete your account at any time by contacting support.' },
      ]}
    />
  )
}

export function CookiePage() {
  return (
    <StaticPageShell
      seoTitle="Cookie Policy — FounderHub AI"
      seoDescription="How FounderHub AI uses cookies and local storage."
      path="/cookies"
      icon={Cookie}
      eyebrow="Legal"
      title="Cookie Policy"
      subtitle="A simple explanation of the storage we use to make FounderHub work."
      updated="August 2026"
      sections={[
        { heading: '1. What We Use', body: 'FounderHub uses browser localStorage for your theme preference and authentication session tokens via Supabase. No third-party advertising trackers are used.' },
        { heading: '2. Auth Sessions', body: 'Supabase stores a refresh token in local storage to keep you signed in across visits. You can sign out at any time, which clears the session.' },
        { heading: '3. Preferences', body: 'Your theme choice (light/dark) is saved locally so the site renders correctly on your next visit.' },
        { heading: '4. Managing Storage', body: 'You can clear site data through your browser settings at any time. Clearing storage will sign you out and reset your theme preference.' },
      ]}
    />
  )
}

export function AboutPage() {
  return (
    <StaticPageShell
      seoTitle="About — FounderHub AI"
      seoDescription="FounderHub is the all-in-one operating system for startups — from idea to funded."
      path="/about"
      icon={Rocket}
      eyebrow="Our Mission"
      title="The operating system for startups"
      subtitle="FounderHub connects founders with co-founders, talent, investors and AI tools — so you can move from idea to funded faster."
      updated="August 2026"
      sections={[
        { heading: 'Our Mission', body: 'Nine out of ten startups fail — mostly from not finding the right teammates, funding, or focus. FounderHub exists to change that with one platform: match with the right people, raise intelligently, and let AI carry the busywork.' },
        { heading: 'One Platform, Every Role', body: 'Founders build. Investors discover. Developers, designers and marketers find startups that need them. Mentors guide. Analysts decode. Legal advisors protect. Every role has a purpose-built dashboard — not a copy of the founder\'s.' },
        { heading: 'Built Premium, Built to Scale', body: 'Realtime messaging and notifications, AI Studio, investor matching, data rooms, cap tables, meetings, and an enterprise admin console — engineered with strict role-based security at the core.' },
      ]}
    />
  )
}

export function ContactPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 dark:bg-dark dark:text-[#FAFAFA]">
      <Seo title="Contact — FounderHub AI" description="Get in touch with the FounderHub team." path="/contact" />
      <section className="relative overflow-hidden border-b border-gray-200 bg-gradient-to-br from-gray-50 via-white to-primary/5 px-6 py-16 dark:border-dark-300 dark:from-dark dark:via-dark dark:to-primary/10">
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary dark:border-dark-300 dark:bg-dark-100">
            <Mail className="h-3.5 w-3.5" />
            Contact
          </span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">We'd love to hear from you</h1>
          <p className="mx-auto mt-3 max-w-2xl text-gray-500 dark:text-gray-400">
            Feedback, partnerships, or support — reach out and we'll get back to you.
          </p>
        </div>
      </section>

      <section className="px-6 py-12">
        <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-3">
          <a href="mailto:support@founderhub.ai" className="group rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl dark:border-dark-300 dark:bg-dark-100">
            <Mail className="mx-auto h-7 w-7 text-primary" />
            <h3 className="mt-3 font-bold">Support</h3>
            <p className="mt-1 text-sm text-gray-500">support@founderhub.ai</p>
          </a>
          <Link to="/community" className="group rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl dark:border-dark-300 dark:bg-dark-100">
            <Users className="mx-auto h-7 w-7 text-primary" />
            <h3 className="mt-3 font-bold">Community</h3>
            <p className="mt-1 text-sm text-gray-500">Join the discussion</p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">
              Open <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
          <Link to="/community/stories" className="group rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl dark:border-dark-300 dark:bg-dark-100">
            <Rocket className="mx-auto h-7 w-7 text-primary" />
            <h3 className="mt-3 font-bold">Founder Stories</h3>
            <p className="mt-1 text-sm text-gray-500">Read how founders win</p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">
              Open <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        </div>
      </section>
    </div>
  )
}
