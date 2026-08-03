import { useEffect, useState } from 'react'

export function useDelayedLoading(ms = 900) {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), ms)
    return () => clearTimeout(timer)
  }, [ms])

  return loading
}
