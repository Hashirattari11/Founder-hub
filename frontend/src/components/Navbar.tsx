import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence, useScroll, useSpring } from 'framer-motion'
import { Menu, X, Moon, Sun, ArrowRight, Sparkles } from 'lucide-react'
import { useTheme } from '../hooks/useTheme'
import { MagneticButton } from './ui/MagneticButton'

interface NavbarProps {
  onJoinWaitlist: () => void
}

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'How it Works', href: '#how-it-works' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
]

export function Navbar({ onJoinWaitlist }: NavbarProps) {
  const { theme, toggleTheme } = useTheme()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  const { scrollYProgress } = useScroll()
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 })

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setMenuOpen(false)
  }, [location])

  return (
    <>
      {/* Announcement bar */}
      <div className="fixed inset-x-0 top-0 z-50 bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_100%] animate-gradient-x">
        <div className="container-x flex h-9 items-center justify-center gap-2 text-center">
          <Sparkles className="h-3.5 w-3.5 text-white/90" />
          <p className="text-xs font-medium text-white sm:text-sm">
            <span className="hidden sm:inline">Early access is open — </span>
            Join the waitlist for <span className="font-bold">3 months of Pro free</span>.
          </p>
        </div>
      </div>

      <header
        className={`fixed inset-x-0 top-9 z-50 transition-all duration-500 ${
          scrolled
            ? 'border-b border-gray-200 bg-white/80 shadow-lg shadow-black/5 backdrop-blur-xl dark:border-dark-300 dark:bg-dark/80'
            : 'bg-transparent'
        }`}
      >
        <nav className="container-x flex h-16 items-center justify-between">
          <a href="#top" className="group flex items-center gap-2">
            <img
              src="/logo.png"
              alt="FounderHub"
              className="h-9 w-auto transition-transform duration-300 group-hover:rotate-6 group-hover:scale-110"
            />
            <span className="text-xl font-bold tracking-tight">FounderHub</span>
          </a>

          <div className="hidden items-center gap-8 md:flex">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} className="nav-link">
                {link.label}
              </a>
            ))}
            <Link to="/community" className="nav-link">
              Community
            </Link>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-gray-600 transition-all duration-300 hover:scale-105 hover:border-primary hover:text-primary dark:border-dark-300 dark:text-gray-300"
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <Link to="/login" className="btn-ghost">
              Log In
            </Link>
            <MagneticButton onClick={onJoinWaitlist} className="btn-primary group">
              Join Waitlist
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </MagneticButton>
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-gray-600 dark:border-dark-300 dark:text-gray-300"
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <button
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-label="Toggle menu"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-gray-600 dark:border-dark-300 dark:text-gray-300"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </nav>

        {/* Scroll progress bar */}
        <motion.div
          style={{ scaleX: progress }}
          className="absolute bottom-0 left-0 h-0.5 w-full origin-left bg-gradient-brand"
        />

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="border-b border-gray-200 bg-white dark:border-dark-300 dark:bg-dark md:hidden"
            >
              <div className="container-x flex flex-col gap-1 py-4">
                {navLinks.map((link, i) => (
                  <motion.a
                    key={link.href}
                    href={link.href}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => setMenuOpen(false)}
                    className="rounded-xl px-3 py-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-primary dark:text-gray-300 dark:hover:bg-dark-100 dark:hover:text-white"
                  >
                    {link.label}
                  </motion.a>
                ))}
                <motion.div
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <Link
                    to="/community"
                    onClick={() => setMenuOpen(false)}
                    className="block rounded-xl px-3 py-3 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-primary dark:text-gray-300 dark:hover:bg-dark-100 dark:hover:text-white"
                  >
                    Community
                  </Link>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 }}
                  className="flex gap-2"
                >
                  <Link to="/login" onClick={() => setMenuOpen(false)} className="btn-ghost mt-2 w-full">
                    Log In
                  </Link>
                  <Link to="/register" onClick={() => setMenuOpen(false)} className="btn-primary mt-2 w-full">
                    Sign Up
                  </Link>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
    </>
  )
}
