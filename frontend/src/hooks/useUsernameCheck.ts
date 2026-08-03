import { useEffect, useRef, useState } from 'react'
import { isUsernameAvailable } from '../lib/profile'

type Status = 'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'error'

export function useUsernameCheck(username: string, currentUserId?: string) {
  const [status, setStatus] = useState<Status>('idle')
  const [debounced, setDebounced] = useState(username)
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    const timer = setTimeout(() => setDebounced(username.trim().toLowerCase()), 500)
    return () => {
      isMounted.current = false
      clearTimeout(timer)
    }
  }, [username])

  useEffect(() => {
    if (!debounced) {
      setStatus('idle')
      return
    }
    if (!/^[a-z0-9_]{3,20}$/.test(debounced)) {
      setStatus('invalid')
      return
    }

    let cancelled = false
    setStatus('checking')

    isUsernameAvailable(debounced, currentUserId).then((available) => {
      if (cancelled || !isMounted.current) return
      setStatus(available ? 'available' : 'taken')
    }).catch((err) => {
      if (cancelled || !isMounted.current) return
      console.error('Username check failed:', err)
      setStatus('error')
    })

    return () => {
      cancelled = true
    }
  }, [debounced, currentUserId])

  return { status, debounced }
}
