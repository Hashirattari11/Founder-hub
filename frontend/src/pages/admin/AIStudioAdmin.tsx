import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Users,
  Wrench,
  XCircle,
} from 'lucide-react'
import { StudioIcon } from '../../lib/studioIcons'
import { AdminAccessDenied } from './adminUi'
import {
  adminAnalytics,
  adminCreateTool,
  adminDeleteTool,
  adminListTools,
  adminListUsers,
  adminSetUserRoles,
  adminUpdateTool,
  adminUsageLogs,
} from '../../lib/aiStudio'
import { useSession } from '../../context/AuthContext'
import { useConfirm } from '../../components/ConfirmDialog'
import type {
  AdminUsersResponse,
  AIToolInfo,
  AnalyticsSummary,
  ToolField,
  UsageLog,
} from '../../types/aiStudio'

const ALL_STUDIO_ROLES = [
  'founder',
  'developer',
  'designer',
  'marketer',
  'investor',
  'legal_advisor',
  'business_analyst',
  'mentor',
  'recruiter',
  'administrator',
]

const FIELD_TYPES = ['text', 'textarea', 'number', 'select']

function toggleInList(list: string[], value: string) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-gray-400">
        {message}
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Tools tab
// ---------------------------------------------------------------------------
interface ToolEditorState {
  open: boolean
  tool: AIToolInfo | null
  slug: string
  name: string
  description: string
  category: string
  icon: string
  roles: string[]
  prompt_template: string
  output_format: string
  is_enabled: boolean
  fields: ToolField[]
}

function emptyEditor(): ToolEditorState {
  return {
    open: false,
    tool: null,
    slug: '',
    name: '',
    description: '',
    category: 'General',
    icon: 'Sparkles',
    roles: [],
    prompt_template: '',
    output_format: 'markdown',
    is_enabled: true,
    fields: [],
  }
}

function ToolsTab() {
  const { confirm, dialog } = useConfirm()
  const [tools, setTools] = useState<AIToolInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [editor, setEditor] = useState<ToolEditorState>(emptyEditor())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminListTools()
      setTools(res.tools)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load tools')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const categories = useMemo(
    () => Array.from(new Set(tools.map((t) => t.category))).sort(),
    [tools],
  )

  const filtered = useMemo(() => {
    let list = tools
    if (category !== 'all') list = list.filter((t) => t.category === category)
    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.slug.toLowerCase().includes(q) ||
          (t.description ?? '').toLowerCase().includes(q),
      )
    }
    return list
  }, [tools, query, category])

  const toggleEnabled = async (tool: AIToolInfo) => {
    try {
      const updated = await adminUpdateTool(tool.slug, { is_enabled: !tool.is_enabled })
      setTools((prev) => prev.map((t) => (t.slug === tool.slug ? updated : t)))
      toast.success(`${updated.name} ${updated.is_enabled ? 'enabled' : 'disabled'}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed')
    }
  }

  const removeTool = async (tool: AIToolInfo) => {
    const ok = await confirm({
      title: `Delete "${tool.name}"?`,
      message: 'This will permanently delete the tool. This cannot be undone.',
      confirmLabel: 'Delete',
    })
    if (!ok) return
    try {
      await adminDeleteTool(tool.slug)
      setTools((prev) => prev.filter((t) => t.slug !== tool.slug))
      toast.success('Tool deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  const saveEditor = async () => {
    if (!editor.name.trim()) {
      toast.error('Name is required')
      return
    }
    if (!editor.prompt_template.trim()) {
      toast.error('Prompt template is required')
      return
    }
    try {
      if (editor.tool) {
        const updated = await adminUpdateTool(editor.tool.slug, {
          name: editor.name,
          description: editor.description,
          category: editor.category,
          icon: editor.icon,
          roles: editor.roles,
          prompt_template: editor.prompt_template,
          output_format: editor.output_format,
          is_enabled: editor.is_enabled,
          input_fields: editor.fields,
        })
        setTools((prev) => prev.map((t) => (t.slug === editor.tool!.slug ? updated : t)))
        toast.success('Tool updated')
      } else {
        if (!/^[a-z0-9_]+$/.test(editor.slug)) {
          toast.error('Slug must be lowercase letters, numbers and underscores')
          return
        }
        const created = await adminCreateTool({
          slug: editor.slug,
          name: editor.name,
          description: editor.description,
          category: editor.category,
          icon: editor.icon,
          roles: editor.roles,
          prompt_template: editor.prompt_template,
          output_format: editor.output_format,
          input_fields: editor.fields,
          is_enabled: editor.is_enabled,
        })
        setTools((prev) => [...prev, created])
        toast.success('Tool created')
      }
      setEditor(emptyEditor())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    }
  }

  const setField = <K extends keyof ToolEditorState>(key: K, value: ToolEditorState[K]) =>
    setEditor((e) => ({ ...e, [key]: value }))

  const updateField = (index: number, patch: Partial<ToolField>) =>
    setEditor((e) => ({
      ...e,
      fields: e.fields.map((f, i) => (i === index ? { ...f, ...patch } : f)),
    }))

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tools..."
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark-100 dark:text-white"
            />
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary dark:border-dark-300 dark:bg-dark-100 dark:text-white"
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setEditor({ ...emptyEditor(), open: true })}
          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-brand px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/20"
        >
          <Plus className="h-4 w-4" /> New Tool
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-dark-300 dark:bg-dark-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 dark:border-dark-300">
              <th className="px-4 py-3">Tool</th>
              <th className="hidden px-4 py-3 sm:table-cell">Category</th>
              <th className="hidden px-4 py-3 md:table-cell">Roles</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <EmptyRow colSpan={5} message="Loading tools..." />
            ) : filtered.length === 0 ? (
              <EmptyRow colSpan={5} message="No tools found" />
            ) : (
              filtered.map((tool) => (
                <tr key={tool.slug} className="border-b border-gray-100 last:border-0 dark:border-dark-300">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <StudioIcon name={tool.icon} className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-gray-900 dark:text-white">{tool.name}</p>
                        <p className="truncate text-xs text-gray-400">
                          {tool.slug} {tool.is_builtin ? '· built-in' : '· custom'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 dark:bg-dark-300 dark:text-gray-400">
                      {tool.category}
                    </span>
                  </td>
                  <td className="hidden max-w-[220px] px-4 py-3 md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {tool.roles.map((r) => (
                        <span key={r} className="rounded bg-primary/5 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                          {r}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleEnabled(tool)}
                      className={`relative h-6 w-11 rounded-full transition-colors ${
                        tool.is_enabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-dark-300'
                      }`}
                      aria-label={`${tool.is_enabled ? 'Disable' : 'Enable'} ${tool.name}`}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                          tool.is_enabled ? 'left-[22px]' : 'left-0.5'
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() =>
                          setEditor({
                            open: true,
                            tool,
                            slug: tool.slug,
                            name: tool.name,
                            description: tool.description,
                            category: tool.category,
                            icon: tool.icon,
                            roles: tool.roles,
                            prompt_template: tool.prompt,
                            output_format: tool.output_format,
                            is_enabled: tool.is_enabled,
                            fields: tool.fields,
                          })
                        }
                        title="Edit"
                        className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-dark-300 dark:hover:text-white"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      {!tool.is_builtin && (
                        <button
                          onClick={() => removeTool(tool)}
                          title="Delete"
                          className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editor.open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
          <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white sm:rounded-2xl dark:bg-dark-100">
            <div className="flex items-center justify-between border-b border-gray-200 p-4 sm:p-5 dark:border-dark-300">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                {editor.tool ? `Edit: ${editor.tool.name}` : 'Create custom tool'}
              </h3>
              <button
                onClick={() => setEditor(emptyEditor())}
                aria-label="Close"
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-dark-300 dark:hover:text-white"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-900 dark:text-white">Slug</label>
                  <input
                    value={editor.slug}
                    disabled={Boolean(editor.tool)}
                    onChange={(e) => setField('slug', e.target.value)}
                    placeholder="e.g. market_research"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-primary disabled:opacity-50 dark:border-dark-300 dark:bg-dark dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-900 dark:text-white">Name</label>
                  <input
                    value={editor.name}
                    onChange={(e) => setField('name', e.target.value)}
                    placeholder="e.g. Market Research"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-primary dark:border-dark-300 dark:bg-dark dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-900 dark:text-white">Description</label>
                <input
                  value={editor.description}
                  onChange={(e) => setField('description', e.target.value)}
                  placeholder="Short one-liner shown on the tool card"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-primary dark:border-dark-300 dark:bg-dark dark:text-white"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-900 dark:text-white">Category</label>
                  <input
                    value={editor.category}
                    onChange={(e) => setField('category', e.target.value)}
                    placeholder="e.g. Research"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-primary dark:border-dark-300 dark:bg-dark dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-900 dark:text-white">Icon</label>
                  <input
                    value={editor.icon}
                    onChange={(e) => setField('icon', e.target.value)}
                    placeholder="e.g. Search"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-primary dark:border-dark-300 dark:bg-dark dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-900 dark:text-white">Output format</label>
                  <select
                    value={editor.output_format}
                    onChange={(e) => setField('output_format', e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-primary dark:border-dark-300 dark:bg-dark dark:text-white"
                  >
                    <option value="markdown">markdown</option>
                    <option value="text">text</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-900 dark:text-white">Available to roles</label>
                <div className="flex flex-wrap gap-2">
                  {ALL_STUDIO_ROLES.concat('common').map((role) => (
                    <button
                      key={role}
                      onClick={() => setField('roles', toggleInList(editor.roles, role))}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                        editor.roles.includes(role)
                          ? 'bg-primary text-white'
                          : 'border border-gray-200 text-gray-500 hover:border-primary hover:text-primary dark:border-dark-300 dark:text-gray-400'
                      }`}
                    >
                      {role.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  'common' makes the tool available to every role.
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-900 dark:text-white">
                  Prompt template
                </label>
                <textarea
                  value={editor.prompt_template}
                  onChange={(e) => setField('prompt_template', e.target.value)}
                  rows={6}
                  placeholder="Use {field_key} placeholders, e.g. Research the market for: {market}"
                  className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-primary dark:border-dark-300 dark:bg-dark dark:text-white"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-900 dark:text-white">Input fields</label>
                  <button
                    onClick={() =>
                      setField('fields', [
                        ...editor.fields,
                        { key: '', label: '', type: 'text', required: false, placeholder: '', options: null },
                      ])
                    }
                    className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add field
                  </button>
                </div>
                {editor.fields.length === 0 && (
                  <p className="rounded-xl border border-dashed border-gray-200 p-4 text-center text-xs text-gray-400 dark:border-dark-300">
                    No input fields — the tool will run without a form.
                  </p>
                )}
                <div className="space-y-3">
                  {editor.fields.map((field, index) => (
                    <div key={index} className="grid gap-2 rounded-xl border border-gray-200 p-3 sm:grid-cols-12 dark:border-dark-300">
                      <input
                        value={field.key}
                        onChange={(e) => updateField(index, { key: e.target.value })}
                        placeholder="key"
                        className="col-span-3 rounded-lg border border-gray-200 bg-gray-50 p-2 text-xs outline-none dark:border-dark-300 dark:bg-dark dark:text-white sm:col-span-2"
                      />
                      <input
                        value={field.label}
                        onChange={(e) => updateField(index, { label: e.target.value })}
                        placeholder="Label"
                        className="col-span-4 rounded-lg border border-gray-200 bg-gray-50 p-2 text-xs outline-none dark:border-dark-300 dark:bg-dark dark:text-white"
                      />
                      <select
                        value={field.type}
                        onChange={(e) => updateField(index, { type: e.target.value })}
                        className="col-span-2 rounded-lg border border-gray-200 bg-gray-50 p-2 text-xs outline-none dark:border-dark-300 dark:bg-dark dark:text-white"
                      >
                        {FIELD_TYPES.map((ft) => (
                          <option key={ft} value={ft}>
                            {ft}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => updateField(index, { required: !field.required })}
                        className={`col-span-2 rounded-lg px-2 py-2 text-xs font-semibold ${
                          field.required ? 'bg-primary text-white' : 'border border-gray-200 text-gray-400 dark:border-dark-300'
                        }`}
                      >
                        {field.required ? 'Required' : 'Optional'}
                      </button>
                      <button
                        onClick={() => setEditor((e) => ({ ...e, fields: e.fields.filter((_, i) => i !== index) }))}
                        className="col-span-1 flex items-center justify-center rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-200 p-4 sm:p-5 dark:border-dark-300">
              <button
                onClick={() => setEditor(emptyEditor())}
                className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 dark:border-dark-300 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={saveEditor}
                className="flex items-center gap-2 rounded-xl bg-gradient-brand px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/20"
              >
                <Save className="h-4 w-4" /> Save Tool
              </button>
            </div>
          </div>
        </div>
      )}
      {dialog}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Users tab
// ---------------------------------------------------------------------------
function UsersTab() {
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState<AdminUsersResponse['users']>([])
  const [draft, setDraft] = useState<Record<string, string[]>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminListUsers(search)
      setUsers(res.users)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    load()
  }, [load])

  const saveRoles = async (userId: string) => {
    const roles = draft[userId] ?? []
    setSavingId(userId)
    try {
      await adminSetUserRoles(userId, roles)
      toast.success('Roles updated')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save roles')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setSearch(query)
            }}
            placeholder="Search by name or username, press Enter..."
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark-100 dark:text-white"
          />
        </div>
        <button
          onClick={() => setSearch(query)}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white"
        >
          <Search className="h-4 w-4" /> Search
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-dark-300 dark:bg-dark-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 dark:border-dark-300">
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Primary role</th>
              <th className="px-4 py-3">Roles</th>
              <th className="px-4 py-3 text-right">Save</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <EmptyRow colSpan={4} message="Loading users..." />
            ) : users.length === 0 ? (
              <EmptyRow colSpan={4} message="No users found" />
            ) : (
              users.map((user) => {
                const selected = draft[user.id] ?? user.extra_roles
                const changed =
                  JSON.stringify([...selected].sort()) !== JSON.stringify([...user.extra_roles].sort())
                return (
                  <tr key={user.id} className="border-b border-gray-100 last:border-0 dark:border-dark-300">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {user.full_name || user.username || 'Unnamed'}
                      </p>
                      <p className="text-xs text-gray-400">
                        {user.username ? `@${user.username}` : user.id.slice(0, 8)}
                        {user.is_admin && <span className="ml-1.5 text-primary">· admin</span>}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                        {user.role.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {ALL_STUDIO_ROLES.filter((r) => r !== user.role).map((role) => {
                          const active = selected.includes(role)
                          return (
                            <button
                              key={role}
                              onClick={() =>
                                setDraft((prev) => ({
                                  ...prev,
                                  [user.id]: toggleInList(prev[user.id] ?? user.extra_roles, role),
                                }))
                              }
                              className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors ${
                                active
                                  ? 'bg-primary text-white'
                                  : 'border border-gray-200 text-gray-400 hover:border-primary hover:text-primary dark:border-dark-300'
                              }`}
                            >
                              {role.replace(/_/g, ' ')}
                            </button>
                          )
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => saveRoles(user.id)}
                        disabled={!changed || savingId === user.id}
                        className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                      >
                        {savingId === user.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        Save
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Analytics tab
// ---------------------------------------------------------------------------
function AnalyticsTab() {
  const [data, setData] = useState<AnalyticsSummary | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await adminAnalytics())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }
  if (!data) return null

  const stats = [
    { label: 'Total runs', value: data.total_runs, icon: Activity },
    { label: 'Successful', value: data.successful_runs, icon: CheckCircle2, color: 'text-green-500' },
    { label: 'Failed', value: data.failed_runs, icon: XCircle, color: 'text-red-500' },
    { label: 'Last 24h', value: data.last_24h, icon: BarChart3 },
    { label: 'Last 7 days', value: data.last_7d, icon: RefreshCw },
    { label: 'Active users', value: data.active_users, icon: Users },
  ]

  const maxRuns = Math.max(1, ...data.top_tools.map((t) => t.runs))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-dark-300 dark:bg-dark-100">
            <stat.icon className={`h-5 w-5 ${stat.color ?? 'text-primary'}`} />
            <p className="mt-2 text-2xl font-extrabold text-gray-900 dark:text-white">{stat.value}</p>
            <p className="text-xs text-gray-400">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100">
          <h3 className="mb-4 text-sm font-bold text-gray-900 dark:text-white">Top tools</h3>
          {data.top_tools.length === 0 ? (
            <p className="text-sm text-gray-400">No tool usage yet.</p>
          ) : (
            <div className="space-y-3">
              {data.top_tools.map((t) => (
                <div key={t.tool}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-gray-700 dark:text-gray-300">{t.tool}</span>
                    <span className="text-gray-400">{t.runs} runs</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-dark-300">
                    <div
                      className="h-full rounded-full bg-gradient-brand"
                      style={{ width: `${(t.runs / maxRuns) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100">
            <h3 className="mb-4 text-sm font-bold text-gray-900 dark:text-white">Runs by category</h3>
            {data.runs_by_category.length === 0 ? (
              <p className="text-sm text-gray-400">No usage yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {data.runs_by_category.map((c) => (
                  <span key={c.category} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    {c.category} · {c.runs}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100">
            <h3 className="mb-4 text-sm font-bold text-gray-900 dark:text-white">Active users by primary role</h3>
            {data.runs_by_primary_role.length === 0 ? (
              <p className="text-sm text-gray-400">No usage yet.</p>
            ) : (
              <div className="space-y-3">
                {data.runs_by_primary_role.map((r) => (
                  <div key={r.role}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-gray-700 dark:text-gray-300">{r.role}</span>
                      <span className="text-gray-400">{r.users} users</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-dark-300">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.min(100, (r.users / data.active_users) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Usage tab
// ---------------------------------------------------------------------------
function UsageTab() {
  const [logs, setLogs] = useState<UsageLog[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminUsageLogs()
      setLogs(res.logs)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load usage logs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">Most recent AI tool usage across the platform.</p>
        <button
          onClick={load}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 dark:border-dark-300 dark:text-gray-300"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-dark-300 dark:bg-dark-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 dark:border-dark-300">
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Tool</th>
              <th className="hidden px-4 py-3 sm:table-cell">Provider</th>
              <th className="px-4 py-3">Status</th>
              <th className="hidden px-4 py-3 md:table-cell">When</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <EmptyRow colSpan={5} message="Loading usage logs..." />
            ) : logs.length === 0 ? (
              <EmptyRow colSpan={5} message="No usage yet." />
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="border-b border-gray-100 last:border-0 dark:border-dark-300">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{log.user_name}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{log.tool_slug}</td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 dark:bg-dark-300 dark:text-gray-400">
                      {log.provider ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        log.status === 'success'
                          ? 'bg-green-100 text-green-600 dark:bg-green-500/10 dark:text-green-400'
                          : 'bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400'
                      }`}
                    >
                      {log.status}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-gray-400 md:table-cell">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function AIStudioAdmin() {
  const { realProfile } = useSession()
  const [tab, setTab] = useState<'tools' | 'users' | 'analytics' | 'usage'>('tools')

  const isAdmin = Boolean(
    realProfile?.is_admin ||
      (realProfile?.role && ['administrator', 'admin'].includes(realProfile.role.toLowerCase())),
  )

  if (realProfile && !isAdmin) {
    return (
      <div className="mx-auto max-w-2xl py-8">
        <AdminAccessDenied />
      </div>
    )
  }

  const tabs = [
    { key: 'tools' as const, label: 'Tools', icon: Wrench },
    { key: 'users' as const, label: 'Users', icon: Users },
    { key: 'analytics' as const, label: 'Analytics', icon: BarChart3 },
    { key: 'usage' as const, label: 'Usage', icon: Activity },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-extrabold tracking-tight text-gray-900 dark:text-white">AI Studio Admin</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage the data-driven AI Studio: tools, role access, user roles and usage analytics.
        </p>
      </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === t.key
                  ? 'bg-gradient-brand text-white shadow-md shadow-primary/20'
                  : 'border border-gray-200 bg-white text-gray-600 hover:border-primary hover:text-primary dark:border-dark-300 dark:bg-dark-100 dark:text-gray-300'
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'tools' && <ToolsTab />}
        {tab === 'users' && <UsersTab />}
        {tab === 'analytics' && <AnalyticsTab />}
        {tab === 'usage' && <UsageTab />}
    </div>
  )
}
