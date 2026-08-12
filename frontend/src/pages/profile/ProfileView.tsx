import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, MapPin, Rocket, Globe, UserPlus, UserCheck, MessageCircle, CalendarDays, Loader2 } from 'lucide-react'
import { getProfileByUsername, trackProfileView } from '../../lib/profile'
import { getMyStartups } from '../../lib/startups'
import { getConnectionState, sendConnectionRequest, acceptConnectionRequest } from '../../lib/connections'
import { FollowButton } from '../../components/FollowButton'
import { useSession } from '../../context/AuthContext'
import { Avatar } from '../../components/Avatar'
import { Seo } from '../../components/Seo'
import { ROLE_LABELS } from '../../types'
import type { Profile } from '../../types'

const socialMeta = {
  linkedin_url: {
    label: 'LinkedIn',
    path: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z',
  },
  github_url: {
    label: 'GitHub',
    path: 'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12',
  },
  portfolio_url: { label: 'Portfolio', path: null },
  twitter_url: {
    label: 'Twitter',
    path: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z',
  },
}

const roleGradients: Record<string, string> = {
  founder: 'from-primary to-accent',
  developer: 'from-accent to-accent-400',
  designer: 'from-primary-500 to-primary-300',
  investor: 'from-primary-600 to-primary-400',
  marketer: 'from-accent-600 to-accent-400',
}

export default function ProfileView() {
  const { username } = useParams<{ username: string }>()
  const navigate = useNavigate()
  const { user } = useSession()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [startupCount, setStartupCount] = useState<number | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'none' | 'pending' | 'requested' | 'accepted'>('none')

  useEffect(() => {
    if (!username) return
    setLoading(true)
    getProfileByUsername(username)
      .then(setProfile)
      .catch(() => toast.error('Could not load this profile'))
      .finally(() => setLoading(false))
  }, [username])

  useEffect(() => {
    if (!profile) return
    getMyStartups(profile.id)
      .then((list) => setStartupCount(list.filter((s) => s.is_published).length))
      .catch(() => setStartupCount(0))
    if (user?.id && user.id !== profile.id) {
      getConnectionState(user.id, profile.id)
        .then((state) => setConnectionStatus(state.status))
        .catch(() => setConnectionStatus('none'))
      trackProfileView(profile.id, user.id)
    }
  }, [profile, user])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-dark">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 text-center dark:bg-dark">
        <h1 className="text-2xl font-bold">Profile not found</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          This username does not exist yet on FounderHub.
        </p>
        <Link to="/" className="btn-primary mt-6">
          Back to Home
        </Link>
      </div>
    )
  }

  const isOwnProfile = Boolean(user?.id && profile.id && user.id === profile.id)

  type SocialKey = 'linkedin_url' | 'github_url' | 'portfolio_url' | 'twitter_url'

  const socials = (
    ['linkedin_url', 'github_url', 'portfolio_url', 'twitter_url'] as SocialKey[]
  )
    .map((key) => ({ key, value: profile[key] }))
    .filter((s): s is { key: SocialKey; value: string } => Boolean(s.value))

  return (
    <div className="min-h-screen bg-white dark:bg-dark">
      <Seo
        title={`${profile.full_name || profile.username} — FounderHub AI`}
        description={profile.bio || `${profile.full_name}'s profile on FounderHub AI.`}
      />
      <div className={`h-40 bg-gradient-to-r ${roleGradients[profile.role ?? 'founder']} opacity-80`} />

      <div className="container-x -mt-16 pb-16">
        <button
          type="button"
          onClick={() => navigate(user ? '/dashboard' : '/')}
          className="relative z-10 mb-8 inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm text-gray-600 transition-colors hover:text-primary dark:text-gray-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </button>

        <div className="flex flex-col items-start gap-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-xl sm:p-8 dark:border-dark-300 dark:bg-dark-100 sm:flex-row sm:items-end">
          <Avatar src={profile.avatar_url} name={profile.full_name} size="xl" />

          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold">
                {profile.full_name ?? 'New Member'}
              </h1>
              {profile.role && (
                <span className="rounded-full bg-gradient-brand px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
                  {ROLE_LABELS[profile.role]}
                </span>
              )}
              {profile.is_open_to_work && (
                <span className="rounded-full bg-green-500/15 px-3 py-1 text-xs font-medium text-green-600 dark:text-green-400">
                  Open to work
                </span>
              )}
            </div>

            <p className="mt-1 text-sm text-gray-500">@{profile.username}</p>

            {profile.city && (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                <MapPin className="h-4 w-4" />
                {profile.city}
                {profile.country ? `, ${profile.country}` : ''}
                {profile.experience_years ? ` · ${profile.experience_years} yrs experience` : ''}
              </p>
            )}

            {profile.bio && (
              <p className="mt-4 max-w-2xl leading-relaxed text-gray-700 dark:text-gray-300">
                {profile.bio}
              </p>
            )}
          </div>

          {!isOwnProfile && (
            <div className="flex w-full gap-2 sm:w-auto">
              <button
                onClick={async () => {
                  if (!user || connectionStatus === 'accepted' || connectionStatus === 'pending') return
                  try {
                    if (connectionStatus === 'requested') {
                      await acceptConnectionRequest(user.id, profile.id)
                      setConnectionStatus('accepted')
                      toast.success(`You and ${profile.full_name} are now connected`)
                    } else {
                      await sendConnectionRequest(user.id, profile.id)
                      setConnectionStatus('pending')
                      toast.success(`Connection request sent to ${profile.full_name}`)
                    }
                  } catch {
                    toast.error('Could not send connection request')
                  }
                }}
                disabled={connectionStatus === 'accepted' || connectionStatus === 'pending'}
                className={`flex-1 ${connectionStatus === 'accepted' ? 'btn-ghost' : 'btn-primary'} disabled:pointer-events-none sm:flex-none`}
              >
                {connectionStatus === 'accepted' ? (
                  <>
                    <UserCheck className="h-4 w-4" />
                    Connected
                  </>
                ) : connectionStatus === 'requested' ? (
                  <>
                    <UserCheck className="h-4 w-4" />
                    Accept Request
                  </>
                ) : connectionStatus === 'pending' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Requested
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    Connect
                  </>
                )}
              </button>
              <button
                onClick={() => navigate(`/messages?user=${profile.id}`)}
                className="btn-ghost flex-1 sm:flex-none"
              >
                <MessageCircle className="h-4 w-4" />
                Message
              </button>
              <button
                onClick={() => navigate(`/meetings?with=${profile.id}`)}
                className="btn-ghost flex-1 sm:flex-none"
              >
                <CalendarDays className="h-4 w-4" />
                Schedule Meeting
              </button>
              <FollowButton targetId={profile.id} targetType="user" className="flex-1 sm:flex-none" />
            </div>
          )}
          {isOwnProfile && (
            <Link to="/settings/profile" className="btn-ghost w-full sm:w-auto">
              Edit Profile
            </Link>
          )}
        </div>

        {/* Skills + socials */}
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-dark-300 dark:bg-dark-100 lg:col-span-2">
            <h2 className="font-bold">Skills</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {(profile.skills ?? []).length > 0 ? (
                profile.skills!.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary"
                  >
                    {skill}
                  </span>
                ))
              ) : (
                <p className="text-sm text-gray-500">No skills added yet.</p>
              )}
            </div>

            <h2 className="mt-8 font-bold">Activity</h2>
            <div className="mt-4 grid grid-cols-3 gap-4">
              {[
                { label: 'Startups', value: startupCount ?? '—' },
                { label: 'Connections', value: profile.connections_count ?? 0 },
                { label: 'Joined', value: profile.created_at ? new Date(profile.created_at).getFullYear() : '—' },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-gray-200 p-4 text-center dark:border-dark-300"
                >
                  <p className="text-2xl font-extrabold text-primary">{stat.value}</p>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-dark-300 dark:bg-dark-100">
            <h2 className="font-bold">Connect</h2>
            <div className="mt-4 flex flex-col gap-3">
              {socials.length > 0 ? (
                socials.map(({ key, value }) => (
                  <a
                    key={key}
                    href={value}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:border-primary hover:text-primary dark:border-dark-300 dark:text-gray-300"
                  >
                    {socialMeta[key].path ? (
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                        <path d={socialMeta[key].path} />
                      </svg>
                    ) : (
                      <Globe className="h-4 w-4" />
                    )}
                    {socialMeta[key].label}
                  </a>
                ))
              ) : (
                <p className="text-sm text-gray-500">No social links added yet.</p>
              )}
            </div>

            <div className="mt-6 flex items-center gap-2 rounded-xl bg-primary/10 p-4">
              <Rocket className="h-5 w-5 flex-shrink-0 text-primary" />
              <p className="text-xs text-gray-600 dark:text-gray-300">
                Find the right teammates for {profile.full_name?.split(' ')[0] ?? 'this founder'} on FounderHub.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
