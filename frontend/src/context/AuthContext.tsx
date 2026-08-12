import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { invalidateStudioConfig } from '../lib/aiStudio'
import type { User, Profile, Role } from '../types'

const PREVIEW_STORAGE_KEY = 'founderhub_preview_role'

interface AuthContextValue {
  user: User | null
  session: Session | null
  profile: Profile | null
  realProfile: Profile | null
  previewRole: Role | null
  isPreviewing: boolean
  loading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  setPreviewRole: (role: Role | null) => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [realProfile, setRealProfile] = useState<Profile | null>(null)
  const [previewRole, setPreviewRoleState] = useState<Role | null>(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(PREVIEW_STORAGE_KEY) : null
    // 'administrator' is not a preview — it's the real admin console view.
    if (stored && stored !== 'administrator') return stored as Role
    return null
  })
  const [loading, setLoading] = useState(true)
  const userIdRef = useRef<string | null>(null)
  const lastRoleRef = useRef<string | null>(null)

  /**
   * The "effective" profile the UI should react to. While an administrator is
   * previewing another role, we override role (and clear the admin flags) so
   * guards, dashboards and nav all behave exactly like that role. The real
   * profile stays available as `realProfile` for admin-console checks.
   */
  const profile = useMemo<Profile | null>(() => {
    if (!realProfile) return null
    if (!previewRole || previewRole === 'administrator') return realProfile
    return { ...realProfile, role: previewRole, is_admin: false, is_super_admin: false }
  }, [realProfile, previewRole])

  const isPreviewing = Boolean(realProfile && previewRole && previewRole !== 'administrator')

  function setPreviewRole(role: Role | null) {
    setPreviewRoleState(role)
    if (role && role !== 'administrator') {
      window.localStorage.setItem(PREVIEW_STORAGE_KEY, role)
    } else {
      window.localStorage.removeItem(PREVIEW_STORAGE_KEY)
    }
  }

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    const next = (data as Profile | null) ?? null
    setRealProfile(next)
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
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          setSession(null)
          setUser(null)
          userIdRef.current = null
          lastRoleRef.current = null
          setRealProfile(null)
          setPreviewRoleState(null)
          return
        }

        if (event === 'TOKEN_REFRESHED' && !session) {
          toast.error('Your session expired — Please sign in again.')
          setSession(null)
          setUser(null)
          setRealProfile(null)
          return
        }

        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user) {
          userIdRef.current = session.user.id
          await fetchProfile(session.user.id)
        } else {
          userIdRef.current = null
          lastRoleRef.current = null
          setRealProfile(null)
          setPreviewRoleState(null)
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
    setRealProfile(null)
    setPreviewRoleState(null)
    window.localStorage.removeItem(PREVIEW_STORAGE_KEY)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        realProfile,
        previewRole,
        isPreviewing,
        loading,
        signOut,
        refreshProfile,
        setPreviewRole,
      }}
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
