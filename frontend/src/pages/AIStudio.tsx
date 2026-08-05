import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Cpu, Loader2, RefreshCw, Sparkles, Square } from 'lucide-react'
import { AppHeader } from '../components/AppHeader'
import { useSession } from '../context/AuthContext'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8001'

const FEATURES = [
  { id: 'business_plan', label: 'Business Plan' },
  { id: 'pitch_deck', label: 'Pitch Deck Outline' },
  { id: 'product_roadmap', label: 'Product Roadmap' },
]

const PROVIDER_LABELS: Record<string, string> = {
  platform: 'Platform Credits',
  anthropic: 'ANTHROPIC',
  openai: 'OPENAI',
  openrouter: 'OPENROUTER',
  nvidia: 'NVIDIA NIM',
}

export default function AIStudio() {
  const { user, session, profile } = useSession()
  const [idea, setIdea] = useState('')
  const [feature, setFeature] = useState('business_plan')
  const [output, setOutput] = useState('')
  const [generating, setGenerating] = useState(false)
  const [currentProvider, setCurrentProvider] = useState(profile?.preferred_ai_provider ?? 'platform')
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (profile?.preferred_ai_provider) setCurrentProvider(profile.preferred_ai_provider)
  }, [profile?.preferred_ai_provider])

  const generate = async () => {
    if (!idea.trim() || generating) return
    setGenerating(true)
    setOutput('')
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const res = await fetch(`${API_URL}/api/ai/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ feature, idea: idea.trim() }),
        signal: controller.signal,
      })
      if (!res.ok) {
        let detail = 'AI generation failed'
        try {
          const data = await res.json()
          if (data.detail) detail = data.detail
        } catch {
          // ignore
        }
        throw new Error(detail)
      }
      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let done = false
      let streamError: string | null = null
      while (!done) {
        const { done: streamDone, value } = await reader.read()
        if (streamDone) break
        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop() ?? ''
        for (const event of events) {
          if (!event.startsWith('data: ')) continue
          const payload = event.slice(6).trim()
          if (payload === '[DONE]') {
            done = true
            break
          }
          try {
            const parsed = JSON.parse(payload)
            if (typeof parsed === 'string') {
              setOutput((prev) => prev + parsed)
            } else if (parsed.error) {
              streamError = parsed.error
              done = true
              break
            } else if (typeof parsed.text === 'string') {
              setOutput((prev) => prev + parsed.text)
            }
          } catch {
            // ignore partial frames
          }
        }
      }
      if (streamError) throw new Error(streamError)
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        setOutput((prev) => prev + `\n\n[Error] ${err instanceof Error ? err.message : 'Generation failed'}\n`)
      }
    } finally {
      setGenerating(false)
      abortRef.current = null
    }
  }

  const stop = () => abortRef.current?.abort()

  const providerLabel = PROVIDER_LABELS[currentProvider] ?? currentProvider

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark">
      <AppHeader title="AI Studio" backTo="/dashboard" backLabel="Back to Dashboard" />
      <main className="mx-auto max-w-3xl px-4 pt-8 pb-24 sm:px-6 lg:pb-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-extrabold">AI Studio</h1>
            <p className="text-sm text-gray-500">Turn an idea into a business plan, pitch deck outline or roadmap.</p>
          </div>
        </div>

        {/* Provider indicator */}
        <div className="mb-5 flex items-center justify-between rounded-xl border border-gray-200 bg-white p-3 dark:border-dark-300 dark:bg-dark-100">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-primary" />
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Using: <span className="font-semibold text-gray-900 dark:text-white">{providerLabel}</span>
            </span>
          </div>
          <Link
            to="/settings/ai"
            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Change <RefreshCw className="h-3 w-3" />
          </Link>
        </div>

        {/* Feature + idea */}
        <div className="mb-5 rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100">
          <label className="mb-2 block text-sm font-semibold text-gray-900 dark:text-white">What do you want to generate?</label>
          <div className="mb-4 flex flex-wrap gap-2">
            {FEATURES.map((f) => (
              <button
                key={f.id}
                onClick={() => setFeature(f.id)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  feature === f.id
                    ? 'bg-primary text-white'
                    : 'border border-gray-200 text-gray-600 hover:border-primary hover:text-primary dark:border-dark-300 dark:text-gray-300'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <label className="mb-2 block text-sm font-semibold text-gray-900 dark:text-white">Your idea</label>
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            rows={4}
            placeholder="e.g. A marketplace that connects founders with pre-vetted freelance developers..."
            className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-900 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark dark:text-white"
          />

          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={generate}
              disabled={generating || !idea.trim()}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generating ? 'Generating...' : 'Generate'}
            </button>
            {generating && (
              <button
                onClick={stop}
                className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:border-red-400 hover:text-red-500 dark:border-dark-300 dark:text-gray-300"
              >
                <Square className="h-3.5 w-3.5" /> Stop
              </button>
            )}
          </div>
        </div>

        {/* Output */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Output</h2>
            {output && !generating && (
              <button
                onClick={() => setOutput('')}
                className="text-xs font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                Clear
              </button>
            )}
          </div>
          <div className="min-h-[200px] whitespace-pre-wrap rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm leading-relaxed text-gray-800 dark:border-dark-300 dark:bg-dark dark:text-gray-200">
            {output || (
              <span className="text-gray-400">
                {user?.email ? 'Your generated content will appear here.' : 'Loading...'}
              </span>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
