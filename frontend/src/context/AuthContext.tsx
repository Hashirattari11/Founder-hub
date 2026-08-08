import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { invalidateStudioConfig } from '../lib/aiStudio'
import type { User, Profile } from '../types'

interface AuthContextValue {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const userIdRef = useRef<string | null>(null)
  const lastRoleRef = useRef<string | null>(null)

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    const next = (data as Profile | null) ?? null
    setProfile(next)
    if (next?.role && next.role !== lastRoleRef.current) {
      lastRoleRef.current = next.role
      // The AI studio config is role-aware (model/provider presets) — drop the
      // cache when the user's role changes so features update immediately.
      invalidateStudioConfig()
    }
  }

  async function refreshProfile() {
    if (user) await fetchProfile(user.id)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
      if (session?.user) {
        userIdRef.current = session.user.id
        fetchProfile(session.user.id)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user) {
          userIdRef.current = session.user.id
          await fetchProfile(session.user.id)
        } else {
          userIdRef.current = null
          lastRoleRef.current = null
          setProfile(null)
        }
      },
    )

    // Live profile refresh — when an admin approves/changes your role (or your
    // profile is otherwise updated), the UI reacts immediately instead of
    // serving a stale role until reload. This is the core fix for "role
    // approved but dashboard didn't switch".
    const realtime = supabase
      .channel('auth-profile-sync')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
        (payload) => {
          const updated = payload.new as Partial<Profile> | null
          const uid = userIdRef.current
          if (uid && updated && updated.id === uid) {
            fetchProfile(uid)
          }
        },
      )
      .subscribe()

    // Fresh profile on tab refocus too (cheap safety net).
    const onFocus = () => {
      const uid = userIdRef.current
      if (uid) fetchProfile(uid)
    }
    window.addEventListener('focus', onFocus)

    return () => {
      subscription.unsubscribe()
      realtime.unsubscribe()
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    setSession(null)
    setUser(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider
      value={{ user, session, profile, loading, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useSession() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useSession must be used within an AuthProvider')
  return context
}
