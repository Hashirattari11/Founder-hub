import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import confetti from 'canvas-confetti'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Rocket } from 'lucide-react'

interface ConfettiSuccessProps {
  open: boolean
  title: string
  message: string
  primaryAction: { label: string; to: string }
  secondaryAction?: { label: string; to: string }
}

export function ConfettiSuccess({
  open,
  title,
  message,
  primaryAction,
  secondaryAction,
}: ConfettiSuccessProps) {
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    const end = Date.now() + 1200
    const colors = ['#7C3AED', '#3B82F6', '#22c55e', '#f59e0b']
    const frame = () => {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 60,
        origin: { x: 0, y: 0.7 },
        colors,
      })
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 60,
        origin: { x: 1, y: 0.7 },
        colors,
      })
      if (Date.now() < end) requestAnimationFrame(frame)
    }
    frame()
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 22, stiffness: 280 }}
            className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-2xl dark:border-dark-300 dark:bg-dark-100"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.15, type: 'spring', damping: 12 }}
              className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-brand text-white shadow-lg shadow-primary/40"
            >
              <Check className="h-10 w-10" />
            </motion.div>

            <h2 className="mt-5 text-2xl font-extrabold">{title}</h2>
            <p className="mt-2 text-sm text-gray-500">{message}</p>

            <div className="mt-6 flex flex-col gap-3">
              <button onClick={() => navigate(primaryAction.to)} className="btn-primary">
                <Rocket className="h-4 w-4" />
                {primaryAction.label}
              </button>
              {secondaryAction && (
                <button onClick={() => navigate(secondaryAction.to)} className="btn-ghost">
                  {secondaryAction.label}
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
