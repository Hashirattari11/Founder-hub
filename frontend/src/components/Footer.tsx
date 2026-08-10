import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Scale } from 'lucide-react'

const linkGroups = [
  {
    title: 'Product',
    links: [
      { label: 'Features', to: '/#features' },
      { label: 'How it Works', to: '/#how-it-works' },
      { label: 'Pricing', to: '/#pricing' },
      { label: 'Community', to: '/community' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', to: '/about' },
      { label: 'Contact', to: '/contact' },
      { label: 'Founder Stories', to: '/community/stories' },
      { label: 'Explore Startups', to: '/explore' },
    ],
  },
  {
    title: 'Legal & Trust',
    links: [
      { label: 'Legal Center', to: '/legal' },
      { label: 'Terms of Service', to: '/terms' },
      { label: 'Privacy Policy', to: '/privacy' },
      { label: 'Cookie Policy', to: '/cookies' },
      { label: 'Community Guidelines', to: '/community-guidelines' },
      { label: 'Acceptable Use', to: '/acceptable-use' },
    ],
  },
  {
    title: 'Policies',
    links: [
      { label: 'Intellectual Property', to: '/intellectual-property' },
      { label: 'Security', to: '/security' },
      { label: 'Disclaimer', to: '/disclaimer' },
      { label: 'Investor Disclaimer', to: '/investor-disclaimer' },
      { label: 'Refund Policy', to: '/refund-policy' },
    ],
  },
]

export function Footer() {
  const [email, setEmail] = useState('')
  const [subscribed, setSubscribed] = useState(false)

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return
    setSubscribed(true)
  }

  return (
    <footer className="border-t border-gray-200 bg-white py-16 dark:border-dark-300 dark:bg-dark-50">
      <div className="container-x">
        <div className="grid gap-12 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Link to="/" className="flex items-center gap-2">
              <img src="/logo.png" alt="FounderHub" className="h-9 w-auto" />
              <span className="text-xl font-bold tracking-tight">FounderHub</span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-gray-600 dark:text-gray-400">
              The Startup OS for modern founders. From idea to funded startup — all in
              one place.
            </p>

            <form onSubmit={handleSubscribe} className="mt-6 max-w-sm">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Get founder tips in your inbox
              </label>
              {subscribed ? (
                <p className="mt-3 flex items-center gap-2 text-sm font-medium text-green-500">
                  <Check className="h-4 w-4" /> You are subscribed. Welcome aboard!
                </p>
              ) : (
                <div className="mt-3 flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@startup.com"
                    className="input flex-1"
                  />
                  <button type="submit" className="btn-primary px-4">
                    Subscribe
                  </button>
                </div>
              )}
            </form>
          </div>

          {linkGroups.map((group) => (
            <div key={group.title}>
              <h4 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white">
                {group.title}
              </h4>
              <ul className="mt-4 flex flex-col gap-3">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link to={link.to} className="nav-link text-sm">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-gray-200 pt-8 sm:flex-row dark:border-dark-300">
          <p className="text-sm text-gray-500 dark:text-gray-500">
            © {new Date().getFullYear()} FounderHub AI. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link to="/legal" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
              <Scale className="h-3.5 w-3.5" /> Legal Center
            </Link>
            <span className="text-gray-300 dark:text-dark-400">·</span>
            <Link to="/privacy" className="text-sm text-gray-500 transition-colors hover:text-primary dark:text-gray-500">
              Privacy
            </Link>
            <Link to="/terms" className="text-sm text-gray-500 transition-colors hover:text-primary dark:text-gray-500">
              Terms
            </Link>
            <Link to="/cookies" className="text-sm text-gray-500 transition-colors hover:text-primary dark:text-gray-500">
              Cookies
            </Link>
            <Link to="/contact" className="text-sm text-gray-500 transition-colors hover:text-primary dark:text-gray-500">
              Contact
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
