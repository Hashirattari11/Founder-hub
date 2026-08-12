import { useCallback, useState } from 'react'
import toast from 'react-hot-toast'
import { getErrorMessage, type ErrorContext } from '../lib/errors'

interface UseErrorHandlerOptions {
  context?: ErrorContext
  toast?: boolean
}

export function useErrorHandler(options: UseErrorHandlerOptions = {}) {
  const { context = 'generic', toast: showToast = true } = options
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clearError = useCallback(() => setError(null), [])

  const handleError = useCallback(
    (err: unknown, overrideContext?: ErrorContext) => {
      const message = getErrorMessage(err, overrideContext ?? context)
      setError(message)
      if (showToast) toast.error(message)
      if (import.meta.env.DEV) console.error('[useErrorHandler]', err)
      return message
    },
    [context, showToast],
  )

  const run = useCallback(
    async <T>(fn: () => Promise<T>, overrideContext?: ErrorContext): Promise<T | null> => {
      setLoading(true)
      clearError()
      try {
        return await fn()
      } catch (err) {
        handleError(err, overrideContext)
        return null
      } finally {
        setLoading(false)
      }
    },
    [clearError, handleError],
  )

  return { loading, error, setError, clearError, handleError, run }
}
