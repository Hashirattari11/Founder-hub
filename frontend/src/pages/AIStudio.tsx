import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Check,
  Copy,
  Cpu,
  Download,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  X,
} from 'lucide-react'
import { AppHeader } from '../components/AppHeader'
import { AiMarkdown } from '../components/studio/AiMarkdown'
import { StudioIcon } from '../lib/studioIcons'
import { runAIStudioTool, useAIStudioConfig } from '../lib/aiStudio'
import { useSession } from '../context/AuthContext'
import type { AIToolInfo, ToolField } from '../types/aiStudio'

const PROVIDER_LABELS: Record<string, string> = {
  platform: 'Platform Credits',
  anthropic: 'ANTHROPIC',
  openai: 'OPENAI',
  openrouter: 'OPENROUTER',
  nvidia: 'NVIDIA NIM',
}

const GENERATION_STEPS = [
  'Thinking through your inputs...',
  'Applying expert knowledge...',
  'Structuring the answer...',
  'Polishing the output...',
]

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: ToolField
  value: string
  onChange: (key: string, value: string) => void
}) {
  const base =
    'w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-900 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark dark:text-white'
  if (field.type === 'textarea') {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(field.key, e.target.value)}
        rows={5}
        placeholder={field.placeholder}
        className={`${base} resize-none`}
      />
    )
  }
  if (field.type === 'select') {
    return (
      <select value={value} onChange={(e) => onChange(field.key, e.target.value)} className={base}>
        <option value="">Select...</option>
        {(field.options ?? []).map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    )
  }
  return (
    <input
      type={field.type === 'number' ? 'number' : 'text'}
      value={value}
      onChange={(e) => onChange(field.key, e.target.value)}
      placeholder={field.placeholder}
      className={base}
    />
  )
}

function ToolPanel({ tool, onClose }: { tool: AIToolInfo; onClose: () => void }) {
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [output, setOutput] = useState('')
  const [provider, setProvider] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [step, setStep] = useState(0)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setInputs({})
    setOutput('')
    setProvider(null)
    setGenerating(false)
    setStep(0)
  }, [tool.slug])

  useEffect(() => {
    if (!generating) return
    const interval = setInterval(() => setStep((s) => Math.min(s + 1, GENERATION_STEPS.length - 1)), 2400)
    return () => clearInterval(interval)
  }, [generating])

  const set = (key: string, value: string) => setInputs((prev) => ({ ...prev, [key]: value }))

  const generate = async () => {
    const missing = tool.fields
      .filter((f) => f.required && !(inputs[f.key] ?? '').trim())
      .map((f) => f.label)
    if (missing.length) {
      toast.error(`Missing required field: ${missing.join(', ')}`)
      return
    }
    setGenerating(true)
    setOutput('')
    setStep(0)
    try {
      const result = await runAIStudioTool(tool.slug, inputs)
      setOutput(result.output)
      setProvider(result.provider)
      toast.success(`${tool.name} ready`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const copyOutput = async () => {
    if (!output) return
    await navigator.clipboard.writeText(output)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const downloadOutput = () => {
    if (!output) return
    const blob = new Blob([output], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${tool.slug}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white sm:rounded-2xl dark:bg-dark-100">
        <div className="flex items-start gap-3 border-b border-gray-200 p-4 sm:p-5 dark:border-dark-300">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <StudioIcon name={tool.icon} className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-gray-900 dark:text-white">{tool.name}</h2>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{tool.description}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-dark-300 dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          {tool.fields.map((field) => (
            <div key={field.key}>
              <label className="mb-1.5 block text-sm font-medium text-gray-900 dark:text-white">
                {field.label}
                {field.required && <span className="ml-0.5 text-red-500">*</span>}
              </label>
              <FieldInput field={field} value={inputs[field.key] ?? ''} onChange={set} />
            </div>
          ))}

          {generating && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-dark-300 dark:bg-dark">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                {GENERATION_STEPS[step]}
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-dark-300">
                <div
                  className="h-full rounded-full bg-gradient-brand transition-all duration-500"
                  style={{ width: `${((step + 1) / GENERATION_STEPS.length) * 100}%` }}
                />
              </div>
            </div>
          )}

          {output && !generating && (
            <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-dark-300 dark:bg-dark">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                  Output
                  {provider && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                      {PROVIDER_LABELS[provider] ?? provider}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={copyOutput}
                    title="Copy"
                    className="flex items-center gap-1 rounded-lg p-1.5 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-dark-300 dark:hover:text-white"
                  >
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={downloadOutput}
                    title="Download .md"
                    className="flex items-center gap-1 rounded-lg p-1.5 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-dark-300 dark:hover:text-white"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-dark-300 dark:bg-dark">
                <AiMarkdown content={output} />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-gray-200 p-4 sm:p-5 dark:border-dark-300">
          <button
            onClick={generate}
            disabled={generating}
            className="btn-primary flex flex-1 items-center justify-center gap-2 disabled:opacity-50"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generating ? 'Generating...' : 'Generate'}
          </button>
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 dark:border-dark-300 dark:text-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AIStudio() {
  const { profile } = useSession()
  const { config, error } = useAIStudioConfig(profile?.id)
  const [activeStudio, setActiveStudio] = useState('all')
  const [category, setCategory] = useState('all')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<AIToolInfo | null>(null)

  useEffect(() => {
    if (config?.primary_role) setActiveStudio(config.primary_role)
  }, [config?.primary_role])

  const tools = useMemo(() => {
    if (!config) return []
    let list = config.tools
    if (activeStudio !== 'all') {
      list = list.filter(
        (t) => t.roles.includes('common') || t.roles.includes(activeStudio),
      )
    }
    if (category !== 'all') {
      list = list.filter((t) => t.category === category)
    }
    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q),
      )
    }
    return list
  }, [config, activeStudio, category, query])

  const primaryStudio = config?.studios.find((s) => s.role === config.primary_role)
  const providerLabel = PROVIDER_LABELS[profile?.preferred_ai_provider ?? 'platform'] ?? 'Platform Credits'

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark">
        <AppHeader title="AI Studio" backTo="/dashboard" backLabel="Back to Dashboard" />
        <main className="mx-auto max-w-3xl px-4 pt-8 pb-24 sm:px-6 lg:pb-8">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-500/30 dark:bg-red-500/10">
            <p className="font-semibold text-red-600 dark:text-red-400">Could not load your AI Studio</p>
            <p className="mt-1 text-sm text-red-500/80">{error}</p>
          </div>
        </main>
      </div>
    )
  }

  if (!config) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark">
        <AppHeader title="AI Studio" backTo="/dashboard" backLabel="Back to Dashboard" />
        <main className="mx-auto max-w-5xl px-4 pt-16 pb-24 sm:px-6 lg:pb-8">
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-4 text-sm text-gray-500">Loading your AI Studio...</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark">
      <AppHeader
        title={primaryStudio?.label ?? 'AI Studio'}
        backTo="/dashboard"
        backLabel="Back to Dashboard"
      />
      <main className="mx-auto max-w-5xl px-4 pt-8 pb-24 sm:px-6 lg:pb-8">
        {/* Hero */}
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-brand text-white shadow-lg shadow-primary/20">
            <Sparkles className="h-7 w-7" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">
              {primaryStudio?.label ?? 'AI Studio'}
            </h1>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              AI tools built for your role. No idea what to pick? Start with any tool below.
            </p>
          </div>
          <Link
            to="/settings/ai"
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:border-primary hover:text-primary dark:border-dark-300 dark:bg-dark-100 dark:text-gray-300"
          >
            <Cpu className="h-3.5 w-3.5 text-primary" />
            Using: <span className="font-semibold">{providerLabel}</span>
            <RefreshCw className="h-3 w-3" />
          </Link>
        </div>

        {/* Role badges */}
        {config.roles.length > 0 && (
          <div className="mb-5 flex flex-wrap gap-2">
            {config.roles.map((role) => (
              <span
                key={role}
                className="rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary"
              >
                {role.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        )}

        {/* Studio tabs */}
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveStudio('all')}
            className={`rounded-xl px-3.5 py-2 text-sm font-medium transition-colors ${
              activeStudio === 'all'
                ? 'bg-gradient-brand text-white shadow-md shadow-primary/20'
                : 'border border-gray-200 bg-white text-gray-600 hover:border-primary hover:text-primary dark:border-dark-300 dark:bg-dark-100 dark:text-gray-300'
            }`}
          >
            All Tools
          </button>
          {config.studios.map((studio) => (
            <button
              key={studio.role}
              onClick={() => setActiveStudio(studio.role)}
              className={`rounded-xl px-3.5 py-2 text-sm font-medium transition-colors ${
                activeStudio === studio.role
                  ? 'bg-gradient-brand text-white shadow-md shadow-primary/20'
                  : 'border border-gray-200 bg-white text-gray-600 hover:border-primary hover:text-primary dark:border-dark-300 dark:bg-dark-100 dark:text-gray-300'
              }`}
            >
              {studio.label.replace(' AI Studio', '')}
            </button>
          ))}
        </div>

        {/* Search + category */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tools..."
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm outline-none transition-colors placeholder:text-gray-400 focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark-100 dark:text-white"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setCategory('all')}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                category === 'all'
                  ? 'bg-primary text-white'
                  : 'bg-white text-gray-500 hover:text-primary dark:bg-dark-100 dark:text-gray-400'
              }`}
            >
              All
            </button>
            {config.categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(category === cat ? 'all' : cat)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                  category === cat
                    ? 'bg-primary text-white'
                    : 'bg-white text-gray-500 hover:text-primary dark:bg-dark-100 dark:text-gray-400'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Tool grid */}
        {tools.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center dark:border-dark-300 dark:bg-dark-100">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              No tools match your filters.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map((tool) => (
              <button
                key={tool.slug}
                onClick={() => setSelected(tool)}
                className="group flex flex-col rounded-2xl border border-gray-200 bg-white p-5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 dark:border-dark-300 dark:bg-dark-100"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                    <StudioIcon name={tool.icon} className="h-5 w-5" />
                  </span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:bg-dark-300 dark:text-gray-400">
                    {tool.category}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">{tool.name}</h3>
                <p className="mt-1 line-clamp-2 flex-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                  {tool.description}
                </p>
                {!tool.roles.includes('common') && (
                  <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-primary/70">
                    {tool.roles.filter((r) => r !== 'common').join(', ').replace(/_/g, ' ')}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}
      </main>

      {selected && <ToolPanel tool={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
