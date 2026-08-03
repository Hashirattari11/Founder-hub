import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Rocket, Check } from 'lucide-react'

interface WaitlistModalProps {
  isOpen: boolean
  onClose: () => void
}

export function WaitlistModal({ isOpen, onClose }: WaitlistModalProps) {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.')
      return
    }
    setError('')
    setSubmitted(true)
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
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-2xl dark:border-dark-300 dark:bg-dark-100"
          >
            <button
              onClick={onClose}
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
                  soon as FounderHub AI opens to the public. Keep building!
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
                  Be first in line for FounderHub AI. Early access members get 3 months of
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
                  {error && <p className="text-sm text-red-500">{error}</p>}
                  <button type="submit" className="btn-primary w-full">
                    Reserve My Spot
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
