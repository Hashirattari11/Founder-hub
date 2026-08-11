import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import { ArrowRight, FileText, Loader2, Sparkles, Wand2 } from 'lucide-react'
import { BUSINESS_MODELS, PLAN_STAGES, generateBusinessPlan } from '../../lib/businessPlan'
import type { BusinessModel, PlanStage } from '../../types/businessPlan'

const inputCls =
  'w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark'

const labelCls = 'mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-300'

interface FormState {
  startup_name: string
  idea: string
  industry: string
  country: string
  target_audience: string
  stage: PlanStage
  funding_goal: string
  budget: string
  team_size: string
  business_model: BusinessModel
}

const initial: FormState = {
  startup_name: '',
  idea: '',
  industry: '',
  country: '',
  target_audience: '',
  stage: 'idea',
  funding_goal: '',
  budget: '',
  team_size: '2',
  business_model: 'saas',
}

const GENERATION_STEPS = [
  'Analyzing your idea…',
  'Building market & competitive analysis…',
  'Drafting the 30-section business plan…',
  'Creating the pitch deck…',
  'Running the financial model…',
  'Scoring investor readiness…',
  'Finalizing recommendations…',
]

export default function BusinessPlanGenerator() {
  const navigate = useNavigate()
  const [form, setForm] = useState<FormState>(initial)
  const [generating, setGenerating] = useState(false)
  const [step, setStep] = useState(0)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const validate = (): string | null => {
    if (!form.startup_name.trim()) return 'Give your startup a name.'
    if (form.idea.trim().length < 10) return 'Describe your idea in a few sentences (at least 10 characters).'
    const goal = form.funding_goal ? Number(form.funding_goal) : 0
    if (goal < 0) return 'Funding goal must be a positive number.'
    return null
  }

  const handleGenerate = async () => {
    const err = validate()
    if (err) {
      toast.error(err)
      return
    }
    setGenerating(true)
    setStep(0)
    const interval = setInterval(() => {
      setStep((s) => Math.min(s + 1, GENERATION_STEPS.length - 1))
    }, 2600)
    try {
      const plan = await generateBusinessPlan({
        startup_name: form.startup_name.trim(),
        idea: form.idea.trim(),
        industry: form.industry.trim() || undefined,
        country: form.country.trim() || undefined,
        target_audience: form.target_audience.trim() || undefined,
        stage: form.stage,
        funding_goal: form.funding_goal ? Number(form.funding_goal) : 0,
        budget: form.budget ? Number(form.budget) : 0,
        team_size: form.team_size ? Number(form.team_size) : 1,
        business_model: form.business_model,
      })
      toast.success('Business plan generated!')
      navigate(`/business-plan/${plan.id}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Generation failed. Please try again.')
    } finally {
      clearInterval(interval)
      setGenerating(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">AI Business Plan Generator</h1>
          <p className="mt-1 text-sm text-gray-500">
            Describe your startup idea and get a complete investor-ready business plan, pitch deck and financial model.
          </p>
        </div>
      </div>

      {generating ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-white to-accent/10 p-10 text-center dark:from-primary/15 dark:via-dark-100 dark:to-accent/10"
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
          <h2 className="mt-5 text-xl font-bold">Crafting your business plan</h2>
          <p className="mt-2 text-sm text-gray-500">
            This can take a minute or two while the AI builds your full plan.
          </p>
          <div className="mx-auto mt-8 max-w-sm">
            <div className="flex flex-col gap-3 text-left">
              {GENERATION_STEPS.map((label, i) => (
                <div key={label} className="flex items-center gap-2.5 text-sm">
                  <span
                    className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      i < step
                        ? 'bg-green-500 text-white'
                        : i === step
                          ? 'bg-primary text-white'
                          : 'bg-gray-200 text-gray-400 dark:bg-dark-300 dark:text-gray-400'
                    }`}
                  >
                    {i < step ? '✓' : i + 1}
                  </span>
                  <span
                    className={i <= step ? 'font-medium text-gray-800 dark:text-gray-200' : 'text-gray-400 dark:text-gray-400'}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8 dark:border-dark-300 dark:bg-dark-100">
          <div className="mb-6 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-brand text-white">
              <Wand2 className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-bold">Tell us about your idea</h2>
              <p className="text-sm text-gray-500">The more detail you give, the better the plan.</p>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Startup name *</label>
              <input
                value={form.startup_name}
                onChange={(e) => set('startup_name', e.target.value)}
                placeholder="e.g. SwiftTrack"
                className={inputCls}
                maxLength={120}
              />
            </div>
            <div>
              <label className={labelCls}>Industry</label>
              <input
                value={form.industry}
                onChange={(e) => set('industry', e.target.value)}
                placeholder="e.g. Construction software, Health AI…"
                className={inputCls}
              />
            </div>

            <div className="sm:col-span-2">
              <label className={labelCls}>Your idea *</label>
              <textarea
                value={form.idea}
                onChange={(e) => set('idea', e.target.value)}
                rows={4}
                placeholder="e.g. A project management app for small construction crews that automates daily reporting and material ordering…"
                className={`${inputCls} resize-none`}
                maxLength={8000}
              />
            </div>

            <div>
              <label className={labelCls}>Target audience</label>
              <input
                value={form.target_audience}
                onChange={(e) => set('target_audience', e.target.value)}
                placeholder="e.g. small construction crews (5–50 people)"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Country / market</label>
              <input
                value={form.country}
                onChange={(e) => set('country', e.target.value)}
                placeholder="e.g. USA"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Stage</label>
              <select
                value={form.stage}
                onChange={(e) => set('stage', e.target.value as PlanStage)}
                className={`${inputCls} cursor-pointer`}
              >
                {PLAN_STAGES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Business model</label>
              <select
                value={form.business_model}
                onChange={(e) => set('business_model', e.target.value as BusinessModel)}
                className={`${inputCls} cursor-pointer`}
              >
                {BUSINESS_MODELS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Funding goal (USD)</label>
              <input
                type="number"
                min={0}
                value={form.funding_goal}
                onChange={(e) => set('funding_goal', e.target.value)}
                placeholder="e.g. 250000"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Monthly budget (USD)</label>
              <input
                type="number"
                min={0}
                value={form.budget}
                onChange={(e) => set('budget', e.target.value)}
                placeholder="e.g. 15000"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Team size</label>
              <input
                type="number"
                min={1}
                max={500}
                value={form.team_size}
                onChange={(e) => set('team_size', e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-1.5 text-xs text-gray-400">
              <Sparkles className="h-3.5 w-3.5" />
              Uses your preferred AI model if connected, otherwise an instant offline engine.
            </p>
            <button onClick={handleGenerate} className="btn-primary inline-flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Generate Business Plan
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
