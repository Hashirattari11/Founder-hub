import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { FileText, Megaphone, Pencil, Plus, Save, Trash2, XCircle } from 'lucide-react'
import {
  adminAnnouncements,
  adminBlogPosts,
  adminCreateAnnouncement,
  adminCreateBlogPost,
  adminDeleteAnnouncement,
  adminDeleteBlogPost,
  adminPutSiteContent,
  adminSiteContent,
  adminUpdateAnnouncement,
  adminUpdateBlogPost,
} from '../../api/admin'
import type { Announcement, BlogPost, SiteContent } from '../../types/admin'
import { useConfirm } from '../../components/ConfirmDialog'
import { Badge, Card, EmptyRow, formatDate, LoadingBlock, PageHeader, TableHead, TableShell, statusTone } from './adminUi'

type Tab = 'content' | 'blog' | 'announcements'

interface ContentEditor {
  open: boolean
  item: SiteContent | null
  title: string
  content: string
  meta: string
}

interface BlogEditor {
  open: boolean
  post: BlogPost | null
  title: string
  slug: string
  excerpt: string
  content: string
  cover_url: string
  status: string
}

interface AnnouncementEditor {
  open: boolean
  announcement: Announcement | null
  title: string
  body: string
  audience: string
}

const emptyContentEditor: ContentEditor = { open: false, item: null, title: '', content: '', meta: '{}' }
const emptyBlogEditor: BlogEditor = { open: false, post: null, title: '', slug: '', excerpt: '', content: '', cover_url: '', status: 'draft' }
const emptyAnnouncementEditor: AnnouncementEditor = { open: false, announcement: null, title: '', body: '', audience: 'all' }

export default function AdminCms() {
  const [tab, setTab] = useState<Tab>('content')

  return (
    <div>
      <PageHeader
        title="CMS"
        description="Manage site content, blog posts and announcements."
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {(
          [
            { key: 'content', label: 'Site Content', icon: FileText },
            { key: 'blog', label: 'Blog', icon: FileText },
            { key: 'announcements', label: 'Announcements', icon: Megaphone },
          ] as { key: Tab; label: string; icon: typeof FileText }[]
        ).map((t) => (
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

      {tab === 'content' && <SiteContentTab />}
      {tab === 'blog' && <BlogTab />}
      {tab === 'announcements' && <AnnouncementsTab />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Site content
// ---------------------------------------------------------------------------

function SiteContentTab() {
  const [items, setItems] = useState<SiteContent[]>([])
  const [loading, setLoading] = useState(true)
  const [editor, setEditor] = useState<ContentEditor>(emptyContentEditor)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminSiteContent()
      setItems(res.content)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load site content')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openEditor = (item: SiteContent) =>
    setEditor({
      open: true,
      item,
      title: item.title ?? '',
      content: item.content ?? '',
      meta: item.meta ? JSON.stringify(item.meta, null, 2) : '{}',
    })

  const save = async () => {
    setSaving(true)
    try {
      let meta: Record<string, unknown> | undefined
      try {
        meta = editor.meta.trim() ? JSON.parse(editor.meta) : undefined
      } catch {
        toast.error('Meta must be valid JSON')
        return
      }
      await adminPutSiteContent(editor.item!.key, { title: editor.title, content: editor.content, ...(meta ? { meta } : {}) })
      toast.success('Saved')
      setEditor(emptyContentEditor)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {loading ? (
        <LoadingBlock label="Loading site content..." />
      ) : (
        <TableShell>
          <TableHead cells={['Key', 'Title', 'Updated', 'Actions']} />
          <tbody>
            {items.length === 0 ? (
              <EmptyRow colSpan={4} message="No site content" />
            ) : (
              items.map((item) => (
                <tr key={item.key} className="border-b border-gray-100 last:border-0 dark:border-dark-300">
                  <td className="px-4 py-3">
                    <span className="rounded-lg bg-primary/10 px-2.5 py-1 font-mono text-xs font-semibold text-primary">
                      {item.key}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-900 dark:text-white">{item.title || 'Untitled'}</p>
                    {item.content && <p className="max-w-md truncate text-xs text-gray-400">{item.content}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{formatDate(item.updated_at)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openEditor(item)}
                      className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </TableShell>
      )}

      {editor.open && editor.item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-200 p-4 sm:p-5 dark:border-dark-300">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Edit: {editor.item.key}</h3>
              <button onClick={() => setEditor(emptyContentEditor)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-300">
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-900 dark:text-white">Title</label>
                <input
                  value={editor.title}
                  onChange={(e) => setEditor((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-primary dark:border-dark-300 dark:bg-dark dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-900 dark:text-white">Content</label>
                <textarea
                  value={editor.content}
                  onChange={(e) => setEditor((prev) => ({ ...prev, content: e.target.value }))}
                  rows={8}
                  className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-primary dark:border-dark-300 dark:bg-dark dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-900 dark:text-white">Meta (JSON)</label>
                <textarea
                  value={editor.meta}
                  onChange={(e) => setEditor((prev) => ({ ...prev, meta: e.target.value }))}
                  rows={5}
                  className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 p-3 font-mono text-xs outline-none focus:border-primary dark:border-dark-300 dark:bg-dark dark:text-white"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-200 p-4 sm:p-5 dark:border-dark-300">
              <button
                onClick={() => setEditor(emptyContentEditor)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 dark:border-dark-300 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-gradient-brand px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                <Save className="h-4 w-4" /> Save
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Blog
// ---------------------------------------------------------------------------

function BlogTab() {
  const { confirm, dialog } = useConfirm()
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const [editor, setEditor] = useState<BlogEditor>(emptyBlogEditor)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminBlogPosts()
      setPosts(res.posts)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load blog posts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openEditor = (post: BlogPost | null) =>
    setEditor(
      post
        ? { open: true, post, title: post.title, slug: post.slug, excerpt: post.excerpt ?? '', content: post.content ?? '', cover_url: post.cover_url ?? '', status: post.status }
        : { ...emptyBlogEditor, open: true },
    )

  const save = async () => {
    if (!editor.title.trim() || !editor.slug.trim()) {
      toast.error('Title and slug are required')
      return
    }
    setSaving(true)
    try {
      const payload: Partial<BlogPost> = {
        title: editor.title,
        slug: editor.slug,
        excerpt: editor.excerpt || null,
        content: editor.content || null,
        cover_url: editor.cover_url || null,
        status: editor.status as BlogPost['status'],
      }
      if (editor.post) {
        await adminUpdateBlogPost(editor.post.id, payload)
      } else {
        await adminCreateBlogPost(payload)
      }
      toast.success(editor.post ? 'Post updated' : 'Post created')
      setEditor(emptyBlogEditor)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (post: BlogPost) => {
    const ok = await confirm({
      title: `Delete "${post.title}"?`,
      message: 'This will permanently delete this blog post.',
      confirmLabel: 'Delete',
    })
    if (!ok) return
    try {
      await adminDeleteBlogPost(post.id)
      setPosts((prev) => prev.filter((p) => p.id !== post.id))
      toast.success('Post deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  const togglePublish = async (post: BlogPost) => {
    try {
      const next = post.status === 'published' ? 'draft' : 'published'
      await adminUpdateBlogPost(post.id, { status: next })
      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, status: next as BlogPost['status'] } : p)))
      toast.success(next === 'published' ? 'Published' : 'Unpublished')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed')
    }
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => openEditor(null)}
          className="flex items-center gap-2 rounded-xl bg-gradient-brand px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/20"
        >
          <Plus className="h-4 w-4" /> New post
        </button>
      </div>

      {loading ? (
        <LoadingBlock label="Loading posts..." />
      ) : (
        <TableShell>
          <TableHead cells={['Title', 'Slug', 'Status', 'Published', 'Actions']} />
          <tbody>
            {posts.length === 0 ? (
              <EmptyRow colSpan={5} message="No blog posts" />
            ) : (
              posts.map((post) => (
                <tr key={post.id} className="border-b border-gray-100 last:border-0 dark:border-dark-300">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-900 dark:text-white">{post.title}</p>
                    {post.excerpt && <p className="max-w-md truncate text-xs text-gray-400">{post.excerpt}</p>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-300">{post.slug}</td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone(post.status)}>{post.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{formatDate(post.published_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => togglePublish(post)}
                        className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:border-primary hover:text-primary dark:border-dark-300 dark:text-gray-300"
                      >
                        {post.status === 'published' ? 'Unpublish' : 'Publish'}
                      </button>
                      <button
                        onClick={() => openEditor(post)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-primary/10 hover:text-primary"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => remove(post)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </TableShell>
      )}

      {editor.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-200 p-4 sm:p-5 dark:border-dark-300">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                {editor.post ? 'Edit post' : 'New post'}
              </h3>
              <button onClick={() => setEditor(emptyBlogEditor)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-300">
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-900 dark:text-white">Title</label>
                  <input
                    value={editor.title}
                    onChange={(e) => setEditor((prev) => ({ ...prev, title: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-primary dark:border-dark-300 dark:bg-dark dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-900 dark:text-white">Slug</label>
                  <input
                    value={editor.slug}
                    onChange={(e) => setEditor((prev) => ({ ...prev, slug: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-primary dark:border-dark-300 dark:bg-dark dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-900 dark:text-white">Excerpt</label>
                <input
                  value={editor.excerpt}
                  onChange={(e) => setEditor((prev) => ({ ...prev, excerpt: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-primary dark:border-dark-300 dark:bg-dark dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-900 dark:text-white">Cover URL</label>
                <input
                  value={editor.cover_url}
                  onChange={(e) => setEditor((prev) => ({ ...prev, cover_url: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-primary dark:border-dark-300 dark:bg-dark dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-900 dark:text-white">Content</label>
                <textarea
                  value={editor.content}
                  onChange={(e) => setEditor((prev) => ({ ...prev, content: e.target.value }))}
                  rows={10}
                  className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-primary dark:border-dark-300 dark:bg-dark dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-900 dark:text-white">Status</label>
                <select
                  value={editor.status}
                  onChange={(e) => setEditor((prev) => ({ ...prev, status: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-primary dark:border-dark-300 dark:bg-dark dark:text-white"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-200 p-4 sm:p-5 dark:border-dark-300">
              <button
                onClick={() => setEditor(emptyBlogEditor)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 dark:border-dark-300 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-gradient-brand px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                <Save className="h-4 w-4" /> Save
              </button>
            </div>
          </Card>
        </div>
      )}
      {dialog}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------------------

function AnnouncementsTab() {
  const { confirm, dialog } = useConfirm()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [editor, setEditor] = useState<AnnouncementEditor>(emptyAnnouncementEditor)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminAnnouncements()
      setAnnouncements(res.announcements)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load announcements')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openEditor = (announcement: Announcement | null) =>
    setEditor(
      announcement
        ? { open: true, announcement, title: announcement.title, body: announcement.body ?? '', audience: announcement.audience }
        : { ...emptyAnnouncementEditor, open: true },
    )

  const save = async () => {
    if (!editor.title.trim()) {
      toast.error('Title is required')
      return
    }
    setSaving(true)
    try {
      const payload = { title: editor.title, body: editor.body || null, audience: editor.audience }
      if (editor.announcement) {
        await adminUpdateAnnouncement(editor.announcement.id, payload)
      } else {
        await adminCreateAnnouncement(payload)
      }
      toast.success(editor.announcement ? 'Announcement updated' : 'Announcement created')
      setEditor(emptyAnnouncementEditor)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (announcement: Announcement) => {
    try {
      await adminUpdateAnnouncement(announcement.id, { is_active: !announcement.is_active })
      setAnnouncements((prev) => prev.map((a) => (a.id === announcement.id ? { ...a, is_active: !announcement.is_active } : a)))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed')
    }
  }

  const remove = async (announcement: Announcement) => {
    const ok = await confirm({
      title: `Delete "${announcement.title}"?`,
      message: 'This will permanently delete this announcement.',
      confirmLabel: 'Delete',
    })
    if (!ok) return
    try {
      await adminDeleteAnnouncement(announcement.id)
      setAnnouncements((prev) => prev.filter((a) => a.id !== announcement.id))
      toast.success('Announcement deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => openEditor(null)}
          className="flex items-center gap-2 rounded-xl bg-gradient-brand px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/20"
        >
          <Plus className="h-4 w-4" /> New announcement
        </button>
      </div>

      {loading ? (
        <LoadingBlock label="Loading announcements..." />
      ) : (
        <TableShell>
          <TableHead cells={['Title', 'Audience', 'Status', 'Created', 'Actions']} />
          <tbody>
            {announcements.length === 0 ? (
              <EmptyRow colSpan={5} message="No announcements" />
            ) : (
              announcements.map((a) => (
                <tr key={a.id} className="border-b border-gray-100 last:border-0 dark:border-dark-300">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-900 dark:text-white">{a.title}</p>
                    {a.body && <p className="max-w-md truncate text-xs text-gray-400">{a.body}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone="blue">{a.audience}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={a.is_active ? 'green' : 'gray'}>{a.is_active ? 'Active' : 'Inactive'}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{formatDate(a.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleActive(a)}
                        className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:border-primary hover:text-primary dark:border-dark-300 dark:text-gray-300"
                      >
                        {a.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => openEditor(a)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-primary/10 hover:text-primary"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => remove(a)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </TableShell>
      )}

      {editor.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-lg p-5">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              {editor.announcement ? 'Edit announcement' : 'New announcement'}
            </h3>
            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-900 dark:text-white">Title</label>
                <input
                  value={editor.title}
                  onChange={(e) => setEditor((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-primary dark:border-dark-300 dark:bg-dark dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-900 dark:text-white">Body</label>
                <textarea
                  value={editor.body}
                  onChange={(e) => setEditor((prev) => ({ ...prev, body: e.target.value }))}
                  rows={4}
                  className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-primary dark:border-dark-300 dark:bg-dark dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-900 dark:text-white">Audience</label>
                <select
                  value={editor.audience}
                  onChange={(e) => setEditor((prev) => ({ ...prev, audience: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-primary dark:border-dark-300 dark:bg-dark dark:text-white"
                >
                  <option value="all">All users</option>
                  <option value="founders">Founders</option>
                  <option value="investors">Investors</option>
                </select>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setEditor(emptyAnnouncementEditor)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 dark:border-dark-300 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-gradient-brand px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                <Save className="h-4 w-4" /> Save
              </button>
            </div>
          </Card>
        </div>
      )}
      {dialog}
    </div>
  )
}
