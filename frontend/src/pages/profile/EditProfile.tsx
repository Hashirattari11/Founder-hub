import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Camera, Check, Loader2, Save } from 'lucide-react'
import { useSession } from '../../context/AuthContext'
import { updateProfile, saveAvatar } from '../../lib/profile'
import { Avatar } from '../../components/Avatar'
import { SkillsSelector } from '../../components/SkillsSelector'
import { useUsernameCheck } from '../../hooks/useUsernameCheck'
import { Field, TextInput } from '../../components/FormInput'
import RoleRequestCard from '../../components/profile/RoleRequestCard'
import { ROLE_OPTIONS, ROLE_SKILLS, INVESTOR_INTERESTS } from '../../types'
import type { Role } from '../../types'

export default function EditProfile() {
  const { user, profile, refreshProfile } = useSession()
  const navigate = useNavigate()

  const [role, setRole] = useState<Role>((profile?.role as Role) ?? 'founder')
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [username, setUsername] = useState(profile?.username ?? '')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [skills, setSkills] = useState<string[]>(profile?.skills ?? [])
  const [investorInterests, setInvestorInterests] = useState<string[]>(profile?.investor_interests ?? [])
  const [country, setCountry] = useState(profile?.country ?? '')
  const [city, setCity] = useState(profile?.city ?? '')
  const [experienceYears, setExperienceYears] = useState(
    profile?.experience_years ? String(profile.experience_years) : '',
  )
  const [openToWork, setOpenToWork] = useState(profile?.is_open_to_work ?? true)
  const [linkedin, setLinkedin] = useState(profile?.linkedin_url ?? '')
  const [github, setGithub] = useState(profile?.github_url ?? '')
  const [portfolio, setPortfolio] = useState(profile?.portfolio_url ?? '')
  const [twitter, setTwitter] = useState(profile?.twitter_url ?? '')

  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile?.avatar_url ?? null)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const usernameStatus = useUsernameCheck(username, user?.id).status

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    setUploadingAvatar(true)
    try {
      setAvatarPreview(URL.createObjectURL(file))
      const { avatarUrl, profile: updated } = await saveAvatar(user.id, file)
      toast.success('Avatar updated')
      setAvatarPreview(avatarUrl)
      await refreshProfile()
      void updated
    } catch (error) {
      setAvatarPreview(profile?.avatar_url ?? null)
      toast.error(error instanceof Error ? error.message : 'Failed to upload avatar')
    } finally {
      setUploadingAvatar(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    if (fullName.trim().length < 2) {
      toast.error('Please enter your full name')
      return
    }
    if (usernameStatus === 'taken' && username !== profile?.username) {
      toast.error('That username is taken')
      return
    }

    setSaving(true)
    const prevProfile = profile
    try {
      // Role is permanent once an account exists (username set). New users who
      // skipped onboarding can still pick their role here.
      const roleWasSet = Boolean(prevProfile?.username)
      const optimistic = await updateProfile(user.id, {
        ...(roleWasSet ? {} : { role }),
        full_name: fullName.trim(),
        username: username.trim().toLowerCase(),
        bio: bio.trim() || null,
        skills,
        investor_interests: investorInterests,
        country: country.trim() || null,
        city: city.trim() || null,
        experience_years: experienceYears ? Number(experienceYears) : null,
        is_open_to_work: openToWork,
        linkedin_url: linkedin.trim() || null,
        github_url: github.trim() || null,
        portfolio_url: portfolio.trim() || null,
        twitter_url: twitter.trim() || null,
      })
      toast.success('Profile saved')
      void optimistic
      await refreshProfile()
      navigate('/dashboard', { replace: true })
    } catch (error) {
      // supabase errors (PostgrestError) are not Error instances — surface the
      // real message instead of masking it as a generic failure.
      const message =
        error instanceof Error
          ? error.message
          : (error as { message?: string } | null)?.message || 'Failed to save profile'
      toast.error(message)
      void prevProfile
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark">
      <header className="border-b border-gray-200 bg-white dark:border-dark-300 dark:bg-dark">
        <div className="container-x flex h-16 items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-brand text-white text-lg font-bold">
              F
            </span>
            <span className="font-bold">Profile Settings</span>
          </Link>
          <Link to="/dashboard" className="btn-ghost">
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
        </div>
      </header>

      <main className="container-x py-10">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-2xl border border-gray-200 bg-white p-8 dark:border-dark-300 dark:bg-dark-100">
            {/* Avatar */}
            <div className="flex flex-col items-center gap-4 border-b border-gray-200 pb-8 dark:border-dark-300">
              <div className="relative">
                <Avatar src={avatarPreview} name={fullName} size="xl" />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  aria-label="Upload avatar"
                  className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-gradient-brand text-white shadow-lg transition-transform hover:scale-105 disabled:opacity-60"
                >
                  {uploadingAvatar ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                </button>
              </div>
              <div className="text-center">
                <p className="font-semibold">Profile photo</p>
                <p className="text-xs text-gray-500">
                  JPG or PNG, max 1MB — auto-resized to 512px
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>

            <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5">
              {!profile?.username ? (
                <Field label="I am a...">
                  <p className="mb-2 text-xs text-gray-500">
                    Choose the role that best describes you. After this, role changes require admin review.
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {ROLE_OPTIONS.map((option) => {
                      const active = role === option.value
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setRole(option.value)
                            setSkills([])
                            setInvestorInterests([])
                          }}
                          className={`flex items-center justify-between rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors ${
                            active
                              ? 'border-primary bg-primary/5 text-primary ring-2 ring-primary/30'
                              : 'border-gray-200 bg-white text-gray-700 hover:border-primary hover:text-primary dark:border-dark-300 dark:bg-dark dark:text-gray-300'
                          }`}
                        >
                          {option.label}
                          {active && <Check className="h-4 w-4" />}
                        </button>
                      )
                    })}
                  </div>
                </Field>
              ) : (
                <RoleRequestCard currentRole={profile.role} />
              )}

              <Field label="Full Name">
                <TextInput
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Doe"
                />
              </Field>

              <Field label="Username">
                <TextInput
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="janedoe"
                />
                {username && username !== profile?.username && (
                  <p
                    className={`text-xs ${
                      usernameStatus === 'available'
                        ? 'text-green-500'
                        : usernameStatus === 'taken'
                          ? 'text-red-500'
                          : usernameStatus === 'invalid'
                            ? 'text-red-500'
                            : 'text-gray-400'
                    }`}
                  >
                    {usernameStatus === 'checking' && 'Checking availability...'}
                    {usernameStatus === 'available' && '✓ Username available'}
                    {usernameStatus === 'taken' && 'Username already taken'}
                    {usernameStatus === 'invalid' && '3-20 chars: letters, numbers, underscore'}
                  </p>
                )}
              </Field>

              <Field label="Bio">
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={280}
                  placeholder="What are you building?"
                  className="w-full resize-none rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition-colors placeholder:text-gray-400 focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark"
                />
              </Field>

              <Field label="Skills">
                <SkillsSelector selected={skills} onChange={setSkills} max={8} pool={ROLE_SKILLS[role]} />
              </Field>

              {role === 'investor' && (
                <Field label="What sectors do you invest in?">
                  <div className="flex flex-wrap gap-2">
                    {INVESTOR_INTERESTS.map((interest) => {
                      const active = investorInterests.includes(interest)
                      return (
                        <button
                          key={interest}
                          type="button"
                          onClick={() =>
                            setInvestorInterests((prev) =>
                              prev.includes(interest)
                                ? prev.filter((i) => i !== interest)
                                : [...prev, interest],
                            )
                          }
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
                            active
                              ? 'border-primary bg-primary text-white shadow-md shadow-primary/30'
                              : 'border-gray-200 bg-white text-gray-600 hover:border-primary hover:text-primary dark:border-dark-300 dark:bg-dark dark:text-gray-300'
                          }`}
                        >
                          {active ? <Check className="h-3.5 w-3.5" /> : null}
                          {interest}
                        </button>
                      )
                    })}
                  </div>
                </Field>
              )}

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                <Field label="Country">
                  <TextInput
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="India"
                  />
                </Field>
                <Field label="City">
                  <TextInput
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Bengaluru"
                  />
                </Field>
                <Field label="Experience (yrs)">
                  <TextInput
                    type="number"
                    min={0}
                    max={50}
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(e.target.value)}
                    placeholder="3"
                  />
                </Field>
              </div>

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-dark-300 dark:bg-dark">
                <input
                  type="checkbox"
                  checked={openToWork}
                  onChange={(e) => setOpenToWork(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm font-medium">Open to work</span>
              </label>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field label="LinkedIn URL">
                  <TextInput
                    type="url"
                    value={linkedin}
                    onChange={(e) => setLinkedin(e.target.value)}
                    placeholder="https://linkedin.com/in/janedoe"
                  />
                </Field>
                <Field label="GitHub URL">
                  <TextInput
                    type="url"
                    value={github}
                    onChange={(e) => setGithub(e.target.value)}
                    placeholder="https://github.com/janedoe"
                  />
                </Field>
                <Field label="Portfolio URL">
                  <TextInput
                    type="url"
                    value={portfolio}
                    onChange={(e) => setPortfolio(e.target.value)}
                    placeholder="https://janedoe.dev"
                  />
                </Field>
                <Field label="Twitter URL">
                  <TextInput
                    type="url"
                    value={twitter}
                    onChange={(e) => setTwitter(e.target.value)}
                    placeholder="https://twitter.com/janedoe"
                  />
                </Field>
              </div>

              <button type="submit" disabled={saving} className="btn-primary mt-2 w-full disabled:opacity-60">
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Changes
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}
