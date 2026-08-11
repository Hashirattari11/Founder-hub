import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Check, Plus, ArrowLeft, ArrowRight, Loader2, Rocket, Code2, Palette, Megaphone, Wallet, Scale, BarChart3, Lightbulb, Users, Shield } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useSession } from '../../context/AuthContext'
import { AuthLayout } from '../../components/AuthLayout'
import { Field, TextInput } from '../../components/FormInput'
import { SkillsSelector } from '../../components/SkillsSelector'
import { useUsernameCheck } from '../../hooks/useUsernameCheck'
import { findAvailableUsername } from '../../lib/username'
import { ROLE_OPTIONS, ROLE_SKILLS, INVESTOR_INTERESTS } from '../../types'
import type { Role } from '../../types'

const STEPS = ['Role', 'About You', 'Skills', 'Location & Experience', 'Social Links']

const ROLE_ICONS: Record<Role, typeof Rocket> = {
  founder: Rocket,
  developer: Code2,
  designer: Palette,
  marketer: Megaphone,
  investor: Wallet,
  legal_advisor: Scale,
  business_analyst: BarChart3,
  mentor: Lightbulb,
  recruiter: Users,
  administrator: Shield,
}

export default function CompleteProfile() {
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const { user, profile } = useSession()
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

  const usernameStatus = useUsernameCheck(username, user?.id).status

  const suggestUsernameFromName = async () => {
    if (fullName.trim().length < 2) {
      toast.error('Enter your full name first')
      return
    }
    try {
      const suggestion = await findAvailableUsername(fullName)
      setUsername(suggestion)
      toast.success('Username suggested — feel free to change it')
    } catch {
      toast.error('Could not suggest a username right now')
    }
  }

  const stepValid = () => {
    if (step === 1) {
      if (fullName.trim().length < 2) {
        toast.error('Please enter your full name')
        return false
      }
      if (usernameStatus !== 'available' && username !== profile?.username) {
        if (usernameStatus === 'error') {
          toast.error('Could not check username — database is not set up. Run the profiles migration.')
        } else {
          toast.error(
            usernameStatus === 'taken'
              ? 'That username is taken'
              : usernameStatus === 'invalid'
                ? 'Username must be 3-20 chars (letters, numbers, underscore)'
                : 'Please choose an available username',
          )
        }
        return false
      }
      return true
    }
    if (step === 2) {
      if (skills.length === 0) {
        toast.error('Select at least one skill')
        return false
      }
      if (role === 'investor' && investorInterests.length === 0) {
        toast.error('Select at least one sector you invest in')
        return false
      }
      return true
    }
    return true
  }

  const next = () => {
    if (!stepValid()) return
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  const back = () => setStep((s) => Math.max(s - 1, 0))

  const selectRole = (nextRole: Role) => {
    setRole(nextRole)
    setSkills([])
    setInvestorInterests([])
  }

  const toggleInterest = (interest: string) => {
    setInvestorInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest],
    )
  }

  const onSubmit = async () => {
    if (!stepValid()) return
    if (!user) return

    setSubmitting(true)
    try {
      // Role is permanent once an account exists (username is set) — the DB
      // trigger protect_role_columns enforces this server-side. New users (no
      // username yet) can pick their role here; everyone else keeps their role
      // and uses the role-request flow to change it.
      const roleAlreadySet = Boolean(profile?.username)
      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        ...(roleAlreadySet ? {} : { role }),
        full_name: fullName.trim(),
        username: username.trim().toLowerCase(),
        bio: bio.trim() || null,
        skills,
        investor_interests: role === 'investor' ? investorInterests : [],
        country: country.trim() || null,
        city: city.trim() || null,
        experience_years: experienceYears ? Number(experienceYears) : null,
        is_open_to_work: openToWork,
        linkedin_url: linkedin.trim() || null,
        github_url: github.trim() || null,
        portfolio_url: portfolio.trim() || null,
        twitter_url: twitter.trim() || null,
      })
      if (error) throw error

      toast.success('Profile complete! Welcome to FounderHub.')
      navigate('/dashboard', { replace: true })
    } catch (error) {
      // supabase errors (PostgrestError) are not Error instances — surface the
      // real message instead of masking it as a generic failure.
      const err = error as { message?: string; code?: string } | null
      const message = error instanceof Error ? error.message : err?.message || 'Failed to save profile'
      toast.error(err?.code === '42501' ? `${message} — Please log out and log back in.` : message)
    } finally {
      setSubmitting(false)
    }
  }

  const input = 'border border-gray-200 bg-white dark:border-dark-300 dark:bg-dark'

  return (
    <AuthLayout
      title={profile?.username ? 'Update your profile' : 'Create your account'}
      subtitle={
        profile?.username
          ? 'Keep your profile up to date so matching stays sharp.'
          : 'Tell us about yourself so our matching engine finds the right people.'
      }
    >
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((label, i) => (
            <div key={label} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                    i < step
                      ? 'bg-primary text-white'
                      : i === step
                        ? 'bg-gradient-brand text-white ring-4 ring-primary/20'
                        : 'bg-gray-100 text-gray-400 dark:bg-dark-200 dark:text-gray-400'
                  }`}
                >
                  {i < step ? <Check className="h-4 w-4" /> : i + 1}
                </span>
                <span
                  className={`text-[11px] font-medium ${
                    i <= step ? 'text-primary' : 'text-gray-400'
                  }`}
                >
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className="mx-2 mb-5 h-0.5 flex-1 overflow-hidden rounded bg-gray-100 dark:bg-dark-200">
                  <div
                    className="h-full bg-gradient-brand transition-all duration-500"
                    style={{ width: i < step ? '100%' : '0%' }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step 0 — Role */}
      {step === 0 && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Who are you on FounderHub? This shapes your dashboard, skills and matches.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {ROLE_OPTIONS.map((option) => {
              const Icon = ROLE_ICONS[option.value]
              const active = role === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => selectRole(option.value)}
                  className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${
                    active
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/30'
                      : 'border-gray-200 bg-white hover:border-primary dark:border-dark-300 dark:bg-dark'
                  }`}
                >
                  <span
                    className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${
                      active ? 'bg-gradient-brand text-white' : 'bg-gray-100 text-gray-500 dark:bg-dark-200'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold">{option.label}</span>
                    <span className="mt-0.5 block text-xs text-gray-500">{option.description}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Step 1 — Basic info */}
      {step === 1 && (
        <div className="flex flex-col gap-5">
          <Field label="Full Name">
            <TextInput
              type="text"
              placeholder="Jane Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </Field>

          <Field label="Username">
            <TextInput
              type="text"
              placeholder="janedoe"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={input}
            />
            {!username && fullName.trim().length >= 2 && (
              <button
                type="button"
                onClick={suggestUsernameFromName}
                className="mt-1 text-xs font-semibold text-primary hover:underline"
              >
                ✨ Suggest a username from my name
              </button>
            )}
            {username && (
              <p
                className={`text-xs ${
                  usernameStatus === 'available'
                    ? 'text-green-500'
                    : usernameStatus === 'taken'
                      ? 'text-red-500'
                    : usernameStatus === 'invalid'
                      ? 'text-red-500'
                      : usernameStatus === 'error'
                        ? 'text-amber-500'
                        : 'text-gray-400'
                }`}
              >
                {usernameStatus === 'checking' && 'Checking availability...'}
                {usernameStatus === 'available' && '✓ Username available'}
                {usernameStatus === 'taken' && 'Username already taken'}
                {usernameStatus === 'invalid' && '3-20 chars: letters, numbers, underscore'}
                {usernameStatus === 'error' && 'Could not check username — database not set up'}
              </p>
            )}
          </Field>

          <Field label="Bio">
            <textarea
              rows={3}
              placeholder="What are you building? What do you need help with?"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={280}
              className="w-full resize-none rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition-colors placeholder:text-gray-400 focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark"
            />
            <span className="text-right text-xs text-gray-400">{bio.length}/280</span>
          </Field>
        </div>
      )}

      {/* Step 2 — Role-specific skills */}
      {step === 2 && (
        <div className="flex flex-col gap-5">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Pick up to 8 {role} skills you bring to a startup. The matching engine uses these heavily.
          </p>
          <SkillsSelector selected={skills} onChange={setSkills} max={8} pool={ROLE_SKILLS[role]} />

          {role === 'investor' && (
            <div>
              <p className="text-sm font-semibold">What sectors do you invest in?</p>
              <p className="mt-1 text-xs text-gray-500">Pick all that apply — we show matching startups.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {INVESTOR_INTERESTS.map((interest) => {
                  const active = investorInterests.includes(interest)
                  return (
                    <button
                      key={interest}
                      type="button"
                      onClick={() => toggleInterest(interest)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
                        active
                          ? 'border-primary bg-primary text-white shadow-md shadow-primary/30'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-primary hover:text-primary dark:border-dark-300 dark:bg-dark dark:text-gray-300'
                      }`}
                    >
                      {active ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                      {interest}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 3 — Location + Experience */}
      {step === 3 && (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Country">
              <TextInput
                type="text"
                placeholder="India"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              />
            </Field>
            <Field label="City">
              <TextInput
                type="text"
                placeholder="Bengaluru"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </Field>
          </div>

          <Field label="Years of Experience">
            <TextInput
              type="number"
              min={0}
              max={50}
              placeholder="3"
              value={experienceYears}
              onChange={(e) => setExperienceYears(e.target.value)}
            />
          </Field>

          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-dark-300 dark:bg-dark">
            <input
              type="checkbox"
              checked={openToWork}
              onChange={(e) => setOpenToWork(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <span>
              <span className="block text-sm font-semibold">Open to work</span>
              <span className="block text-xs text-gray-500">
                Show founders and teams you are available for collaboration
              </span>
            </span>
          </label>
        </div>
      )}

      {/* Step 4 — Social links */}
      {step === 4 && (
        <div className="flex flex-col gap-5">
          <Field label="LinkedIn URL">
            <TextInput
              type="url"
              placeholder="https://linkedin.com/in/janedoe"
              value={linkedin}
              onChange={(e) => setLinkedin(e.target.value)}
            />
          </Field>
          <Field label="GitHub URL">
            <TextInput
              type="url"
              placeholder="https://github.com/janedoe"
              value={github}
              onChange={(e) => setGithub(e.target.value)}
            />
          </Field>
          <Field label="Portfolio URL">
            <TextInput
              type="url"
              placeholder="https://janedoe.dev"
              value={portfolio}
              onChange={(e) => setPortfolio(e.target.value)}
            />
          </Field>
          <Field label="Twitter URL">
            <TextInput
              type="url"
              placeholder="https://twitter.com/janedoe"
              value={twitter}
              onChange={(e) => setTwitter(e.target.value)}
            />
          </Field>
        </div>
      )}

      <div className="mt-8 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={back}
          disabled={step === 0}
          className="btn-ghost disabled:pointer-events-none disabled:opacity-40"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        {step < STEPS.length - 1 ? (
          <button type="button" onClick={next} className="btn-primary">
            Continue
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button type="button" onClick={onSubmit} disabled={submitting} className="btn-primary disabled:opacity-60">
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save & Continue'
            )}
          </button>
        )}
      </div>
    </AuthLayout>
  )
}
