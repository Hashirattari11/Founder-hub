import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Shield, FileText, Cookie, Users, Mail, Rocket, ArrowRight, ChevronUp, Scale, AlertTriangle, Banknote, Lock } from 'lucide-react'
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

function useScrollSpy(ids: string[]) {
  const [active, setActive] = useState('')
  useEffect(() => {
    const onScroll = () => {
      let current = ''
      for (const id of ids) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top < 120) current = id
      }
      setActive(current)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [ids])
  return active
}

function BackToTop() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  if (!show) return null
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Back to top"
      className="fixed bottom-6 right-6 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-lg transition-all hover:-translate-y-1 hover:border-primary hover:text-primary dark:border-dark-300 dark:bg-dark-100 dark:text-gray-200"
    >
      <ChevronUp className="h-5 w-5" />
    </button>
  )
}

function StaticPageShell({ seoTitle, seoDescription, path, icon: Icon, eyebrow, title, subtitle, updated, sections }: StaticPageProps) {
  const sectionIds = sections.map((_, i) => `sec-${i}`)
  const activeId = useScrollSpy(sectionIds)
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

      {/* Content with TOC */}
      <section className="px-6 py-12">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[260px_1fr]">
          {/* TOC sidebar (desktop) */}
          <aside className="hidden lg:block">
            <div className="sticky top-6">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">On this page</p>
              <nav className="space-y-1 border-l border-gray-200 dark:border-dark-300">
                {sections.map((s, i) => (
                  <a
                    key={i}
                    href={`#${sectionIds[i]}`}
                    className={`block border-l-2 py-1.5 pl-4 text-sm transition-colors ${
                      activeId === sectionIds[i]
                        ? 'border-primary font-semibold text-primary'
                        : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                    }`}
                  >
                    {s.heading.replace(/^\d+\.\s*/, '')}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Sections */}
          <div className="max-w-3xl space-y-5">
            {sections.map((s, i) => (
              <article
                key={i}
                id={sectionIds[i]}
                className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm scroll-mt-24 dark:border-dark-300 dark:bg-dark-100"
              >
                <h2 className="text-lg font-bold">{s.heading}</h2>
                <p className="mt-2 whitespace-pre-line leading-relaxed text-gray-600 dark:text-gray-300">{s.body}</p>
              </article>
            ))}
            <p className="pt-2 text-center text-sm text-gray-400">
              Questions? <Link to="/contact" className="font-semibold text-primary hover:underline">Contact us</Link> or visit our{' '}
              <Link to="/legal" className="font-semibold text-primary hover:underline">Legal Center</Link>.
            </p>
          </div>
        </div>
      </section>
      <BackToTop />
    </div>
  )
}

export function PrivacyPage() {
  return (
    <StaticPageShell
      seoTitle="Privacy Policy — FounderHub AI"
      seoDescription="How FounderHub AI collects, uses, stores and protects your personal data, including your rights and how to delete your data."
      path="/privacy"
      icon={Shield}
      eyebrow="Privacy"
      title="Privacy Policy"
      subtitle="Your data stays yours. Here's exactly what we collect, why we store it, and how we protect it."
      updated="August 2026"
      sections={[
        { heading: '1. Information We Collect', body: 'We only collect information needed to operate FounderHub:\n• Account & profile information: name, email, role (founder/developer/designer/investor/marketer), skills, bio and avatar you provide.\n• Authentication information: email + password (hashed by Supabase Auth) or Google OAuth profile data when you sign in with Google.\n• Startup, job & community content: startups you publish, job posts, community posts, comments, likes and saved items.\n• Messages: the content of direct messages and meeting requests you exchange with other users.\n• Meeting information: scheduled times, participants, titles and notes.\n• Application information: applications you submit to startups or jobs and your response to applicants.\n• Usage information: pages visited, features used, AI tool usage and approximate interaction counts used to improve the platform.\n• Device/browser information: browser type and basic request metadata; we do not track precise location or install tracking pixels.\n\nWe do NOT collect financial account numbers, government IDs, or biometric data.' },
        { heading: '2. How We Use Your Information', body: 'We use your information to:\n• Operate your account, profile, matching, messaging, meetings, notifications and applications.\n• Send transactional email (verification, password resets, meeting invites, admin alerts) via Brevo.\n• Authenticate you via Supabase and Google OAuth.\n• Personalise AI Studio recommendations based on your profile and inputs.\n• Detect, prevent and respond to fraud, spam and abuse.\n• Improve and develop features based on aggregate usage patterns.\n\nWe never sell your personal data. We do not share it with advertisers.' },
        { heading: '3. How Information Is Stored & Processed', body: 'Your data is stored in a Supabase (PostgreSQL) database. Authentication is handled by Supabase Auth; Google OAuth is handled by Google and Supabase. Transactional email is processed by Brevo for delivery only. AI Studio requests are sent to your configured AI provider to generate responses. These third-party services act as processors under your use of FounderHub.' },
        { heading: '4. Third-Party Services', body: 'FounderHub integrates with: Supabase (database + auth), Google (OAuth sign-in), Brevo (transactional email), and your configured AI provider for AI Studio features. Each provider processes data under their own privacy terms. We share only the minimum data required to provide the feature (e.g. recipient email + message body for email delivery).' },
        { heading: '5. Data Retention', body: 'We keep your data while your account is active. When you delete content (a startup, post, comment, message), we remove it from active display and background processes. If you request full account deletion, we delete your profile, authored content and associated records. We retain limited logs (e.g. security audit logs) for a reasonable backup window after deletion where required to prevent abuse.' },
        { heading: '6. Security', body: 'We protect data with: Supabase row-level security (RLS) so users can only access their own data; role-based access control for admin features; hashed auth credentials; encrypted storage of AI API keys; rate limiting; and signed webhooks for email delivery events. No plaintext secrets are stored in client code or version control.' },
        { heading: '7. Cookies & Local Storage', body: 'FounderHub uses browser localStorage for your theme preference and Supabase auth session tokens. We do not use third-party advertising or tracking cookies. See our Cookie Policy for details and how to clear them.' },
        { heading: '8. Your Rights', body: 'You can: view and edit your profile anytime; adjust notification preferences; delete content you authored; and request full account deletion by contacting us. You can disconnect Google OAuth from your Google account settings at any time.' },
        { heading: '9. Children\'s Privacy', body: 'FounderHub is intended for professionals aged 16 and over. We do not knowingly collect data from children under 16. If you believe a minor has registered, contact us and we will remove the account.' },
        { heading: '10. International Users', body: 'FounderHub is a global platform. If you access us from outside the region where our infrastructure is hosted, your data is transferred to Supabase and Brevo infrastructure so we can operate the service. By using FounderHub you consent to such transfers.' },
        { heading: '11. Privacy Contact', body: 'For any privacy request — including data access, correction or deletion — contact us at notifications@founderhub.site or via our Contact page. We aim to respond within a reasonable timeframe.' },
      ]}
    />
  )
}

export function TermsPage() {
  return (
    <StaticPageShell
      seoTitle="Terms of Service — FounderHub AI"
      seoDescription="The terms and rules that govern your use of FounderHub AI, including accounts, content, AI features and marketplace activity."
      path="/terms"
      icon={FileText}
      eyebrow="Terms"
      title="Terms of Service"
      subtitle="Clear, fair rules for everyone building, investing and hiring on FounderHub."
      updated="August 2026"
      sections={[
        { heading: '1. Acceptance of Terms', body: 'By creating an account, signing in with Google OAuth, or otherwise using FounderHub, you agree to these Terms and our Privacy and Cookie Policies. If you do not agree, do not use the platform.' },
        { heading: '2. Eligibility', body: 'You must be at least 16 years old and legally able to enter contracts. By using FounderHub you confirm you meet these requirements.' },
        { heading: '3. Account Registration', body: 'You agree to provide accurate registration details, keep them current, safeguard your credentials and accept responsibility for activity under your account. Each user may maintain one account.' },
        { heading: '4. User Responsibilities', body: 'You agree to use FounderHub lawfully and respectfully: provide true information, do not impersonate others, do not submit content you do not have the right to share, and do not attempt to access data or systems you are not authorised to use.' },
        { heading: '5. Role-Based Accounts', body: 'FounderHub offers role dashboards for founders, investors, developers, designers, marketers and other professionals. Roles determine which features you can access (e.g. investor due-diligence, founder startup creation, admin tools). You must select a role that reflects your genuine intent and not misuse role-restricted features. Role changes are subject to admin approval where sensitive features are involved.' },
        { heading: '6. User-Generated Content', body: 'You retain ownership of content you publish (profiles, posts, comments, startups, documents). By publishing, you grant FounderHub a worldwide, non-exclusive, royalty-free licence to host, display, reproduce and process that content solely as needed to operate the platform. You are solely responsible for your content.' },
        { heading: '7. Startup Submissions', body: 'Founders are responsible for the accuracy of startup information, pitches, documents and cap-table data they publish. FounderHub does not verify every submission and does not guarantee that any startup is legitimate, successful or fundable.' },
        { heading: '8. Jobs and Applications', body: 'Employers are responsible for lawful, accurate job posts. Applicants are responsible for accurate materials. FounderHub is a listing and application platform, not a party to any employment relationship.' },
        { heading: '9. Messaging', body: 'Direct messaging and meeting requests are provided to facilitate genuine professional contact. Unsolicited mass messaging, spam, scams, phishing or harassment through the messaging system is prohibited and may result in immediate restriction.' },
        { heading: '10. Meetings', body: 'Scheduling and video-call features connect users for meetings. Participants are responsible for their conduct. FounderHub is not party to any agreement reached during a meeting and does not record or store call media unless a feature explicitly does so and is enabled by the participants.' },
        { heading: '11. AI Features', body: 'AI Studio tools (startup health, team-gap finder, investor readiness, matching, chat assistants, etc.) are provided "as-is" to assist your work. You must review AI output before business, legal or financial use. FounderHub is not liable for decisions made on the basis of AI output. Do not submit confidential client data or data you are not authorised to process through AI tools.' },
        { heading: '12. Prohibited Activities', body: 'Prohibited conduct is described in detail in our Acceptable Use Policy. In summary you must not: post spam, fraud, phishing, malware or misleading content; create fake startups, identities or investment opportunities; harass, impersonate or threaten others; access another user\'s data without authorisation; or attempt to disrupt, scrape or overload the platform.' },
        { heading: '13. Account Suspension & Termination', body: 'We may restrict, suspend or terminate accounts that violate these Terms or our policies. Typically we escalate through warning → restriction → suspension → termination, but serious violations (fraud, phishing, illegal activity) may result in immediate termination. You may delete your account at any time by contacting support.' },
        { heading: '14. Intellectual Property', body: 'FounderHub, its name, logo, software and design are owned by FounderHub. User content remains owned by users under the licence in section 6. See our Intellectual Property Policy for how to report infringement or claim ownership.' },
        { heading: '15. Third-Party Services', body: 'FounderHub integrates with third parties (Supabase, Google OAuth, Brevo, AI providers). We are not responsible for the acts of these providers; your use of their features is also governed by their own terms and privacy policies.' },
        { heading: '16. Platform Availability', body: 'We aim for high availability but do not guarantee uninterrupted access. Maintenance, outages and events beyond our control may cause downtime. We may change or discontinue features with reasonable notice.' },
        { heading: '17. Limitation of Liability', body: 'To the maximum extent permitted by law, FounderHub and its operators are not liable for indirect, incidental, special, consequential or punitive damages, or for loss of profits, data, investments or business opportunities arising from your use of the platform. Our total liability is limited to the amounts, if any, you have paid us in the preceding 12 months.' },
        { heading: '18. Disclaimer', body: 'FounderHub is provided "as-is" and "as-available" without warranties of any kind. We do not guarantee the accuracy, completeness or reliability of user-generated content or AI output. See our Disclaimer and Investor Disclaimer for important information about investment and advice.' },
        { heading: '19. Changes to Terms', body: 'We may update these Terms as the platform evolves. Material changes will be communicated in-app or by email. Continued use after changes take effect constitutes acceptance of the revised Terms.' },
        { heading: '20. Contact', body: 'Questions about these Terms? Contact us at notifications@founderhub.site or via our Contact page.' },
      ]}
    />
  )
}

export function CookiePage() {
  return (
    <StaticPageShell
      seoTitle="Cookie Policy — FounderHub AI"
      seoDescription="How FounderHub AI uses cookies and browser local storage, and how to control them."
      path="/cookies"
      icon={Cookie}
      eyebrow="Cookies"
      title="Cookie Policy"
      subtitle="A clear explanation of the small bits of browser storage FounderHub uses."
      updated="August 2026"
      sections={[
        { heading: '1. What Cookies & Local Storage Are', body: 'Cookies are small text files a website places in your browser. Local storage is similar — small data kept in your browser — and is used by FounderHub for preferences like your theme. Both help a site remember useful facts between page loads. FounderHub mostly uses local storage rather than traditional cookies.' },
        { heading: '2. Essential Cookies / Storage', body: 'These are required for FounderHub to work at all and cannot be turned off while you use the platform:\n• Authentication session — Supabase keeps a token in localStorage so you stay signed in between visits.\n• Theme preference — your light/dark choice is saved so the site renders correctly next time.\n• CSRF / route guards — minimal session data used by the router to keep navigation safe.' },
        { heading: '3. Authentication / Session Storage', body: 'Supabase Auth stores a refresh token in your browser so you remain logged in across page refreshes. Signing out clears this token. We do not share auth tokens with third parties.' },
        { heading: '4. Preference Storage', body: 'Your theme (light/dark) and any in-app UI preferences you toggle are stored in localStorage so they persist between visits. They are not used for tracking or advertising.' },
        { heading: '5. Analytics Cookies', body: 'FounderHub does not currently deploy third-party analytics or tracking cookies (such as Google Analytics advertising features). If we introduce analytics in the future, we will update this policy and will surface a consent choice where required by law.' },
        { heading: '6. Third-Party Cookies', body: 'When you sign in with Google OAuth, Google may set its own cookies on google.com domains to operate the sign-in flow. These are governed by Google\'s privacy policy. FounderHub itself does not set third-party advertising cookies.' },
        { heading: '7. How You Can Control Cookies', body: 'You can clear localStorage and cookies any time from your browser settings (usually under "Site data" or "Clear browsing data"). Clearing storage will sign you out and reset your theme. You can also browse in a private/incognito window for a session-only experience.' },
        { heading: '8. Contact', body: 'Questions about cookies or storage? Contact us at notifications@founderhub.site or via our Contact page.' },
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
  const cards = [
    { icon: Mail, title: 'General Support', body: 'Account issues, bugs, billing questions and product feedback.', email: 'notifications@founderhub.site' },
    { icon: Shield, title: 'Privacy & Data Requests', body: 'Data access, correction or deletion requests and privacy questions.', email: 'notifications@founderhub.site' },
    { icon: Lock, title: 'Security', body: 'Responsible disclosure of a security vulnerability. Do not post public details — email us first.', email: 'notifications@founderhub.site' },
    { icon: Scale, title: 'Legal', body: 'Legal notices, takedowns, copyright or trademark concerns and law-enforcement requests.', email: 'notifications@founderhub.site' },
  ]
  return (
    <div className="min-h-screen bg-white text-gray-900 dark:bg-dark dark:text-[#FAFAFA]">
      <Seo title="Contact — FounderHub AI" description="Get in touch with the FounderHub team — support, privacy, security and legal." path="/contact" />
      <section className="relative overflow-hidden border-b border-gray-200 bg-gradient-to-br from-gray-50 via-white to-primary/5 px-6 py-16 dark:border-dark-300 dark:from-dark dark:via-dark dark:to-primary/10">
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary dark:border-dark-300 dark:bg-dark-100">
            <Mail className="h-3.5 w-3.5" />
            Contact
          </span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">We'd love to hear from you</h1>
          <p className="mx-auto mt-3 max-w-2xl text-gray-500 dark:text-gray-400">
            Pick the area that matches your message. We aim to respond as quickly as we can.
          </p>
        </div>
      </section>

      <section className="px-6 py-12">
        <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-2">
          {cards.map((c) => (
            <a
              key={c.title}
              href={`mailto:${c.email}?subject=${encodeURIComponent(c.title)}`}
              className="group rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl dark:border-dark-300 dark:bg-dark-100"
            >
              <c.icon className="h-7 w-7 text-primary" />
              <h3 className="mt-3 font-bold">{c.title}</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{c.body}</p>
              <p className="mt-3 text-sm font-semibold text-primary">{c.email}</p>
            </a>
          ))}
        </div>
        <div className="mx-auto mt-10 max-w-4xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-dark-300 dark:bg-dark-100">
          <div className="grid gap-6 sm:grid-cols-2">
            <Link to="/community" className="group flex items-center gap-3">
              <Users className="h-6 w-6 text-primary" />
              <div>
                <h4 className="font-bold">Community</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">Join the discussion <ArrowRight className="inline h-3 w-3 transition-transform group-hover:translate-x-0.5" /></p>
              </div>
            </Link>
            <Link to="/legal" className="group flex items-center gap-3">
              <Scale className="h-6 w-6 text-primary" />
              <div>
                <h4 className="font-bold">Legal Center</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">Policies & trust documents <ArrowRight className="inline h-3 w-3 transition-transform group-hover:translate-x-0.5" /></p>
              </div>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

// ---------- New legal pages ----------

export function CommunityGuidelinesPage() {
  return (
    <StaticPageShell
      seoTitle="Community Guidelines — FounderHub AI"
      seoDescription="The rules that keep FounderHub a respectful, safe and useful place for founders, investors and talent."
      path="/community-guidelines"
      icon={Users}
      eyebrow="Community"
      title="Community Guidelines"
      subtitle="Simple rules so FounderHub stays a respectful, safe place for everyone building, investing and hiring."
      updated="August 2026"
      sections={[
        { heading: '1. Be Respectful', body: 'Treat every member with respect, even when you disagree. No harassment, hate, threats, personal insults or bullying in posts, comments or messages.' },
        { heading: '2. Be Honest', body: 'Post accurate information about yourself, your startup and your role. Do not impersonate others, invent startups, fake credentials or fabricate traction or investment interest.' },
        { heading: '3. Startup Posts', body: 'Share real startups with honest descriptions. Do not embellish traction or hide risks. Misrepresenting a startup to attract investors or applicants is not allowed.' },
        { heading: '4. Investor Interactions', body: 'Investors should engage in good faith. Do not pressure founders for unpaid work, request unreasonable terms or leak confidential data-room materials. FounderHub is not a party to any investment.' },
        { heading: '5. Job Posts', body: 'Post real jobs with real compensation. Do not advertise unpaid roles disguised as "opportunities" without clearly flagging them, and do not post discriminatory or misleading job ads.' },
        { heading: '6. Comments, Likes & Reposts', body: 'Engage authentically. Coordinated inauthentic behaviour (fake likes, mass-repost rings, paid engagement) is prohibited.' },
        { heading: '7. Messaging', body: 'Use messaging for genuine professional contact. No mass cold-spam, no pitching products in DMs, no scams, no phishing links, no unsolicited investment schemes.' },
        { heading: '8. No Scams or Fraud', body: 'No financial scams, fake investment offers, pyramid schemes or "guaranteed return" promises. If you see one, report it immediately.' },
        { heading: '9. No Impersonation or Fake Startups', body: 'Do not create profiles or startups pretending to be a real person or company, and do not fabricate startups whose only purpose is to collect data or "investment".' },
        { heading: '10. No Malicious Links or Malware', body: 'Do not share links to malware, phishing pages or harmful downloads anywhere on FounderHub, including DMs.' },
        { heading: '11. No Abusive Behavior', body: 'No harassment, sexual misconduct, doxxing or any behaviour that makes others feel unsafe or unwelcome.' },
        { heading: '12. Reporting Violations', body: 'If you see a violation, use the in-app report feature or contact us at notifications@founderhub.site. Provide details and any links. You will not be penalised for reporting in good faith.' },
        { heading: '13. Moderation & Enforcement', body: 'Our team reviews reports and acts as needed. Actions range from content removal, warnings and feature restrictions to account suspension and termination, consistent with our Terms and Acceptable Use Policy. Repeated or serious violations may result in immediate termination.' },
      ]}
    />
  )
}

export function AcceptableUsePage() {
  return (
    <StaticPageShell
      seoTitle="Acceptable Use Policy — FounderHub AI"
      seoDescription="What you may and may not do on FounderHub AI, and how violations are enforced."
      path="/acceptable-use"
      icon={Shield}
      eyebrow="Policy"
      title="Acceptable Use Policy"
      subtitle="The line between using FounderHub and abusing it — and the consequences of crossing it."
      updated="August 2026"
      sections={[
        { heading: '1. Acceptable Use', body: 'You may use FounderHub to build your profile, publish real startups and content, connect with members, apply to jobs and startups, schedule meetings and use AI Studio to assist your work — as long as you follow our Terms and these guidelines.' },
        { heading: '2. Prohibited Uses', body: 'You must not use FounderHub to:\n• Send spam, mass unsolicited messages or phishing attempts.\n• Commit fraud or run financial, investment or "guaranteed returns" scams.\n• Create fake identities, impersonate real people or fabricate startups.\n• Post malware or malicious links.\n• Harass, threaten, doxx or otherwise abuse others.\n• Circumvent access controls or attempt to access another user\'s data without permission.\n• Scrape the platform at scale, build bots to manipulate matching/engagement, or automate away human-only features.\n• Abuse the messaging or email systems (e.g. automated bulk DMs, redirecting FounderHub email to spam traps).\n• Abuse AI systems (e.g. prompt injection to extract other users\' data, generating illegal content, or violating your AI provider\'s usage policy).\n• Do anything illegal in your jurisdiction or ours.' },
        { heading: '3. Platform Manipulation', body: 'Activities like fake follower rings, coordinated inauthentic engagement, buying/selling accounts and mass-deleting content to evade moderation are prohibited.' },
        { heading: '4. Enforcement Ladder', body: 'Where appropriate we escalate as follows:\n1. Warning — first or minor issues.\n2. Restriction — certain features (messaging, posting, matching) limited.\n3. Suspension — temporary account lock.\n4. Termination — permanent removal for serious or repeat violations.\nSerious violations (fraud, illegal activity, phishing, child-safety issues) may skip straight to termination, and we may preserve evidence and notify authorities.' },
        { heading: '5. Reporting Abuse', body: 'To report abuse use the in-app report controls or email notifications@founderhub.site with the offending content, username and any links.' },
        { heading: '6. Changes', body: 'We may update this policy as new abuse patterns emerge. Material updates are communicated via the platform or email.' },
      ]}
    />
  )
}

export function IntellectualPropertyPage() {
  return (
    <StaticPageShell
      seoTitle="Intellectual Property Policy — FounderHub AI"
      seoDescription="Ownership of content, startups, logos and documents on FounderHub, and how to report infringement."
      path="/intellectual-property"
      icon={Scale}
      eyebrow="Intellectual Property"
      title="Intellectual Property Policy"
      subtitle="Who owns what on FounderHub, and how to raise a copyright or trademark concern."
      updated="August 2026"
      sections={[
        { heading: '1. FounderHub Intellectual Property', body: 'The FounderHub name, logo, software, design and brand are owned by FounderHub. You may not copy, clone or resell the platform or its branding, or use our marks to imply endorsement without permission.' },
        { heading: '2. User-Generated Content Ownership', body: 'You retain ownership of content you publish — profiles, posts, comments, startup descriptions, documents and images. FounderHub does not claim ownership of your startup ideas, pitches or materials.' },
        { heading: '3. Startup Information', body: 'Startup information, pitch content and business models remain owned by the founders who posted them. Publishing a startup on FounderHub does not transfer any IP to FounderHub.' },
        { heading: '4. Logos & Images', body: 'Company logos and images you upload remain your responsibility. You confirm you have the right to use any image or logo you upload, and you indemnify FounderHub against claims arising from uploaded material.' },
        { heading: '5. Uploaded Documents', body: 'Documents in data rooms (pitch decks, financials, cap tables, contracts) remain owned by the uploader. FounderHub only hosts and displays them to the audience the uploader chooses.' },
        { heading: '6. License to Operate the Platform', body: 'By publishing content you grant FounderHub a worldwide, non-exclusive, royalty-free licence to host, store, display, reproduce and process your content solely as needed to run the platform and show it to your intended audience. This licence ends when you delete the content.' },
        { heading: '7. Copyright Complaints', body: 'If you believe content on FounderHub infringes your copyright, email notifications@founderhub.site with: (a) your contact details; (b) identification of the copyrighted work; (c) the URL or description of the infringing material; (d) a good-faith statement; and (e) your physical or electronic signature. We will review and remove clearly infringing material.' },
        { heading: '8. Trademark Concerns', body: 'If a username, startup name, logo or other content misuses your trademark, contact us with proof of ownership. We may require rename or removal.' },
        { heading: '9. Counter-Notices', body: 'If your content was removed and you believe it was in error, you may submit a counter-notice with the same detail. We will assess and may restore the content if no legal action is initiated within a reasonable period.' },
        { heading: '10. Repeat Infringers', body: 'In accordance with platform policy, we may terminate accounts of users who are repeatedly determined to infringe the intellectual property of others.' },
      ]}
    />
  )
}

export function SecurityPage() {
  return (
    <StaticPageShell
      seoTitle="Security — FounderHub AI"
      seoDescription="How FounderHub AI protects accounts and data, and how to responsibly report a security issue."
      path="/security"
      icon={Lock}
      eyebrow="Trust & Security"
      title="Security"
      subtitle="How we keep FounderHub accounts and data safe — and how to report a vulnerability."
      updated="August 2026"
      sections={[
        { heading: '1. Account Security', body: 'We support email/password and Google OAuth sign-in. We encourage unique, strong passwords. Supabase Auth holds password hashes securely; we never see or store plaintext passwords.' },
        { heading: '2. Authentication & Sessions', body: 'Sessions are issued by Supabase Auth and refreshed via short-lived tokens stored in your browser. Sessions expire automatically and can be ended by signing out or revoking access in your profile.' },
        { heading: '3. Access Controls', body: 'FounderHub uses role-based access control (RBAC). Admin features are gated behind admin-role checks. Role changes for sensitive features (investor, admin) require explicit approval, so a normal user cannot self-elevate.' },
        { heading: '4. Data Protection', body: 'Database access is governed by Supabase row-level security (RLS) so that users can only read and write their own permitted rows. Encryption is applied at rest and in transit by our infrastructure providers. AI API keys are encrypted, never exposed to the client and never committed to version control.' },
        { heading: '5. Security Monitoring', body: 'We log security-relevant events, monitor for unusual activity on admin and auth flows, rate-limit sensitive endpoints, and verify inbound email delivery events through signed webhooks.' },
        { heading: '6. Responsible Disclosure', body: 'If you believe you have found a security issue, please do NOT post it publicly. Email notifications@founderhub.site with a clear description and reproduction steps. We will investigate and work with you on disclosure timing. We do not threaten good-faith reporters with legal action.' },
        { heading: '7. What We Do Not Do', body: 'We will never ask for your password, never email you asking to "verify" credentials via a third-party link, and never share your data outside the scope described in our Privacy Policy.' },
        { heading: '8. User Tips', body: 'Use a unique password, enable Google OAuth for a phishing-resistant option, review connected accounts, and report any suspicious message or email claiming to be from FounderHub.' },
      ]}
    />
  )
}

export function DisclaimerPage() {
  return (
    <StaticPageShell
      seoTitle="Disclaimer — FounderHub AI"
      seoDescription="FounderHub is a platform, not a provider of investment, legal, tax or business advice."
      path="/disclaimer"
      icon={AlertTriangle}
      eyebrow="Disclaimer"
      title="Disclaimer"
      subtitle="FounderHub is a technology platform — not a source of professional advice."
      updated="August 2026"
      sections={[
        { heading: '1. No Professional Advice', body: 'FounderHub is a networking and productivity platform for founders, investors and talent. Content on the platform — including AI Studio output, community posts, profiles and startup listings — is provided for general informational purposes only and does NOT constitute investment, financial, legal, tax or accounting advice.' },
        { heading: '2. No Guaranteed Funding', body: 'FounderHub does not guarantee that any founder will raise funding, secure investment through the platform or receive any specific number of investor introductions.' },
        { heading: '3. No Guaranteed Investment Returns', body: 'FounderHub does not guarantee that any investment opportunity posted or discovered through the platform will generate returns, succeed, or be suitable for any particular investor. All investments carry risk, including total loss of capital.' },
        { heading: '4. No Guaranteed Startup Success', body: 'FounderHub does not guarantee that any startup will succeed, grow, hire or reach the next milestone. Tools such as startup-health, team-gap finder and investor readiness are decision-support aids, not predictions of outcome.' },
        { heading: '5. User-Generated Content', body: 'Much of the information on FounderHub (startup descriptions, traction, community posts, comments) is contributed by users. We do not independently verify every claim and cannot warrant its accuracy. You are responsible for evaluating information before relying on it.' },
        { heading: '6. AI Output', body: 'AI Studio generates text based on your inputs using third-party AI models. Output may be incomplete, inaccurate or outdated. Always review AI output with a qualified professional before using it for business, legal or financial decisions.' },
        { heading: '7. No Fiduciary Relationship', body: 'Using FounderHub does not create a fiduciary, advisory or agency relationship between you and FounderHub.' },
        { heading: '8. External Links', body: 'FounderHub may link to third-party sites. We are not responsible for the content, accuracy or practices of those sites.' },
        { heading: '9. Obtain Professional Advice', body: 'Before making any investment, legal or tax decision you should consult a qualified, licensed professional in your jurisdiction.' },
      ]}
    />
  )
}

export function InvestorDisclaimerPage() {
  return (
    <StaticPageShell
      seoTitle="Investor Disclaimer — FounderHub AI"
      seoDescription="FounderHub does not guarantee that any startup is legitimate, successful or investable, and is not a broker-dealer or investment adviser."
      path="/investor-disclaimer"
      icon={Banknote}
      eyebrow="Investor Notice"
      title="Investor Disclaimer"
      subtitle="Important information for anyone evaluating startups or making investments discovered on FounderHub."
      updated="August 2026"
      sections={[
        { heading: '1. FounderHub Is a Networking & Discovery Platform', body: 'FounderHub helps founders and investors discover each other, share materials and communicate. It is a networking/discovery platform — not an investment fund, broker-dealer, investment adviser, crowdfunding portal, ATS or regulated exchange, unless and until the business formally registers as one with the relevant authorities.' },
        { heading: '2. No Endorsement of Startups', body: 'FounderHub does not guarantee that any startup listed on the platform is legitimate, viable, successful or investable. Listings and materials may be user-generated and unaudited. FounderHub does not perform due diligence on behalf of investors.' },
        { heading: '3. No Guaranteed Returns', body: 'FounderHub does not guarantee that any investment made through an introduction on the platform will generate returns. Startup investing is highly risky and many startups fail, potentially losing all invested capital.' },
        { heading: '4. You Must Perform Your Own Due Diligence', body: 'Before investing, you are responsible for conducting independent and professional due diligence — including but not limited to financial, legal, technical, market and background checks. Do not rely solely on FounderHub profiles, AI output or matching scores.' },
        { heading: '5. Investment Decisions Are Yours', body: 'Any decision to invest, and the terms of any investment, are made independently by you and the founder(s). FounderHub is not a party to any investment transaction and does not escrow, custody or transfer funds.' },
        { heading: '6. Platform Information May Be User-Generated', body: 'Startup profiles, pitch decks, cap tables and other materials are generally uploaded by founders. FounderHub does not verify their accuracy or completeness and cannot warrant that any representation is true.' },
        { heading: '7. Regulatory Status', body: 'FounderHub is not currently registered as a broker-dealer, investment adviser, funding portal or in any similar regulated capacity. We do not solicit investments, execute transactions or take transaction-based compensation. Nothing on the platform creates an investor-adviser relationship.' },
        { heading: '8. Eligibility & Compliance', body: 'Depending on your jurisdiction, private investing may be restricted to accredited, professional or qualifying investors, and may be subject to limits and disclosures. You are responsible for determining whether you are eligible to invest and for complying with local law.' },
        { heading: '9. Not Legal/Financial/Tax Advice', body: 'Nothing on FounderHub should be interpreted as financial, investment, legal or tax advice. Where appropriate, obtain advice from a qualified professional licensed in your jurisdiction before making any investment decision.' },
        { heading: '10. Risk Acknowledgement', body: 'By using FounderHub to discover or evaluate investment opportunities you acknowledge the high-risk nature of startup investing, accept full responsibility for your own decisions, and agree that FounderHub is not liable for any losses arising from such decisions.' },
      ]}
    />
  )
}

export function RefundPolicyPage() {
  return (
    <StaticPageShell
      seoTitle="Refund & Cancellation Policy — FounderHub AI"
      seoDescription="Cancellation, renewal and refund rules for paid FounderHub services when they are introduced."
      path="/refund-policy"
      icon={Banknote}
      eyebrow="Billing"
      title="Refund & Cancellation Policy"
      subtitle="How cancellation, renewal and refunds work for FounderHub paid services."
      updated="August 2026"
      sections={[
        { heading: '1. Current Status', body: 'As of this writing, FounderHub does not have paid consumer subscriptions — core features are free to use. This policy will apply when paid plans or services are introduced. We will publish specific plan terms and any applicable refund window at that time rather than inventing one now.' },
        { heading: '2. Subscription Cancellation', body: 'When paid plans are available, you will be able to cancel anytime from your account settings. Cancellation stops the next billing cycle and you keep access until the end of the period you already paid for.' },
        { heading: '3. Renewal', body: 'Paid plans renew automatically at the end of each billing period unless you cancel beforehand. We will clearly show the next renewal date in your account.' },
        { heading: '4. Refund Eligibility', body: 'A specific refund eligibility window will be defined when paid services launch. Until then, no refund commitments are made here on behalf of FounderHub. Any refund decisions will be made on the terms published at the time the paid service is sold.' },
        { heading: '5. Failed Payments', body: 'If a renewal payment fails, we will retry and notify you. Access to paid features may be paused until a valid payment method is provided. Failed payments do not result in charges.' },
        { heading: '6. Promotional & Discounted Pricing', body: 'Promotional prices apply for the stated duration only, then renew at the standard price. Promotional or discounted purchases may follow refund terms specific to that promotion, which will be disclosed at the time of purchase.' },
        { heading: '7. Changes to Paid Plans', body: 'We may change plan features and pricing over time. Existing subscribers will be informed in advance of material changes. Price increases take effect at the next renewal after notice; you may cancel before that renewal to avoid the increase.' },
        { heading: '8. Account Downgrade', body: 'Cancelling or downgrading may disable premium-only features. Content you created with those features stays yours, though some premium-only views or exports may no longer be accessible while your plan is in a lower tier.' },
        { heading: '9. Contact / Support', body: 'For any billing question or cancellation help, contact us at notifications@founderhub.site or via our Contact page.' },
      ]}
    />
  )
}

// ---------- Legal Center ----------

const legalCards = [
  { to: '/terms', icon: FileText, title: 'Terms of Service', body: 'The rules that govern your use of FounderHub — accounts, content, AI features and liability.' },
  { to: '/privacy', icon: Shield, title: 'Privacy Policy', body: 'What we collect, why, how we store it, and your rights including data deletion.' },
  { to: '/cookies', icon: Cookie, title: 'Cookie Policy', body: 'The small bits of browser storage we use and how you can control them.' },
  { to: '/community-guidelines', icon: Users, title: 'Community Guidelines', body: 'How to keep FounderHub respectful, safe and useful for everyone.' },
  { to: '/acceptable-use', icon: Scale, title: 'Acceptable Use Policy', body: 'What you may and may not do, and how violations are enforced.' },
  { to: '/intellectual-property', icon: Scale, title: 'Intellectual Property Policy', body: 'Who owns content, logos and documents, and how to report infringement.' },
  { to: '/security', icon: Lock, title: 'Security', body: 'How we protect accounts and data, and how to responsibly report a vulnerability.' },
  { to: '/disclaimer', icon: AlertTriangle, title: 'Disclaimer', body: 'FounderHub is a platform, not a source of professional advice.' },
  { to: '/investor-disclaimer', icon: Banknote, title: 'Investor Disclaimer', body: 'Important notices for anyone evaluating startups or investing on FounderHub.' },
  { to: '/refund-policy', icon: Banknote, title: 'Refund & Cancellation Policy', body: 'How cancellation, renewal and refunds work for paid services.' },
]

export function LegalCenterPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 dark:bg-dark dark:text-[#FAFAFA]">
      <Seo
        title="Legal Center — FounderHub AI"
        description="FounderHub's Legal & Trust Center — Terms, Privacy, Cookies, Security, Investor Disclaimer and other policies."
        path="/legal"
      />
      <section className="relative overflow-hidden border-b border-gray-200 bg-gradient-to-br from-gray-50 via-white to-primary/5 px-6 py-16 dark:border-dark-300 dark:from-dark dark:via-dark dark:to-primary/10">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary dark:border-dark-300 dark:bg-dark-100">
            <Scale className="h-3.5 w-3.5" />
            Legal & Trust Center
          </span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">Legal & Trust Center</h1>
          <p className="mx-auto mt-3 max-w-2xl text-gray-500 dark:text-gray-400">
            All FounderHub policies in one place. Last updated August 2026.
          </p>
        </div>
      </section>

      <section className="px-6 py-12">
        <div className="mx-auto grid max-w-6xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {legalCards.map((c) => (
            <Link
              key={c.to}
              to={c.to}
              className="group rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl dark:border-dark-300 dark:bg-dark-100"
            >
              <c.icon className="h-7 w-7 text-primary" />
              <h3 className="mt-3 font-bold">{c.title}</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{c.body}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                Read <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
        <p className="mx-auto mt-10 max-w-3xl rounded-2xl border border-gray-200 bg-gray-50 p-4 text-center text-xs text-gray-500 dark:border-dark-300 dark:bg-dark-100 dark:text-gray-400">
          These policies are product-level templates and should be reviewed by qualified legal counsel before launch — especially for investment/fundraising functionality and international users. Contact: notifications@founderhub.site
        </p>
      </section>
    </div>
  )
}
