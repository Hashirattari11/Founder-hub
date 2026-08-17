import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Rocket, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getErrorMessage } from '../lib/errors'
import { notifyWaitlistSignup } from '../lib/communityNotify'

interface WaitlistModalProps {
  isOpen: boolean
  onClose: () => void
}

/** Real country list (ISO 3166 names) — users pick their country, no free text. */
const COUNTRIES = [
  'Afghanistan', 'Albania', 'Algeria', 'Argentina', 'Australia', 'Austria',
  'Azerbaijan', 'Bahrain', 'Bangladesh', 'Belgium', 'Brazil', 'Bulgaria',
  'Canada', 'Chile', 'China', 'Colombia', 'Croatia', 'Czechia',
  'Denmark', 'Egypt', 'Finland', 'France', 'Germany', 'Ghana',
  'Greece', 'Hong Kong', 'Hungary', 'Iceland', 'India', 'Indonesia',
  'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy', 'Japan', 'Jordan',
  'Kazakhstan', 'Kenya', 'Kuwait', 'Lebanon', 'Malaysia', 'Mexico',
  'Morocco', 'Netherlands', 'New Zealand', 'Nigeria', 'Norway', 'Oman',
  'Pakistan', 'Palestine', 'Philippines', 'Poland', 'Portugal', 'Qatar',
  'Romania', 'Russia', 'Saudi Arabia', 'Serbia', 'Singapore', 'Slovakia',
  'South Africa', 'South Korea', 'Spain', 'Sri Lanka', 'Sweden',
  'Switzerland', 'Taiwan', 'Thailand', 'Turkey', 'UAE', 'Ukraine',
  'United Kingdom', 'United States', 'Uzbekistan', 'Vietnam', 'Other',
]

export function WaitlistModal({ isOpen, onClose }: WaitlistModalProps) {
  const [email, setEmail] = useState('')
  const [country, setCountry] = useState('')
  const [city, setCity] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const resetForm = () => {
    setEmail('')
    setCountry('')
    setCity('')
    setError('')
    setSubmitted(false)
  }

  const close = () => {
    resetForm()
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.')
      return
    }
    if (!country) {
      setError('Please select your country.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      const { error: insertError } = await supabase.from('waitlist').insert({
        email: email.trim().toLowerCase(),
        country,
        city: city.trim(),
        source: 'landing',
      })
      if (insertError) {
        // Unique constraint hit → already on the list; treat as success.
        if (insertError.code === '23505' || /duplicate/i.test(insertError.message)) {
          setSubmitted(true)
          return
        }
        setError(getErrorMessage(insertError, 'generic'))
        return
      }
      setSubmitted(true)
      void notifyWaitlistSignup({
        email: email.trim().toLowerCase(),
        country,
        city: city.trim(),
      })
    } catch {
      setError('Could not join the waitlist. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={close}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-2xl dark:border-dark-300 dark:bg-dark-100"
          >
            <button
              onClick={close}
              aria-label="Close modal"
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-dark-200 dark:hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            {submitted ? (
              <div className="py-6 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-brand text-white shadow-lg shadow-primary/30">
                  <Check className="h-8 w-8" />
                </div>
                <h3 className="mt-6 text-2xl font-bold">You are on the list!</h3>
                <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                  We will reach out to <span className="font-semibold text-primary">{email}</span> as
                  soon as FounderHub opens to the public. Keep building!
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-brand text-white">
                    <Rocket className="h-6 w-6" />
                  </span>
                  <h3 className="text-2xl font-bold">Join the Waitlist</h3>
                </div>
                <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                  Be first in line for FounderHub. Early access members get 3 months of
                  Pro free.
                </p>

                <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@startup.com"
                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition-colors placeholder:text-gray-400 focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark"
                  />

                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className={`w-full appearance-none rounded-lg border bg-white px-4 py-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark ${
                      country ? 'text-gray-900 dark:text-white' : 'text-gray-400'
                    }`}
                  >
                    <option value="" disabled>
                      Select your country
                    </option>
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c} className="text-gray-900 dark:bg-dark-100 dark:text-white">
                        {c}
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="City (optional)"
                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition-colors placeholder:text-gray-400 focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark"
                  />

                  {error && <p className="text-sm text-red-500">{error}</p>}
                  <button type="submit" disabled={submitting} className="btn-primary w-full disabled:opacity-60">
                    {submitting ? 'Reserving…' : 'Reserve My Spot'}
                  </button>
                </form>

                <p className="mt-4 text-center text-xs text-gray-500">
                  No spam. Unsubscribe anytime.
                </p>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
