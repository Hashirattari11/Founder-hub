import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useSession } from '../context/AuthContext'

/** Mark the current user online while the app is open (and last_seen on leave). */
export function useOnlinePresence() {
  const { user } = useSession()

  useEffect(() => {
    if (!user) return
    let cancelled = false

    const setStatus = async (online: boolean) => {
      if (cancelled) return
      await supabase
        .from('profiles')
        .update({ is_online: online, last_seen: new Date().toISOString() })
        .eq('id', user.id)
    }

    void setStatus(true)

    const handleUnload = () => {
      void supabase
        .from('profiles')
        .update({ is_online: false, last_seen: new Date().toISOString() })
        .eq('id', user.id)
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') handleUnload()
      else void setStatus(true)
    }

    window.addEventListener('beforeunload', handleUnload)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      cancelled = true
      window.removeEventListener('beforeunload', handleUnload)
      document.removeEventListener('visibilitychange', handleVisibility)
      void supabase
        .from('profiles')
        .update({ is_online: false, last_seen: new Date().toISOString() })
        .eq('id', user.id)
    }
  }, [user])
}
