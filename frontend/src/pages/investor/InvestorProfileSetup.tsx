import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Check, Loader2, Save, Wallet, Sparkles } from 'lucide-react'
import { useSession } from '../../context/AuthContext'
import { INDUSTRIES, STAGES } from '../../lib/constants'
import { getInvestorProfile, saveInvestorProfile } from '../../lib/investorMatch'

const LOCATIONS = ['Global', 'USA', 'Europe', 'UK', 'UAE', 'Pakistan', 'India', 'Singapore', 'Middle East']

function ChipSelect({
  options,
  selected,
  onToggle,
}: {
  options: string[]
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

function TextInput({
  label,
  value,
  onChange,
  type = 'text',
  min,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  min?: number
  placeholder?: string
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold">{label}</label>
      <input
        type={type}
        value={value}
        min={min}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark"
      />
    </div>
  )
}

export default function InvestorProfileSetup() {
  const { user } = useSession()
  const navigate = useNavigate()

  const [thesis, setThesis] = useState('')
  const [portfolio, setPortfolio] = useState<string[]>([])
  const [checkMin, setCheckMin] = useState('')
  const [checkMax, setCheckMax] = useState('')
  const [industries, setIndustries] = useState<string[]>([])
  const [stages, setStages] = useState<string[]>([])
  const [locations, setLocations] = useState<string[]>(['Global'])
  const [valueAdd, setValueAdd] = useState('')
  const [totalInvestments, setTotalInvestments] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    let mounted = true
    getInvestorProfile(user.id)
      .then((p) => {
        if (!mounted || !p) return
        setThesis(p.investment_thesis ?? '')
        setPortfolio(p.portfolio_companies ?? [])
        setCheckMin(p.check_size_min != null ? String(p.check_size_min) : '')
        setCheckMax(p.check_size_max != null ? String(p.check_size_max) : '')
        setIndustries(p.preferred_industries ?? [])
        setStages(p.preferred_stages ?? [])
        setLocations(p.preferred_locations ?? ['Global'])
        setValueAdd(p.value_add ?? '')
        setTotalInvestments(p.total_investments != null ? String(p.total_investments) : '')
        setIsActive(p.is_active)
      })
      .catch(() => toast.error('Could not load investor profile'))
      .finally(() => mounted && setLoading(false))
    return () => {
      mounted = false
    }
  }, [user])

  const addPortfolio = (raw: string) => {
    const value = raw.trim().replace(/,$/, '')
    if (!value) return
    setPortfolio((prev) => (prev.includes(value) ? prev : [...prev, value]))
  }

  const handleSave = async () => {
    if (!user) return
    if (industries.length === 0) {
      toast.error('Select at least one preferred industry')
      return
    }
    if (stages.length === 0) {
      toast.error('Select at least one preferred stage')
      return
    }
    setSaving(true)
    try {
      await saveInvestorProfile(user.id, {
        investment_thesis: thesis.trim() || null,
        portfolio_companies: portfolio,
        check_size_min: checkMin ? Number(checkMin) : null,
        check_size_max: checkMax ? Number(checkMax) : null,
        preferred_industries: industries,
        preferred_stages: stages,
        preferred_locations: locations,
        value_add: valueAdd.trim() || null,
        total_investments: totalInvestments ? Number(totalInvestments) : null,
        is_active: isActive,
      })
      toast.success("Investor profile saved — you're now findable by founders")
      navigate('/dashboard')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save investor profile')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-gray-200 dark:bg-dark-200" />
        <div className="mt-6 h-96 animate-pulse rounded-2xl bg-gray-200 dark:bg-dark-200" />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Wallet className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold">Investor Profile</h1>
          <p className="text-sm text-gray-500">
            Founders find you through AI matching — make your thesis shine.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-6 rounded-2xl border border-gray-200 bg-white p-6 dark:border-dark-300 dark:bg-dark-100">
        <div>
          <label className="mb-2 block text-sm font-semibold">Investment thesis</label>
          <textarea
            value={thesis}
            onChange={(e) => setThesis(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="e.g. Early-stage AI/ML startups in fintech and healthtech, backing product-led founders with strong unit economics..."
            className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark"
          />
          <p className="mt-1 text-right text-xs text-gray-400">{thesis.length}/1000</p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold">Portfolio companies</label>
          <div className="flex flex-wrap gap-2">
            {portfolio.map((c) => (
              <span
                key={c}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary"
              >
                {c}
                <button
                  type="button"
                  onClick={() => setPortfolio((prev) => prev.filter((x) => x !== c))}
                  className="text-primary/60 hover:text-primary"
                  aria-label={`Remove ${c}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <input
            type="text"
            placeholder="Type a company and press Enter (e.g. Acme Ventures)"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addPortfolio((e.target as HTMLInputElement).value)
                ;(e.target as HTMLInputElement).value = ''
              }
            }}
            className="mt-3 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <TextInput label="Check size min ($)" type="number" min={0} value={checkMin} onChange={setCheckMin} placeholder="25000" />
          <TextInput label="Check size max ($)" type="number" min={0} value={checkMax} onChange={setCheckMax} placeholder="250000" />
          <TextInput label="Total investments" type="number" min={0} value={totalInvestments} onChange={setTotalInvestments} placeholder="12" />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold">
            Preferred industries <span className="text-red-500">*</span>
          </label>
          <ChipSelect
            options={[...INDUSTRIES]}
            selected={industries}
            onToggle={(v) => setIndustries((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]))}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold">
            Preferred stages <span className="text-red-500">*</span>
          </label>
          <ChipSelect
            options={[...STAGES].map((s) => s.toLowerCase())}
            selected={stages}
            onToggle={(v) => setStages((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]))}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold">Preferred regions</label>
          <ChipSelect
            options={LOCATIONS}
            selected={locations}
            onToggle={(v) => setLocations((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]))}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold">How you add value</label>
          <textarea
            value={valueAdd}
            onChange={(e) => setValueAdd(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="e.g. Operating partner for go-to-market, board seat, warm intros to enterprise buyers..."
            className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark"
          />
        </div>

        <button
          type="button"
          onClick={() => setIsActive((p) => !p)}
          className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
            isActive
              ? 'border-green-500/40 bg-green-500/10 text-green-600 dark:text-green-400'
              : 'border-gray-200 text-gray-500 dark:border-dark-300'
          }`}
        >
          {isActive ? <Check className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
          {isActive ? 'Visible to founders in AI matching' : 'Hidden from AI matching'}
        </button>

        <button onClick={handleSave} disabled={saving} className="btn-primary w-full disabled:opacity-60">
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Saving…
            </>
          ) : (
            <>
              <Save className="h-4 w-4" /> Save Investor Profile
            </>
          )}
        </button>
      </div>
    </div>
  )
}
