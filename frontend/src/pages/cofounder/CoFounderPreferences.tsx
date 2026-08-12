import { useEffect, useState } from 'react'
import { getErrorMessage } from '../../lib/errors'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Check, Sparkles, Loader2, X } from 'lucide-react'
import { AppHeader } from '../../components/AppHeader'
import { useSession } from '../../context/AuthContext'
import { INDUSTRIES, STAGES } from '../../lib/constants'
import { getCoFounderPreferences, saveCoFounderPreferences } from '../../lib/cofounder'

const PREFERENCES_CONTENT: Record<
  string,
  { title: string; subtitle: string; lookingForLabel: string; lookingForOptions: string[] }
> = {
  founder: {
    title: 'Co-Founder Preferences',
    subtitle: 'Tell us what kind of co-founder you need',
    lookingForLabel: 'I need a co-founder who is:',
    lookingForOptions: [
      'Technical Co-Founder (builds the product)',
      'Marketing Co-Founder (grows the user base)',
      'Design Co-Founder (creates the experience)',
      'Operations Co-Founder (runs the business)',
      'Finance Co-Founder (manages the money)',
    ],
  },
  developer: {
    title: 'Find Your Business Co-Founder',
    subtitle: 'Tell us what kind of partner you are looking for',
    lookingForLabel: 'I am looking for someone who can:',
    lookingForOptions: [
      'Handle business development and sales',
      'Run marketing and growth',
      'Manage operations and finance',
      'Bring the startup idea and vision',
      'Handle design and user experience',
    ],
  },
  designer: {
    title: 'Find Your Co-Founder',
    subtitle: 'Tell us what skills you need in a partner',
    lookingForLabel: 'I need someone who can:',
    lookingForOptions: [
      'Build the product (developer)',
      'Drive sales and business (founder)',
      'Handle marketing and growth',
      'Manage operations',
      'Handle finance and legal',
    ],
  },
  marketer: {
    title: 'Find Your Co-Founder',
    subtitle: 'Tell us what you are looking for in a partner',
    lookingForLabel: 'I need a co-founder who can:',
    lookingForOptions: [
      'Build the product (developer)',
      'Design the experience (designer)',
      'Lead the business vision (founder)',
      'Handle operations and finance',
      'Manage legal and compliance',
    ],
  },
  investor: {
    title: 'Find Your Co-Founder',
    subtitle: 'Tell us who you want to build with',
    lookingForLabel: 'I am looking for a co-founder who is:',
    lookingForOptions: [
      'Founder with a strong business vision',
      'Technical co-founder (builds the product)',
      'Marketing co-founder (grows the user base)',
      'Design co-founder (creates the experience)',
      'Operations co-founder (runs the business)',
    ],
  },
}

const COMMITMENTS = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'flexible', label: 'Flexible' },
]

const LOCATIONS = [
  { value: 'same_city', label: 'Same city' },
  { value: 'same_country', label: 'Same country' },
  { value: 'remote_ok', label: 'Remote OK' },
]

function ChipSelect({
  options,
  selected,
  onToggle,
}: {
  options: readonly string[]
  selected: string[]
  onToggle: (value: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = selected.includes(opt)
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onToggle(opt)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? 'bg-primary text-white'
                : 'border border-gray-200 bg-gray-50 text-gray-600 hover:border-primary hover:text-primary dark:border-dark-300 dark:bg-dark dark:text-gray-300'
            }`}
          >
            {active && <Check className="h-3.5 w-3.5" />}
            {opt}
          </button>
        )
      })}
    </div>
  )
}

export default function CoFounderPreferences() {
  const { user, profile } = useSession()
  const navigate = useNavigate()
  const role = (profile?.role ?? 'founder').toLowerCase()
  const content = PREFERENCES_CONTENT[role] ?? PREFERENCES_CONTENT.founder

  const [lookingForRoles, setLookingForRoles] = useState<string[]>([])
  const [industryFocus, setIndustryFocus] = useState<string[]>([])
  const [commitment, setCommitment] = useState('')
  const [location, setLocation] = useState('')
  const [stage, setStage] = useState('')
  const [equity, setEquity] = useState<string>('10')
  const [description, setDescription] = useState('')
  const [isLooking, setIsLooking] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    let mounted = true
    getCoFounderPreferences(user.id)
      .then((prefs) => {
        if (!mounted || !prefs) return
        setLookingForRoles(prefs.looking_for_roles ?? [])
        setIndustryFocus(prefs.industry_focus ?? [])
        setCommitment(prefs.commitment_level ?? '')
        setLocation(prefs.location_preference ?? '')
        setStage(prefs.startup_stage ?? '')
        setEquity(prefs.equity_willing_to_give != null ? String(prefs.equity_willing_to_give) : '10')
        setDescription(prefs.description ?? '')
        setIsLooking(prefs.is_looking)
      })
      .catch(() => toast.error('Could not load your preferences'))
      .finally(() => mounted && setLoading(false))
    return () => {
      mounted = false
    }
  }, [user, role])

  const handleSave = async () => {
    if (lookingForRoles.length === 0) {
      toast.error('Select at least one role you are looking for')
      return
    }
    if (industryFocus.length === 0) {
      toast.error('Select at least one industry focus')
      return
    }
    setSaving(true)
    try {
      await saveCoFounderPreferences({
        looking_for_roles: lookingForRoles,
        industry_focus: industryFocus,
        commitment_level: commitment || null,
        location_preference: location || null,
        startup_stage: stage || null,
        equity_willing_to_give: equity ? Number(equity) : null,
        description: description.trim() || null,
        is_looking: isLooking,
      })
      toast.success('Co-founder preferences saved!')
      navigate('/co-founder')
    } catch (err) {
      toast.error(getErrorMessage(err, 'generic'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark">
        <AppHeader title={content.title} backTo="/co-founder" />
        <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
          <div className="h-8 w-56 animate-pulse rounded-lg bg-gray-200 dark:bg-dark-200" />
          <div className="mt-8 h-96 animate-pulse rounded-2xl bg-gray-200 dark:bg-dark-200" />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark">
      <AppHeader title={content.title} backTo="/co-founder" backLabel="Back to Hub" />
      <main className="mx-auto max-w-2xl px-4 pt-6 pb-24 sm:px-6 lg:pb-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-extrabold">{content.title}</h1>
            <p className="text-sm text-gray-500">{content.subtitle}</p>
          </div>
        </div>

        <div className="flex flex-col gap-6 rounded-2xl border border-gray-200 bg-white p-6 dark:border-dark-300 dark:bg-dark-100">
          <div>
            <label className="mb-2 block text-sm font-semibold">
              {content.lookingForLabel} <span className="text-red-500">*</span>
            </label>
            <ChipSelect options={content.lookingForOptions} selected={lookingForRoles} onToggle={(v) => setLookingForRoles((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]))} />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold">
              Industry focus <span className="text-red-500">*</span>
            </label>
            <ChipSelect options={INDUSTRIES} selected={industryFocus} onToggle={(v) => setIndustryFocus((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]))} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold">Commitment level</label>
              <select
                value={commitment}
                onChange={(e) => setCommitment(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark"
              >
                <option value="">Any</option>
                {COMMITMENTS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold">Location preference</label>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark"
              >
                <option value="">Any</option>
                {LOCATIONS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold">Startup stage</label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark"
              >
                <option value="">Any</option>
                {STAGES.map((s) => (
                  <option key={s} value={s.toLowerCase()}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold">
                Equity willing to give up: <span className="text-primary">{equity}%</span>
              </label>
              <input
                type="range"
                min={0}
                max={30}
                step={0.5}
                value={equity}
                onChange={(e) => setEquity(e.target.value)}
                className="w-full accent-primary"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold">Describe what you are looking for</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="e.g. A technical co-founder passionate about AI/ML, who has built products from 0 to 1..."
              className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark"
            />
            <p className="mt-1 text-right text-xs text-gray-400">{description.length}/500</p>
          </div>

          <button
            type="button"
            onClick={() => setIsLooking((p) => !p)}
            className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
              isLooking
                ? 'border-green-500/40 bg-green-500/10 text-green-600 dark:text-green-400'
                : 'border-gray-200 text-gray-500 dark:border-dark-300'
            }`}
          >
            {isLooking ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
            {isLooking ? 'You are visible in co-founder search' : 'You are hidden from co-founder search'}
          </button>

          <button onClick={handleSave} disabled={saving} className="btn-primary w-full disabled:opacity-60">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Save Preferences
              </>
            )}
          </button>
        </div>
      </main>
    </div>
  )
}
