import { useMemo, useState } from 'react'
import { getErrorMessage } from '../../lib/errors'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Briefcase, Check, Loader2, Plus, Rocket, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { AppHeader } from '../../components/AppHeader'
import { SkillsSelector } from '../../components/SkillsSelector'
import { useSession } from '../../context/AuthContext'
import { createJob, notifyNewJob } from '../../lib/jobs'
import { getMyStartups } from '../../lib/startups'
import { INDUSTRIES } from '../../lib/constants'
import { JOB_TYPES, JOB_EXPERIENCE_LEVELS } from '../../types'
import type { JobExperienceLevel, JobType } from '../../types'

const STEPS = ['Basics', 'Description & Pay', 'Requirements']

const CURRENCIES = ['USD', 'AED', 'PKR', 'EUR', 'GBP']

interface ListInputProps {
  label: string
  placeholder: string
  items: string[]
  onChange: (items: string[]) => void
}

function ListInput({ label, placeholder, items, onChange }: ListInputProps) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const value = draft.trim()
    if (!value) return
    onChange([...items, value])
    setDraft('')
  }
  return (
    <div>
      <label className="text-sm font-semibold">{label}</label>
      <div className="mt-1 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          placeholder={placeholder}
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark"
        />
        <button onClick={add} type="button" className="btn-primary flex items-center gap-1">
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>
      {items.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1.5">
          {items.map((item, i) => (
            <li key={`${item}-${i}`} className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:bg-dark-200 dark:text-gray-300">
              <Check className="h-4 w-4 flex-shrink-0 text-primary" />
              <span className="flex-1">{item}</span>
              <button
                onClick={() => onChange(items.filter((_, idx) => idx !== i))}
                className="text-gray-400 hover:text-red-500"
                aria-label="Remove"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const inputCls =
  'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark'

export default function PostJob() {
  const { user, profile } = useSession()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  const [startupId, setStartupId] = useState('')
  const [title, setTitle] = useState('')
  const [jobType, setJobType] = useState<JobType>('full_time')
  const [experienceLevel, setExperienceLevel] = useState<JobExperienceLevel>('entry')
  const [isRemote, setIsRemote] = useState(false)
  const [location, setLocation] = useState('')
  const [industry, setIndustry] = useState('')

  const [description, setDescription] = useState('')
  const [salaryMin, setSalaryMin] = useState('')
  const [salaryMax, setSalaryMax] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [equity, setEquity] = useState('')
  const [deadline, setDeadline] = useState('')

  const [requirements, setRequirements] = useState<string[]>([])
  const [niceToHave, setNiceToHave] = useState<string[]>([])
  const [skills, setSkills] = useState<string[]>([])

  const [myStartups, setMyStartups] = useState<{ id: string; name: string }[]>([])
  const [startupsLoaded, setStartupsLoaded] = useState(false)

  useMemo(() => {
    if (user && !startupsLoaded) {
      getMyStartups(user.id)
        .then((list) => {
          setMyStartups(list)
          if (list.length > 0 && !startupId) setStartupId(list[0].id)
        })
        .catch(() => {})
        .finally(() => setStartupsLoaded(true))
    }
  }, [user, startupsLoaded, startupId])

  const canNext = step === 0 ? title.trim().length >= 3 && !!industry : step === 1 ? description.trim().length >= 50 : skills.length > 0 && requirements.length > 0

  const submit = async () => {
    if (!user) return
    setSubmitting(true)
    try {
      const job = await createJob({
        startup_id: startupId || null,
        posted_by: user.id,
        title: title.trim(),
        description: description.trim(),
        requirements,
        nice_to_have: niceToHave,
        job_type: jobType,
        location: location.trim() || null,
        is_remote: isRemote,
        salary_min: salaryMin ? Number(salaryMin) : null,
        salary_max: salaryMax ? Number(salaryMax) : null,
        salary_currency: currency,
        equity_offered: equity ? Number(equity) : null,
        experience_level: experienceLevel,
        skills_required: skills,
        industry,
        application_deadline: deadline || null,
      })
      notifyNewJob(job.id)
      toast.success('Job posted! Candidates with matching skills have been alerted.')
      navigate('/dashboard/manage-jobs')
    } catch (err) {
      toast.error(getErrorMessage(err, 'generic'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark">
      <AppHeader title="Post a Job" backTo="/jobs" backLabel="Back to Jobs" />
      <main className="mx-auto max-w-2xl px-4 pt-8 pb-24 lg:pb-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {STEPS.map((label, i) => (
              <div key={label} className="flex flex-1 items-center last:flex-none">
                <div className="flex flex-col items-center gap-1.5">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                      i < step ? 'bg-primary text-white' : i === step ? 'bg-gradient-brand text-white ring-4 ring-primary/20' : 'bg-gray-100 text-gray-400 dark:bg-dark-200 dark:text-gray-400'
                    }`}
                  >
                    {i < step ? <Check className="h-4 w-4" /> : i + 1}
                  </span>
                  <span className={`whitespace-nowrap text-[10px] font-medium sm:text-[11px] ${i <= step ? 'text-primary' : 'text-gray-400'}`}>
                    {label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="mx-1 mb-5 h-0.5 flex-1 overflow-hidden rounded bg-gray-100 sm:mx-2 dark:bg-dark-200">
                    <div className="h-full bg-gradient-brand transition-all duration-500" style={{ width: i < step ? '100%' : '0%' }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {step === 0 && (
          <div className="flex flex-col gap-5">
            <div>
              <label className="text-sm font-semibold">Job title *</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Frontend Developer" className={`${inputCls} mt-1`} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-semibold">Job type *</label>
                <select value={jobType} onChange={(e) => setJobType(e.target.value as JobType)} className={`${inputCls} mt-1`}>
                  {JOB_TYPES.map((jt) => (
                    <option key={jt.id} value={jt.id}>
                      {jt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold">Experience level *</label>
                <select value={experienceLevel} onChange={(e) => setExperienceLevel(e.target.value as JobExperienceLevel)} className={`${inputCls} mt-1`}>
                  {JOB_EXPERIENCE_LEVELS.map((el) => (
                    <option key={el.id} value={el.id}>
                      {el.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-semibold">Industry *</label>
                <select value={industry} onChange={(e) => setIndustry(e.target.value)} className={`${inputCls} mt-1`}>
                  <option value="">Select an industry…</option>
                  {INDUSTRIES.map((ind) => (
                    <option key={ind} value={ind}>
                      {ind}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold">Location</label>
                <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Dubai" className={`${inputCls} mt-1`} />
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2.5 text-sm">
              <input type="checkbox" checked={isRemote} onChange={(e) => setIsRemote(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
              <span className="text-gray-700 dark:text-gray-300">This role is fully remote</span>
            </label>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-5">
            <div>
              <label className="text-sm font-semibold">Job description *</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={7}
                placeholder="Describe the role, responsibilities, and what the ideal candidate will own…"
                className={`${inputCls} mt-1 resize-none`}
              />
              <div className="mt-1 text-right text-xs text-gray-400">{description.length} characters</div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold">Min salary</label>
                <input type="number" min={0} value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} placeholder="2000" className={`${inputCls} mt-1`} />
              </div>
              <div>
                <label className="text-sm font-semibold">Max salary</label>
                <input type="number" min={0} value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} placeholder="4000" className={`${inputCls} mt-1`} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold">Currency</label>
                <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={`${inputCls} mt-1`}>
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold">Equity offered (%)</label>
                <input type="number" min={0} max={100} value={equity} onChange={(e) => setEquity(e.target.value)} placeholder="Optional" className={`${inputCls} mt-1`} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-semibold">Application deadline</label>
                <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={`${inputCls} mt-1`} />
              </div>
              <div>
                <label className="text-sm font-semibold">Post under startup</label>
                <select value={startupId} onChange={(e) => setStartupId(e.target.value)} className={`${inputCls} mt-1`}>
                  {myStartups.length === 0 && <option value="">No startup selected</option>}
                  {myStartups.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="flex items-center gap-2 text-xs text-gray-400">
              <Rocket className="h-3.5 w-3.5" />
              {myStartups.length === 0
                ? "You don't have a startup yet — the job will be posted under your personal profile."
                : `Posting as ${profile?.full_name ?? 'you'}`}
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-6">
            <ListInput label="Requirements *" placeholder="e.g. 3+ years of React" items={requirements} onChange={setRequirements} />
            <ListInput label="Nice to have" placeholder="e.g. Experience with Supabase" items={niceToHave} onChange={setNiceToHave} />
            <div>
              <label className="text-sm font-semibold">Required skills *</label>
              <p className="mb-2 text-xs text-gray-400">Used for AI matching and job alerts — pick at least one.</p>
              <SkillsSelector selected={skills} onChange={setSkills} max={12} />
            </div>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between">
          {step > 0 ? (
            <button onClick={() => setStep((s) => s - 1)} className="btn-ghost flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
          ) : (
            <span />
          )}
          {step < STEPS.length - 1 ? (
            <button onClick={() => setStep((s) => s + 1)} disabled={!canNext} className="btn-primary flex items-center gap-2 disabled:opacity-40">
              Continue <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button onClick={submit} disabled={!canNext || submitting} className="btn-primary flex items-center gap-2 disabled:opacity-40">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Briefcase className="h-4 w-4" />}
              {submitting ? 'Posting…' : 'Post Job'}
            </button>
          )}
        </div>
      </main>
    </div>
  )
}
