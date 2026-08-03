import { useEffect, useRef, useState } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import {
  Check,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Rocket,
  Save,
  Upload,
  FileText,
  X,
  Globe,
} from 'lucide-react'
import { useSession } from '../../context/AuthContext'
import { Field, TextInput, SelectInput } from '../FormInput'
import { ChipSelector } from '../ChipSelector'
import { StartupCard } from '../dashboard/StartupCard'
import { uploadPitchDeck } from '../../lib/storage'
import { createStartup, updateStartup } from '../../lib/startups'
import {
  INDUSTRIES,
  STAGES,
  FUNDING_OPTIONS,
  TEAM_ROLES,
  TECH_STACK,
  STARTUP_FORM_STEPS,
  EQUITY_MIN,
  EQUITY_MAX,
  EQUITY_STEP,
  MAX_NAME_LENGTH,
  MAX_TAGLINE_LENGTH,
  MAX_DESCRIPTION_LENGTH,
} from '../../lib/constants'
import type { Startup, StartupStage } from '../../types'
import type { StartupInsert } from '../../lib/startups'

const urlOrEmpty = z.preprocess(
  (v) => {
    if (v === '' || v == null) return undefined
    const s = String(v).trim()
    return /^https?:\/\//i.test(s) ? s : `https://${s}`
  },
  z.string().url('Enter a valid URL (e.g. https://yourstartup.com)').optional(),
)

const startupSchema = z.object({
  name: z.string().min(1, 'Startup name is required').max(MAX_NAME_LENGTH, `Max ${MAX_NAME_LENGTH} characters`),
  tagline: z.string().min(1, 'Tagline is required').max(MAX_TAGLINE_LENGTH, `Max ${MAX_TAGLINE_LENGTH} characters`),
  description: z
    .string()
    .min(1, 'Description is required')
    .max(MAX_DESCRIPTION_LENGTH, `Max ${MAX_DESCRIPTION_LENGTH} characters`),
  industry: z.string().min(1, 'Select an industry'),
  stage: z.enum(['idea', 'mvp', 'growth', 'scaling'], { message: 'Select a stage' }),
  team_roles_needed: z.array(z.string()).min(1, 'Select at least one role'),
  equity_offered: z.number().min(EQUITY_MIN).max(EQUITY_MAX),
  remote_friendly: z.boolean(),
  location: z.string().max(100, 'Max 100 characters').optional().or(z.literal('')),
  funding_needed: z.string().min(1, 'Select a funding stage'),
  tech_stack: z.array(z.string()).min(1, 'Select at least one technology'),
  website_url: urlOrEmpty,
})

export type StartupFormValues = z.infer<typeof startupSchema>

const STAGE_FIELDS: (keyof StartupFormValues)[] = ['name', 'tagline', 'description', 'industry', 'stage']
const TEAM_FIELDS: (keyof StartupFormValues)[] = ['team_roles_needed', 'equity_offered', 'remote_friendly', 'location']
const FUNDING_FIELDS: (keyof StartupFormValues)[] = ['funding_needed', 'tech_stack', 'website_url']

const EMPTY_VALUES: StartupFormValues = {
  name: '',
  tagline: '',
  description: '',
  industry: '',
  stage: 'idea',
  team_roles_needed: [],
  equity_offered: 5,
  remote_friendly: true,
  location: '',
  funding_needed: '',
  tech_stack: [],
  website_url: '',
}

const DRAFT_PREFIX = 'founderhub:startup-draft:'

interface StartupFormProps {
  initial?: Startup | null
  mode: 'create' | 'edit'
  onDone: (startup: Startup, published: boolean) => void
}

export function StartupForm({ initial, mode, onDone }: StartupFormProps) {
  const { user } = useSession()
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [deckFile, setDeckFile] = useState<File | null>(null)
  const [pitchDeckUrl, setPitchDeckUrl] = useState<string | null>(initial?.pitch_deck_url ?? null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const autosaveRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const draftKey = user ? `${DRAFT_PREFIX}${user.id}` : null

  const loadDraft = (): Partial<StartupFormValues> | null => {
    if (mode !== 'create' || !draftKey) return null
    try {
      const raw = localStorage.getItem(draftKey)
      if (!raw) return null
      return JSON.parse(raw) as Partial<StartupFormValues>
    } catch {
      return null
    }
  }

  const defaultValues: StartupFormValues = {
    ...EMPTY_VALUES,
    ...(initial
      ? {
          name: initial.name ?? '',
          tagline: initial.tagline ?? '',
          description: initial.description ?? '',
          industry: initial.industry ?? '',
          stage: (initial.stage ?? 'idea') as StartupFormValues['stage'],
          team_roles_needed: initial.team_roles_needed ?? [],
          equity_offered: initial.equity_offered ?? 5,
          remote_friendly: initial.remote_friendly ?? true,
          location: initial.location ?? '',
          funding_needed: initial.funding_needed ?? '',
          tech_stack: initial.tech_stack ?? [],
          website_url: initial.website_url ?? '',
        }
      : loadDraft() ?? {}),
  }

  const {
    register,
    watch,
    getValues,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<StartupFormValues>({
    resolver: zodResolver(startupSchema) as Resolver<StartupFormValues>,
    defaultValues,
  })

  const values = watch()

  // Draft autosave every 30 seconds (create mode only).
  useEffect(() => {
    if (mode !== 'create' || !draftKey) return
    autosaveRef.current = setInterval(() => {
      const current = getValues()
      try {
        localStorage.setItem(
          draftKey,
          JSON.stringify({
            ...current,
            name: current.name || undefined,
          }),
        )
      } catch {
        // Storage full / unavailable — ignore.
      }
    }, 30_000)
    return () => {
      if (autosaveRef.current) clearInterval(autosaveRef.current)
    }
  }, [mode, draftKey, getValues])

  const clearDraft = () => {
    if (draftKey) localStorage.removeItem(draftKey)
  }

  const next = async () => {
    const fields = step === 0 ? STAGE_FIELDS : step === 1 ? TEAM_FIELDS : FUNDING_FIELDS
    const ok = await trigger(fields as never)
    if (!ok) {
      const firstError = Object.values(errors)[0]
      if (firstError?.message) toast.error(firstError.message)
      return
    }
    setStep((s) => Math.min(s + 1, STARTUP_FORM_STEPS.length - 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const back = () => {
    setStep((s) => Math.max(s - 1, 0))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDeckSelect = (file: File | undefined) => {
    if (!file) return
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Pitch deck must be a PDF file')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Pitch deck must be under 10MB')
      return
    }
    setDeckFile(file)
  }

  const submit = async (published: boolean) => {
    const ok = await trigger()
    if (!ok) {
      toast.error('Please fix the validation errors before continuing')
      return
    }

    setSubmitting(true)
    try {
      let deck = pitchDeckUrl
      if (deckFile) {
        deck = await uploadPitchDeck(deckFile, user?.id ?? 'unknown')
        setPitchDeckUrl(deck)
      }

      const payload: StartupInsert = {
        founder_id: user?.id,
        name: values.name.trim(),
        tagline: values.tagline.trim(),
        description: values.description.trim(),
        industry: values.industry,
        stage: values.stage,
        team_roles_needed: values.team_roles_needed,
        equity_offered: values.equity_offered,
        remote_friendly: values.remote_friendly,
        location: values.location?.trim() || null,
        funding_needed: values.funding_needed,
        tech_stack: values.tech_stack,
        website_url: values.website_url?.trim() || null,
        pitch_deck_url: deck,
        is_published: published,
      }

      const startup =
        mode === 'edit' && initial
          ? await updateStartup(initial.id, payload)
          : await createStartup(payload)

      if (mode === 'create') clearDraft()
      onDone(startup, published)
    } catch (err) {
      const message =
        typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : err instanceof Error
            ? err.message
            : 'Failed to save startup'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const previewStartup: Startup = {
    id: initial?.id ?? 'preview',
    founder_id: initial?.founder_id ?? user?.id ?? '',
    name: values.name || 'Startup Name',
    tagline: values.tagline || 'Your tagline appears here',
    description: values.description || 'Your description will appear here.',
    industry: values.industry || 'Other',
    stage: values.stage as StartupStage,
    funding_needed: values.funding_needed || 'Bootstrapped',
    equity_offered: values.equity_offered,
    remote_friendly: values.remote_friendly,
    location: values.location || null,
    website_url: values.website_url || null,
    pitch_deck_url: pitchDeckUrl,
    tech_stack: values.tech_stack,
    team_roles_needed: values.team_roles_needed,
    is_published: false,
    created_at: new Date().toISOString(),
    updated_at: null,
  }

  const isLastStep = step === STARTUP_FORM_STEPS.length - 1
  const input = 'border border-gray-200 bg-white dark:border-dark-300 dark:bg-dark'

  return (
    <form onSubmit={(e) => e.preventDefault()} className="mx-auto w-full max-w-2xl">
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STARTUP_FORM_STEPS.map((label, i) => (
            <div key={label} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                    i < step
                      ? 'bg-primary text-white'
                      : i === step
                        ? 'bg-gradient-brand text-white ring-4 ring-primary/20'
                        : 'bg-gray-100 text-gray-400 dark:bg-dark-200 dark:text-gray-500'
                  }`}
                >
                  {i < step ? <Check className="h-4 w-4" /> : i + 1}
                </span>
                <span
                  className={`whitespace-nowrap text-[10px] font-medium sm:text-[11px] ${
                    i <= step ? 'text-primary' : 'text-gray-400'
                  }`}
                >
                  {label}
                </span>
              </div>
              {i < STARTUP_FORM_STEPS.length - 1 && (
                <div className="mx-1 mb-5 h-0.5 flex-1 overflow-hidden rounded bg-gray-100 sm:mx-2 dark:bg-dark-200">
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

      {/* STEP 1 — Basic Info */}
      {step === 0 && (
        <div className="flex flex-col gap-5">
          <Field label="Startup Name" error={errors.name?.message}>
            <TextInput
              {...register('name')}
              placeholder="Acme AI"
              maxLength={MAX_NAME_LENGTH}
            />
            <span className="text-right text-xs text-gray-400">{values.name.length}/{MAX_NAME_LENGTH}</span>
          </Field>

          <Field label="Tagline" error={errors.tagline?.message}>
            <TextInput
              {...register('tagline')}
              placeholder="One line about what you're building"
              maxLength={MAX_TAGLINE_LENGTH}
            />
            <span className="text-right text-xs text-gray-400">{values.tagline.length}/{MAX_TAGLINE_LENGTH}</span>
          </Field>

          <Field label="Description" error={errors.description?.message}>
            <textarea
              {...register('description')}
              rows={5}
              placeholder="What does your startup do? Who is it for? What problem does it solve?"
              maxLength={MAX_DESCRIPTION_LENGTH}
              className="w-full resize-none rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition-colors placeholder:text-gray-400 focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark"
            />
            <span className="text-right text-xs text-gray-400">{values.description.length}/{MAX_DESCRIPTION_LENGTH}</span>
          </Field>

          <Field label="Industry" error={errors.industry?.message}>
            <SelectInput {...register('industry')} className={input}>
              <option value="">Select an industry…</option>
              {INDUSTRIES.map((industry) => (
                <option key={industry} value={industry}>
                  {industry}
                </option>
              ))}
            </SelectInput>
          </Field>

          <Field label="Stage" error={errors.stage?.message}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {STAGES.map((stage) => {
                const value = stage.toLowerCase() as StartupFormValues['stage']
                const active = values.stage === value
                return (
                  <button
                    key={stage}
                    type="button"
                    onClick={() => setValue('stage', value, { shouldValidate: true })}
                    className={`rounded-xl border px-3 py-3 text-sm font-semibold transition-all ${
                      active
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-primary dark:border-dark-300 dark:bg-dark dark:text-gray-300'
                    }`}
                  >
                    {stage}
                  </button>
                )
              })}
            </div>
          </Field>
        </div>
      )}

      {/* STEP 2 — Team & Roles */}
      {step === 1 && (
        <div className="flex flex-col gap-6">
          <Field label="Team Roles Needed" error={errors.team_roles_needed?.message}>
            <ChipSelector
              options={TEAM_ROLES}
              selected={values.team_roles_needed}
              onChange={(selected) => setValue('team_roles_needed', selected, { shouldValidate: true })}
            />
          </Field>

          <Field label={`Equity Offered — ${values.equity_offered}%`}>
            <input
              type="range"
              min={EQUITY_MIN}
              max={EQUITY_MAX}
              step={EQUITY_STEP}
              value={values.equity_offered}
              onChange={(e) => setValue('equity_offered', Number(e.target.value), { shouldValidate: true })}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>{EQUITY_MIN}%</span>
              <span>{EQUITY_MAX}%</span>
            </div>
          </Field>

          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-dark-300 dark:bg-dark">
            <input
              type="checkbox"
              checked={values.remote_friendly}
              onChange={(e) => setValue('remote_friendly', e.target.checked, { shouldValidate: true })}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <span>
              <span className="block text-sm font-semibold">Remote friendly</span>
              <span className="block text-xs text-gray-500">Team works remotely or is open to it</span>
            </span>
          </label>

          <Field label="Location" error={errors.location?.message}>
            <TextInput
              {...register('location')}
              placeholder="Bengaluru, India (optional)"
              maxLength={100}
            />
          </Field>
        </div>
      )}

      {/* STEP 3 — Funding & Tech */}
      {step === 2 && (
        <div className="flex flex-col gap-6">
          <Field label="Funding Needed" error={errors.funding_needed?.message}>
            <SelectInput {...register('funding_needed')} className={input}>
              <option value="">How much funding are you looking for?</option>
              {FUNDING_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </SelectInput>
          </Field>

          <Field label="Tech Stack" error={errors.tech_stack?.message}>
            <ChipSelector
              options={TECH_STACK}
              selected={values.tech_stack}
              onChange={(selected) => setValue('tech_stack', selected, { shouldValidate: true })}
            />
          </Field>

          <Field label="Website URL" error={errors.website_url?.message}>
            <TextInput
              {...register('website_url')}
              type="url"
              placeholder="https://yourstartup.com (optional)"
            />
          </Field>

          <Field label="Pitch Deck">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => handleDeckSelect(e.target.files?.[0])}
            />
            {!deckFile && !pitchDeckUrl ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 py-10 text-sm text-gray-500 transition-colors hover:border-primary hover:text-primary dark:border-dark-400"
              >
                <Upload className="h-6 w-6" />
                <span className="font-medium">Upload pitch deck (PDF, max 10MB)</span>
                <span className="text-xs">Shown to applicants on your startup page</span>
              </button>
            ) : (
              <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-dark-300 dark:bg-dark">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10 text-red-500">
                  <FileText className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{deckFile?.name ?? 'Pitch deck attached'}</p>
                  <p className="text-xs text-gray-500">
                    {deckFile ? `${(deckFile.size / 1024 / 1024).toFixed(1)}MB PDF` : 'PDF'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDeckFile(null)
                    setPitchDeckUrl(null)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                  className="rounded-lg p-1.5 text-gray-400 hover:text-red-500"
                  aria-label="Remove deck"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            )}
          </Field>
        </div>
      )}

      {/* STEP 4 — Preview & Publish */}
      {step === 3 && (
        <div className="flex flex-col gap-6">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-bold">
              <Globe className="h-5 w-5 text-primary" />
              Preview — how others will see it
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              This is exactly how your startup card will appear on the Explore page.
            </p>
          </div>

          <StartupCard startup={previewStartup} showFunding showFounder />

          {mode === 'edit' && initial?.is_published && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-600 dark:text-amber-400">
              <strong>Heads up:</strong> Saving will temporarily unpublish this startup while it updates,
              then re-publish it.
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="mt-8 flex items-center justify-between gap-3">
        <button type="button" onClick={back} disabled={step === 0 || submitting} className="btn-ghost disabled:pointer-events-none disabled:opacity-40">
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        {!isLastStep ? (
          <button type="button" onClick={next} className="btn-primary">
            Continue
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => submit(false)}
              disabled={submitting}
              className="btn-ghost"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save as Draft
            </button>
            <button
              type="button"
              onClick={() => submit(true)}
              disabled={submitting}
              className="btn-primary"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
              Publish Startup
            </button>
          </div>
        )}
      </div>
    </form>
  )
}
