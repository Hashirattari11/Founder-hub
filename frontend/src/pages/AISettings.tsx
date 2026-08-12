import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import {
  Bot,
  Brain,
  Cpu,
  Eye,
  EyeOff,
  Globe,
  Loader2,
  Plug,
  Save,
  Trash2,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { AppHeader } from '../components/AppHeader'
import { useSession } from '../context/AuthContext'
import { updateProfile } from '../lib/profile'
import { api } from '../lib/api'
import { getErrorMessage } from '../lib/errors'

type ProviderId = 'anthropic' | 'openai' | 'openrouter' | 'nvidia'

interface ProviderInfo {
  name: string
  logo: LucideIcon
  color: string
  description: string
  keyLink: string
  keyPlaceholder: string
}

const PROVIDER_INFO: Record<ProviderId, ProviderInfo> = {
  anthropic: {
    name: 'Anthropic',
    logo: Bot,
    color: 'text-purple-500 bg-purple-500/10',
    description: 'Claude models — best for writing and analysis',
    keyLink: 'https://console.anthropic.com/api-keys',
    keyPlaceholder: 'sk-ant-api03-...',
  },
  openai: {
    name: 'OpenAI',
    logo: Brain,
    color: 'text-emerald-500 bg-emerald-500/10',
    description: 'GPT-4 models — industry standard',
    keyLink: 'https://platform.openai.com/api-keys',
    keyPlaceholder: 'sk-proj-...',
  },
  openrouter: {
    name: 'OpenRouter',
    logo: Globe,
    color: 'text-sky-500 bg-sky-500/10',
    description: '100+ models in one API — most flexibility',
    keyLink: 'https://openrouter.ai/keys',
    keyPlaceholder: 'sk-or-v1-...',
  },
  nvidia: {
    name: 'Nvidia NIM',
    logo: Zap,
    color: 'text-lime-500 bg-lime-500/10',
    description: 'Fastest inference — GPU optimized models',
    keyLink: 'https://build.nvidia.com/',
    keyPlaceholder: 'nvapi-...',
  },
}

const PROVIDER_IDS = Object.keys(PROVIDER_INFO) as ProviderId[]

interface ModelInfo {
  id: string
  name: string
  description: string
  context: string
}

interface ProviderState {
  key: string
  model: string
  status: 'success' | 'failed' | 'untested' | null
  saved: boolean
  showKey: boolean
  testing: boolean
  saving: boolean
}

const EMPTY_STATE: ProviderState = {
  key: '',
  model: '',
  status: null,
  saved: false,
  showKey: false,
  testing: false,
  saving: false,
}

const MASKED_KEY = '••••••••••••••••••'

export default function AISettings() {
  const { user, profile, refreshProfile } = useSession()
  const [preferredProvider, setPreferredProvider] = useState('platform')
  const [providerStates, setProviderStates] = useState<Record<ProviderId, ProviderState>>(() =>
    Object.fromEntries(PROVIDER_IDS.map((p) => [p, { ...EMPTY_STATE }])) as Record<ProviderId, ProviderState>,
  )
  const [models, setModels] = useState<Record<ProviderId, ModelInfo[]>>({} as Record<ProviderId, ModelInfo[]>)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadModels()
    if (user) loadSettings()
  }, [user])

  useEffect(() => {
    if (profile) setPreferredProvider(profile.preferred_ai_provider ?? 'platform')
  }, [profile])

  const loadModels = async () => {
    try {
      const data = await api.get<Record<ProviderId, ModelInfo[]>>('/api/ai-settings/models')
      setModels(data)
    } catch {
      // models endpoint is optional; page still works without it
    }
  }

  const loadSettings = async () => {
    try {
      const savedKeys = await api.get<{ provider: ProviderId; selected_model: string | null; test_status: string }[]>(
        '/api/ai-settings/my-keys',
        { auth: true },
      )
      setProviderStates((prev) => {
        const next = { ...prev }
        for (const row of savedKeys) {
          next[row.provider] = {
            ...next[row.provider],
            saved: true,
            model: row.selected_model ?? '',
            status: (row.test_status as ProviderState['status']) ?? null,
            key: MASKED_KEY,
          }
        }
        return next
      })
    } finally {
      setLoading(false)
    }
  }

  const setField = (provider: ProviderId, patch: Partial<ProviderState>) =>
    setProviderStates((prev) => ({ ...prev, [provider]: { ...prev[provider], ...patch } }))

  const testConnection = async (provider: ProviderId) => {
    const state = providerStates[provider]
    if (!state.key || state.key.includes('•')) {
      toast.error('Enter your API key first')
      return
    }
    setField(provider, { testing: true, status: null })
    try {
      await api.post(
        '/api/ai-settings/test-key',
        { provider, api_key: state.key, model: state.model || null },
        { auth: true },
      )
      setField(provider, { testing: false, status: 'success' })
      toast.success('Connection successful!')
    } catch (e) {
      setField(provider, { testing: false, status: 'failed' })
      toast.error(getErrorMessage(e, 'network'))
    }
  }

  const saveKey = async (provider: ProviderId) => {
    const state = providerStates[provider]
    if (!state.key || state.key.includes('•')) {
      toast.error('Enter your API key first')
      return
    }
    setField(provider, { saving: true })
    try {
      await api.post(
        '/api/ai-settings/save-key',
        { provider, api_key: state.key, selected_model: state.model || null },
        { auth: true },
      )
      setField(provider, { saving: false, saved: true, key: MASKED_KEY })
      toast.success('API key saved!')
    } catch (e) {
      setField(provider, { saving: false })
      toast.error(getErrorMessage(e, 'generic'))
    }
  }

  const deleteKey = async (provider: ProviderId) => {
    try {
      await api.delete(`/api/ai-settings/delete-key/${provider}`, { auth: true })
      setField(provider, { ...EMPTY_STATE })
      toast.success('Key removed')
    } catch (e) {
      toast.error(getErrorMessage(e, 'generic'))
    }
  }

  const savePreference = async (newProvider: string) => {
    if (!user) return
    setPreferredProvider(newProvider)
    try {
      await updateProfile(user.id, {
        preferred_ai_provider: newProvider,
        preferred_ai_model: providerStates[newProvider as ProviderId]?.model || null,
      })
      await refreshProfile()
      toast.success('Preference saved!')
    } catch {
      toast.error('Could not save preference')
    }
  }

  const ownKeyEnabled = preferredProvider !== 'platform'

  const preferredOwnProvider = (): string => {
    if (preferredProvider !== 'platform') return preferredProvider
    const connected = PROVIDER_IDS.find((p) => providerStates[p]?.saved)
    return connected ?? 'anthropic'
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark">
      <AppHeader title="AI Settings" backTo="/settings/profile" backLabel="Back to Settings" />
      <main className="mx-auto max-w-3xl px-4 pt-8 pb-24 sm:px-6 lg:pb-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Cpu className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-extrabold">AI Provider Settings</h1>
            <p className="text-sm text-gray-500">Connect your own API key for unlimited AI generations.</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Info banner */}
            <div className="mb-6 rounded-xl border border-primary/30 bg-primary/10 p-4">
              <p className="mb-2 text-sm font-semibold text-primary">Benefits of using your own API key</p>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {['Unlimited generations', 'No credit limit', 'Choose any model', 'Full data privacy'].map((b) => (
                  <p key={b} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <span className="text-green-500">✓</span> {b}
                  </p>
                ))}
              </div>
            </div>

            {/* Preferred provider */}
            <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100">
              <h2 className="mb-4 font-semibold text-gray-900 dark:text-white">Preferred AI Source</h2>
              <div className="space-y-3">
                {[
                  { id: 'platform', label: 'Use Platform Credits', desc: 'Powered by the platform key' },
                  { id: 'own_key', label: 'Use My Own API Key', desc: 'Unlimited — use whichever provider below' },
                ].map((opt) => {
                  const active = opt.id === 'own_key' ? ownKeyEnabled : !ownKeyEnabled
                  return (
                    <label
                      key={opt.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-all ${
                        active ? 'border-primary/50 bg-primary/10' : 'border-gray-200 hover:border-gray-300 dark:border-dark-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="provider_pref"
                        checked={active}
                        onChange={() => savePreference(opt.id === 'platform' ? 'platform' : preferredOwnProvider())}
                        className="mt-1 h-4 w-4 text-primary focus:ring-primary"
                      />
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{opt.label}</p>
                        <p className="text-xs text-gray-500">{opt.desc}</p>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Provider cards */}
            <div className="space-y-4">
              {PROVIDER_IDS.map((providerId) => {
                const info = PROVIDER_INFO[providerId]
                const state = providerStates[providerId]
                const providerModels = models[providerId] || []
                const isPreferred = preferredProvider === providerId
                const Logo = info.logo

                return (
                  <div
                    key={providerId}
                    className={`rounded-2xl border bg-white p-5 transition-all dark:bg-dark-100 ${
                      isPreferred ? 'border-primary/50' : 'border-gray-200 dark:border-dark-300'
                    }`}
                  >
                    {/* Card header */}
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${info.color}`}>
                          <Logo className="h-5 w-5" />
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900 dark:text-white">{info.name}</h3>
                            {isPreferred && (
                              <span className="rounded-full border border-primary/30 bg-primary/20 px-2 py-0.5 text-xs text-primary">
                                Active
                              </span>
                            )}
                            {state.saved && (
                              <span className="rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-xs text-green-500">
                                Connected
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">{info.description}</p>
                        </div>
                      </div>

                      {state.saved && !isPreferred && (
                        <button
                          onClick={() => savePreference(providerId)}
                          className="rounded-lg border border-primary/30 px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                        >
                          Set as Active
                        </button>
                      )}
                    </div>

                    {/* API key input */}
                    <div className="mb-4">
                      <div className="mb-1.5 flex items-center justify-between">
                        <label className="text-xs text-gray-500">API Key</label>
                        <a
                          href={info.keyLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                          Get API Key <span>↗</span>
                        </a>
                      </div>
                      <div className="relative">
                        <input
                          type={state.showKey ? 'text' : 'password'}
                          value={state.key}
                          onChange={(e) => setField(providerId, { key: e.target.value, saved: false })}
                          placeholder={info.keyPlaceholder}
                          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 pr-10 font-mono text-sm text-gray-900 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark dark:text-white"
                        />
                        <button
                          onClick={() => setField(providerId, { showKey: !state.showKey })}
                          aria-label={state.showKey ? 'Hide key' : 'Show key'}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          {state.showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Model selector */}
                    {providerModels.length > 0 && (
                      <div className="mb-4">
                        <label className="mb-1.5 block text-xs text-gray-500">Model</label>
                        <select
                          value={state.model}
                          onChange={(e) => setField(providerId, { model: e.target.value })}
                          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark dark:text-white"
                        >
                          <option value="">Select model...</option>
                          {providerModels.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} — {m.description} ({m.context} context)
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Test status */}
                    {state.status && (
                      <div
                        className={`mb-4 flex items-center gap-2 rounded-lg p-2 text-sm ${
                          state.status === 'success'
                            ? 'bg-green-500/10 text-green-500'
                            : 'bg-red-500/10 text-red-500'
                        }`}
                      >
                        {state.status === 'success' ? (
                          <>
                            <span className="text-green-500">✓</span> Connection successful!
                          </>
                        ) : (
                          <>
                            <span className="text-red-500">✕</span> Connection failed. Check your key.
                          </>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => testConnection(providerId)}
                        disabled={state.testing || !state.key}
                        className="flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-2 text-sm text-white transition-colors hover:bg-gray-700 disabled:opacity-50"
                      >
                        {state.testing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Plug className="h-4 w-4" />
                        )}
                        {state.testing ? 'Testing...' : 'Test Connection'}
                      </button>

                      <button
                        onClick={() => saveKey(providerId)}
                        disabled={state.saving || !state.key}
                        className="btn-primary flex items-center gap-2 disabled:opacity-50"
                      >
                        {state.saving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        {state.saving ? 'Saving...' : 'Save Key'}
                      </button>

                      {state.saved && (
                        <button
                          onClick={() => deleteKey(providerId)}
                          className="flex items-center gap-2 rounded-lg bg-red-600/10 px-4 py-2 text-sm text-red-500 transition-colors hover:bg-red-600/20"
                        >
                          <Trash2 className="h-4 w-4" />
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
