import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getErrorMessage } from '../../lib/errors'
import { useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  Building2,
  Download,
  Eye,
  EyeOff,
  FileSignature,
  FileText,
  FileUp,
  FolderLock,
  FolderOpen,
  Loader2,
  Lock,
  Presentation,
  Scale,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  TrendingUp,
  Users,
  X,
  LockOpen,
  UploadCloud,
  Activity,
  UserCheck,
  ExternalLink,
  FolderClosed,
} from 'lucide-react'
import { AppHeader } from '../../components/AppHeader'
import { Avatar } from '../../components/Avatar'
import { EmptyState } from '../../components/EmptyState'
import {
  createDataRoom,
  deleteDocument,
  getAccessList,
  getAccessRequests,
  getActivity,
  getDataRoom,
  getDocumentSignedUrl,
  grantAccess,
  isAllowedDataRoomFile,
  logDocumentAction,
  requestAccess,
  respondToRequest,
  revokeAccess,
  signNda,
  updateDataRoom,
  uploadDocument,
} from '../../lib/dataRoom'
import { useConfirm } from '../../components/ConfirmDialog'
import { formatDate, formatFileSize } from '../../lib/helpers'
import type {
  DataRoom,
  DataRoomAccess,
  DataRoomAccessRequest,
  DataRoomActivityItem,
  DataRoomCategory,
  DataRoomDocument,
  DataRoomResponse,
} from '../../types'
import type { LucideIcon } from 'lucide-react'

const CATEGORY_ICONS: Record<DataRoomCategory, LucideIcon> = {
  pitch_deck: Presentation,
  financials: TrendingUp,
  legal: Scale,
  cap_table: FolderClosed,
  product: FileText,
  team: Users,
  market_research: Search,
  contracts: FileSignature,
  other: FileText,
}

function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  wide = false,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className={`max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-gray-200 bg-white p-6 dark:border-dark-300 dark:bg-dark-100 sm:rounded-3xl ${
              wide ? 'max-w-2xl' : 'max-w-lg'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-extrabold">{title}</h2>
                {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default function DataRoomPage() {
  const { id } = useParams<{ id: string }>()
  const { confirm: confirmDialog, dialog: confirmDialogEl } = useConfirm()

  const [data, setData] = useState<DataRoomResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)
  const [requestOpen, setRequestOpen] = useState(false)

  const [previewDoc, setPreviewDoc] = useState<DataRoomDocument | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setLoadError(null)
    try {
      const res = await getDataRoom(id)
      setData(res)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load data room')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const canDownload = useMemo(() => {
    if (!data) return false
    if (data.can_manage) return true
    return (data.access?.access_level ?? 'view') !== 'view'
  }, [data])

  const handleCreate = async (roomData: { name: string; description: string }) => {
    if (!id) return
    await createDataRoom({ startup_id: id, name: roomData.name, description: roomData.description })
    toast.success('Data room created!')
    setCreateOpen(false)
    load()
  }

  const handleUpload = async (payload: {
    file: File
    name: string
    category: DataRoomCategory
    description: string
    is_confidential: boolean
  }) => {
    if (!data?.data_room) return
    await uploadDocument(data.data_room.id, payload)
    toast.success('Document uploaded!')
    setUploadOpen(false)
    load()
  }

  const handleDeleteDoc = async (doc: DataRoomDocument) => {
    const ok = await confirmDialog({
      title: `Delete "${doc.name}"?`,
      message: 'This will permanently delete the document. This cannot be undone.',
      confirmLabel: 'Delete',
    })
    if (!ok) return
    await deleteDocument(doc.id)
    toast.success('Document deleted')
    load()
  }

  const openDocument = async (doc: DataRoomDocument) => {
    if (!data?.data_room) return
    try {
      const url = await getDocumentSignedUrl(data.data_room.id, doc.id)
      setPreviewDoc(doc)
      setPreviewUrl(url)
      logDocumentAction(doc.id, 'viewed').catch(() => {})
    } catch (err) {
      toast.error(getErrorMessage(err, 'generic'))
    }
  }

  const downloadDocument = async (doc: DataRoomDocument) => {
    if (!data?.data_room) return
    if (!canDownload) {
      toast.error('Your access level does not allow downloads')
      return
    }
    try {
      const url = await getDocumentSignedUrl(data.data_room.id, doc.id)
      const a = document.createElement('a')
      a.href = url
      a.target = '_blank'
      a.rel = 'noreferrer'
      a.download = doc.name
      document.body.appendChild(a)
      a.click()
      a.remove()
      logDocumentAction(doc.id, 'downloaded').catch(() => {})
    } catch (err) {
      toast.error(getErrorMessage(err, 'generic'))
    }
  }

  const handleRequestAccess = async (message: string) => {
    if (!data?.data_room) return
    await requestAccess(data.data_room.id, message)
    toast.success('Access request sent!')
    setRequestOpen(false)
    load()
  }

  const handleSignNda = async () => {
    if (!data?.data_room) return
    await signNda(data.data_room.id)
    toast.success('NDA signed — access granted!')
    load()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark">
        <AppHeader title="Data Room" backTo={id ? `/startups/${id}` : '/dashboard'} backLabel="Back to Startup" />
        <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
          <div className="h-8 w-56 animate-pulse rounded-lg bg-gray-200 dark:bg-dark-200" />
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="h-40 animate-pulse rounded-2xl bg-gray-200 dark:bg-dark-200" />
            <div className="h-40 animate-pulse rounded-2xl bg-gray-200 dark:bg-dark-200" />
            <div className="h-40 animate-pulse rounded-2xl bg-gray-200 dark:bg-dark-200" />
          </div>
        </main>
      </div>
    )
  }

  if (loadError || !data) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark">
        <AppHeader title="Data Room" backTo={id ? `/startups/${id}` : '/dashboard'} backLabel="Back to Startup" />
        <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
          <EmptyState
            icon={FolderLock}
            title="Could not load data room"
            description={loadError ?? 'Something went wrong.'}
          />
        </main>
      </div>
    )
  }

  const room = data.data_room
  const isOwner = data.can_manage
  const hasAccess = !!data.access && !data.nda_pending && data.access.is_active

  return (
    <div className="min-h-screen bg-gray-50 pb-24 dark:bg-dark lg:pb-0">
      <AppHeader title={room?.name ?? 'Data Room'} backTo={`/startups/${id}`} backLabel="Back to Startup" />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              {isOwner ? <FolderOpen className="h-6 w-6" /> : hasAccess ? <LockOpen className="h-6 w-6" /> : <FolderLock className="h-6 w-6" />}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold">{room?.name ?? `${data.startup.name} Data Room`}</h1>
                {room?.require_nda && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                    <ShieldCheck className="h-3 w-3" /> NDA required
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500">{data.startup.name}</p>
            </div>
          </div>

          {isOwner && room ? (
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setUploadOpen(true)} className="btn-primary">
                <FileUp className="h-4 w-4" /> Add Document
              </button>
              <button onClick={() => setManageOpen(true)} className="btn-ghost">
                <UserCheck className="h-4 w-4" /> Manage Access
              </button>
              <button onClick={() => setActivityOpen(true)} className="btn-ghost">
                <Activity className="h-4 w-4" /> Activity
              </button>
              <button onClick={() => setSettingsOpen(true)} className="btn-ghost">
                <Settings className="h-4 w-4" /> Settings
              </button>
            </div>
          ) : (
            !isOwner && (
              <div className="flex gap-2">
                {data.request_status === 'pending' ? (
                  <button disabled className="btn-ghost opacity-60">
                    <Loader2 className="h-4 w-4 animate-spin" /> Access request pending
                  </button>
                ) : (
                  <button onClick={() => setRequestOpen(true)} className="btn-primary">
                    <LockOpen className="h-4 w-4" /> Request Access
                  </button>
                )}
              </div>
            )
          )}
        </div>

        {/* No data room yet — founder create screen */}
        {!room && isOwner && (
          <section className="mt-8 rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center dark:border-dark-400 dark:bg-dark-100">
            <FolderLock className="mx-auto h-12 w-12 text-primary" />
            <h2 className="mt-4 text-lg font-bold">Create a data room</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
              Securely share pitch decks, financials, legal documents and more with approved investors.
            </p>
            <button onClick={() => setCreateOpen(true)} className="btn-primary mt-6">
              <Building2 className="h-4 w-4" /> Create Data Room
            </button>
          </section>
        )}

        {/* NDA gate */}
        {room && data.nda_pending && (
          <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 dark:border-dark-300 dark:bg-dark-100">
            <NdaGate room={room} onSign={handleSignNda} />
          </section>
        )}

        {/* Locked / request view */}
        {room && !isOwner && !hasAccess && !data.nda_pending && (
          <section className="mt-8 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-dark-300 dark:bg-dark-100">
            <div className="p-6 text-center">
              <Lock className="mx-auto h-10 w-10 text-gray-400" />
              <h2 className="mt-3 text-lg font-bold">This data room is private</h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
                {data.request_status === 'rejected'
                  ? 'Your previous request was declined. You can try requesting access again.'
                  : 'Request access to review documents from this startup.'}
              </p>
              {data.request_status !== 'pending' && (
                <button onClick={() => setRequestOpen(true)} className="btn-primary mt-5">
                  <LockOpen className="h-4 w-4" /> Request Access
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-px bg-gray-100 dark:bg-dark-300 sm:grid-cols-3 lg:grid-cols-5">
              {Object.entries(CATEGORY_ICONS).map(([key, Icon]) => (
                <div key={key} className="flex flex-col items-center gap-2 bg-white p-6 blur-[2px] dark:bg-dark-100">
                  <Icon className="h-5 w-5 text-gray-400" />
                  <p className="text-xs text-gray-400">{key.split('_').join(' ')}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Documents */}
        {room && (isOwner || hasAccess) && (
          <DocumentBrowser
            documents={data.documents}
            isOwner={isOwner}
            canDownload={canDownload}
            onOpen={openDocument}
            onDownload={downloadDocument}
            onDelete={handleDeleteDoc}
          />
        )}
      </main>

      {/* Founder modals */}
      {isOwner && (
        <CreateRoomModal open={createOpen} onClose={() => setCreateOpen(false)} onSubmit={handleCreate} />
      )}
      {isOwner && room && (
        <>
          <UploadModal
            open={uploadOpen}
            onClose={() => setUploadOpen(false)}
            room={room}
            onSubmit={handleUpload}
          />
          <ManageAccessModal
            open={manageOpen}
            onClose={() => setManageOpen(false)}
            room={room}
            onChanged={load}
          />
          <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} room={room} onSaved={load} />
          <ActivityModal open={activityOpen} onClose={() => setActivityOpen(false)} room={room} />
        </>
      )}

      {/* Investor request modal */}
      {!isOwner && (
        <RequestAccessModal
          open={requestOpen}
          onClose={() => setRequestOpen(false)}
          onSubmit={handleRequestAccess}
        />
      )}

      {/* Document preview */}
      <Modal
        open={!!previewDoc}
        onClose={() => {
          setPreviewDoc(null)
          setPreviewUrl(null)
        }}
        title={previewDoc?.name ?? 'Document'}
        subtitle={previewDoc ? `${formatFileSize(previewDoc.file_size)} · ${formatDate(previewDoc.created_at)}` : undefined}
        wide
      >
        {previewUrl && previewDoc ? (
          <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-dark-300">
            {previewDoc.file_type === 'application/pdf' ? (
              <iframe src={previewUrl} title={previewDoc.name} className="h-[70vh] w-full" />
            ) : (
              <div className="flex flex-col items-center gap-4 p-8 text-center">
                <FileText className="h-14 w-14 text-primary" />
                <p className="text-sm text-gray-500">
                  This file type cannot be previewed inline.
                </p>
                <a href={previewUrl} target="_blank" rel="noreferrer" className="btn-primary">
                  <ExternalLink className="h-4 w-4" /> Open in new tab
                </a>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center p-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
      </Modal>
      {confirmDialogEl}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Document browser
// ---------------------------------------------------------------------------

function DocumentBrowser({
  documents,
  isOwner,
  canDownload,
  onOpen,
  onDownload,
  onDelete,
}: {
  documents: DataRoomDocument[]
  isOwner: boolean
  canDownload: boolean
  onOpen: (doc: DataRoomDocument) => void
  onDownload: (doc: DataRoomDocument) => void
  onDelete: (doc: DataRoomDocument) => void
}) {
  const grouped = useMemo(() => {
    const out: { category: DataRoomCategory; docs: DataRoomDocument[] }[] = []
    for (const key of Object.keys(CATEGORY_ICONS)) {
      const cat = key as DataRoomCategory
      const docs = documents.filter((d) => d.category === cat)
      if (docs.length > 0) out.push({ category: cat, docs })
    }
    return out
  }, [documents])

  if (documents.length === 0) {
    return (
      <section className="mt-8 rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center dark:border-dark-400 dark:bg-dark-100">
        <FileText className="mx-auto h-10 w-10 text-gray-400" />
        <h2 className="mt-3 text-base font-bold">No documents yet</h2>
        <p className="mt-1 text-sm text-gray-500">
          {isOwner ? 'Upload your first document to start sharing with investors.' : 'Documents will appear here once the founder uploads them.'}
        </p>
      </section>
    )
  }

  return (
    <div className="mt-8 flex flex-col gap-6">
      {grouped.map(({ category, docs }) => {
        const Icon = CATEGORY_ICONS[category]
        return (
          <section key={category} className="rounded-2xl border border-gray-200 bg-white dark:border-dark-300 dark:bg-dark-100">
            <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3.5 dark:border-dark-300">
              <Icon className="h-4.5 w-4.5 text-primary" />
              <h3 className="text-sm font-bold capitalize">{category.split('_').join(' ')}</h3>
              <span className="ml-auto rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-bold text-gray-500 dark:bg-dark-200">
                {docs.length}
              </span>
            </div>
            <ul className="divide-y divide-gray-100 dark:divide-dark-300">
              {docs.map((doc) => (
                <li key={doc.id} className="flex items-center gap-3 px-5 py-3.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FileText className="h-5 w-5" />
                  </span>
                  <button
                    onClick={() => onOpen(doc)}
                    className="min-w-0 flex-1 text-left"
                    title="Preview document"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold hover:text-primary">{doc.name}</p>
                      {doc.is_confidential && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                          <EyeOff className="h-3 w-3" /> Confidential
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {formatFileSize(doc.file_size)} · {formatDate(doc.created_at)} · {doc.description || 'No description'}
                    </p>
                    <p className="mt-0.5 flex items-center gap-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" /> {doc.views_count}
                      </span>
                      <span className="flex items-center gap-1">
                        <Download className="h-3 w-3" /> {doc.downloads_count}
                      </span>
                    </p>
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => onDownload(doc)}
                      disabled={!canDownload}
                      title={canDownload ? 'Download' : 'Downloads not allowed at your access level'}
                      className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-dark-200"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    {isOwner && (
                      <button
                        onClick={() => onDelete(doc)}
                        title="Delete document"
                        className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Create room
// ---------------------------------------------------------------------------

function CreateRoomModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (data: { name: string; description: string }) => void
}) {
  const [name, setName] = useState('Data Room')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      await onSubmit({ name: name.trim(), description: description.trim() })
    } catch (err) {
      toast.error(getErrorMessage(err, 'generic'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Create Data Room" subtitle="Set up a secure space to share documents">
      <div className="flex flex-col gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-semibold">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="e.g. Everything you need to evaluate our startup."
            className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark"
          />
        </div>
        <button onClick={submit} disabled={saving || !name.trim()} className="btn-primary w-full disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderOpen className="h-4 w-4" />} Create Data Room
        </button>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Upload document
// ---------------------------------------------------------------------------

function UploadModal({
  open,
  onClose,
  room,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  room: DataRoom
  onSubmit: (payload: {
    file: File
    name: string
    category: DataRoomCategory
    description: string
    is_confidential: boolean
  }) => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [name, setName] = useState('')
  const [category, setCategory] = useState<DataRoomCategory>('pitch_deck')
  const [description, setDescription] = useState('')
  const [confidential, setConfidential] = useState(true)
  const [saving, setSaving] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const pick = (f: File | undefined) => {
    if (!f) return
    const error = isAllowedDataRoomFile(f)
    if (error) {
      toast.error(error)
      return
    }
    setFile(f)
    if (!name) setName(f.name.replace(/\.[^.]+$/, ''))
  }

  const submit = async () => {
    if (!file) return
    setSaving(true)
    try {
      await onSubmit({ file, name: name.trim() || file.name, category, description: description.trim(), is_confidential: confidential })
    } catch (err) {
      toast.error(getErrorMessage(err, 'generic'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Upload Document" subtitle="PDF, DOCX, XLSX, PPTX, PNG, JPG — max 25MB">
      <div className="flex flex-col gap-4">
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            pick(e.dataTransfer.files?.[0])
          }}
          onClick={() => fileInput.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
            dragging ? 'border-primary bg-primary/5' : 'border-gray-300 dark:border-dark-400'
          }`}
        >
          <input
            ref={fileInput}
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg"
            onChange={(e) => pick(e.target.files?.[0])}
          />
          {file ? (
            <>
              <FileText className="h-10 w-10 text-primary" />
              <p className="text-sm font-bold">{file.name}</p>
              <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
            </>
          ) : (
            <>
              <UploadCloud className="h-10 w-10 text-gray-400" />
              <p className="text-sm font-semibold">Drag & drop a file, or click to browse</p>
              <p className="text-xs text-gray-500">PDF, DOCX, XLSX, PPTX, PNG, JPG — max 25MB</p>
            </>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold">Document name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as DataRoomCategory)}
            className="w-full cursor-pointer rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark"
          >
            {Object.entries({ pitch_deck: 'Pitch Deck', financials: 'Financials', legal: 'Legal Documents', cap_table: 'Cap Table', product: 'Product', team: 'Team', market_research: 'Market Research', contracts: 'Contracts', other: 'Other' }).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold">Description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark"
          />
        </div>

        <label className="flex cursor-pointer items-center justify-between rounded-xl border border-gray-200 px-4 py-3 dark:border-dark-300">
          <span className="text-sm font-semibold">Mark as confidential</span>
          <input
            type="checkbox"
            checked={confidential}
            onChange={(e) => setConfidential(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
        </label>

        <button onClick={submit} disabled={saving || !file} className="btn-primary w-full disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />} Upload to {room.name}
        </button>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Manage access
// ---------------------------------------------------------------------------

function ManageAccessModal({
  open,
  onClose,
  room,
  onChanged,
}: {
  open: boolean
  onClose: () => void
  room: DataRoom
  onChanged: () => void
}) {
  const { confirm, dialog } = useConfirm()
  const [requests, setRequests] = useState<DataRoomAccessRequest[]>([])
  const [accessList, setAccessList] = useState<
    (DataRoomAccess & { user?: { full_name: string | null; avatar_url: string | null; role: string | null } | null })[]
  >([])
  const [loading, setLoading] = useState(false)
  const [grantEmail, setGrantEmail] = useState('')
  const [grantLevel, setGrantLevel] = useState('view')

  const load = useCallback(async () => {
    if (!open) return
    setLoading(true)
    try {
      const [reqs, acc] = await Promise.all([getAccessRequests(room.id), getAccessList(room.id)])
      setRequests(reqs.filter((r) => r.status === 'pending'))
      setAccessList(acc)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [open, room.id])

  useEffect(() => {
    load()
  }, [load])

  const approve = async (req: DataRoomAccessRequest, level: string) => {
    await respondToRequest(req.id, { status: 'approved', access_level: level })
    toast.success('Access approved')
    load()
    onChanged()
  }

  const reject = async (req: DataRoomAccessRequest) => {
    await respondToRequest(req.id, { status: 'rejected' })
    toast.success('Request rejected')
    load()
  }

  const revoke = async (accessId: string) => {
    const ok = await confirm({
      title: 'Revoke access?',
      message: 'This will revoke this user’s access to the data room.',
      confirmLabel: 'Revoke',
    })
    if (!ok) return
    await revokeAccess(accessId)
    toast.success('Access revoked')
    load()
    onChanged()
  }

  const grantByEmail = async () => {
    if (!grantEmail.trim()) return
    const { supabase } = await import('../../lib/supabase')
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .ilike('email', grantEmail.trim())
      .maybeSingle()
    if (!data?.id) {
      toast.error('No user found with that email')
      return
    }
    await grantAccess(room.id, { user_id: data.id, access_level: grantLevel })
    toast.success('Access granted')
    setGrantEmail('')
    load()
    onChanged()
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title="Manage Access" subtitle={room.name} wide>
      <div className="flex flex-col gap-6">
        <div>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-400">Grant access</h3>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={grantEmail}
              onChange={(e) => setGrantEmail(e.target.value)}
              placeholder="User email"
              className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark"
            />
            <select
              value={grantLevel}
              onChange={(e) => setGrantLevel(e.target.value)}
              className="cursor-pointer rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-primary dark:border-dark-300 dark:bg-dark"
            >
              <option value="view">View</option>
              <option value="download">Download</option>
              <option value="full">Full</option>
            </select>
            <button onClick={grantByEmail} className="btn-primary">
              Grant
            </button>
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-400">
            Pending requests ({requests.length})
          </h3>
          {loading ? (
            <div className="flex items-center justify-center p-6">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : requests.length === 0 ? (
            <p className="text-sm text-gray-500">No pending requests.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {requests.map((req) => (
                <li key={req.id} className="rounded-xl border border-gray-200 p-4 dark:border-dark-300">
                  <div className="flex items-center gap-3">
                    <Avatar src={req.requester?.avatar_url} name={req.requester?.full_name} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold">{req.requester?.full_name ?? 'User'}</p>
                      <p className="text-xs capitalize text-gray-500">{req.requester?.role ?? ''}</p>
                      {req.message && <p className="mt-1 text-xs text-gray-500">“{req.message}”</p>}
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <select
                      id={`level-${req.id}`}
                      defaultValue="view"
                      className="cursor-pointer rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs outline-none dark:border-dark-300 dark:bg-dark"
                    >
                      <option value="view">View</option>
                      <option value="download">Download</option>
                      <option value="full">Full</option>
                    </select>
                    <button onClick={() => approve(req, (document.getElementById(`level-${req.id}`) as HTMLSelectElement | null)?.value ?? 'view')} className="btn-primary !px-3 !py-1.5 text-xs">
                      <UserCheck className="h-3.5 w-3.5" /> Approve
                    </button>
                    <button onClick={() => reject(req)} className="btn-ghost !px-3 !py-1.5 text-xs">
                      <X className="h-3.5 w-3.5" /> Reject
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-400">People with access</h3>
          {accessList.length === 0 ? (
            <p className="text-sm text-gray-500">No one has access yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {accessList.map((acc) => (
                <li key={acc.id} className="flex items-center gap-3 rounded-xl border border-gray-200 p-4 dark:border-dark-300">
                  <Avatar src={acc.user?.avatar_url} name={acc.user?.full_name} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold">{acc.user?.full_name ?? 'User'}</p>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold capitalize text-primary">
                        {acc.access_level}
                      </span>
                      {acc.nda_signed ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-bold text-green-600 dark:text-green-400">
                          <ShieldCheck className="h-3 w-3" /> NDA signed
                        </span>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500 dark:bg-dark-200">
                          NDA pending
                        </span>
                      )}
                    </div>
                    {acc.expires_at && <p className="mt-0.5 text-xs text-gray-500">Expires {formatDate(acc.expires_at)}</p>}
                  </div>
                  <button
                    onClick={() => revoke(acc.id)}
                    className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                    title="Revoke access"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      </Modal>
      {dialog}
    </>
  )
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

function SettingsModal({
  open,
  onClose,
  room,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  room: DataRoom
  onSaved: () => void
}) {
  const [name, setName] = useState(room.name)
  const [description, setDescription] = useState(room.description ?? '')
  const [requireNda, setRequireNda] = useState(room.require_nda)
  const [ndaText, setNdaText] = useState(room.nda_text ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setName(room.name)
    setDescription(room.description ?? '')
    setRequireNda(room.require_nda)
    setNdaText(room.nda_text ?? '')
  }, [room])

  const save = async () => {
    setSaving(true)
    try {
      await updateDataRoom(room.id, {
        name: name.trim(),
        description: description.trim() || null,
        require_nda: requireNda,
        nda_text: requireNda ? ndaText.trim() : null,
      })
      toast.success('Settings saved')
      onSaved()
      onClose()
    } catch (err) {
      toast.error(getErrorMessage(err, 'generic'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Data Room Settings" subtitle={room.name}>
      <div className="flex flex-col gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-semibold">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark"
          />
        </div>
        <label className="flex cursor-pointer items-center justify-between rounded-xl border border-gray-200 px-4 py-3 dark:border-dark-300">
          <div>
            <p className="text-sm font-semibold">Require NDA before access</p>
            <p className="text-xs text-gray-500">Investors must sign an NDA to view documents</p>
          </div>
          <input
            type="checkbox"
            checked={requireNda}
            onChange={(e) => setRequireNda(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
        </label>
        {requireNda && (
          <div>
            <label className="mb-1.5 block text-sm font-semibold">NDA text</label>
            <textarea
              value={ndaText}
              onChange={(e) => setNdaText(e.target.value)}
              rows={5}
              placeholder="Paste your NDA / confidentiality agreement text here..."
              className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark"
            />
          </div>
        )}
        <button onClick={save} disabled={saving} className="btn-primary w-full disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings className="h-4 w-4" />} Save Settings
        </button>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------

function ActivityModal({
  open,
  onClose,
  room,
}: {
  open: boolean
  onClose: () => void
  room: DataRoom
}) {
  const [items, setItems] = useState<DataRoomActivityItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    getActivity(room.id)
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open, room.id])

  return (
    <Modal open={open} onClose={onClose} title="Document Activity" subtitle="Who viewed or downloaded what" wide>
      {loading ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">No activity yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 dark:border-dark-300">
              <Avatar src={item.user?.avatar_url} name={item.user?.full_name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{item.user?.full_name ?? 'Someone'}</p>
                <p className="truncate text-xs text-gray-500">
                  <span className="font-semibold capitalize">{item.action}</span> {item.document?.name ?? 'a document'}
                </p>
              </div>
              <span className="shrink-0 text-xs text-gray-400">{formatDate(item.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Request access
// ---------------------------------------------------------------------------

function RequestAccessModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (message: string) => void
}) {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  const submit = async () => {
    setSending(true)
    try {
      await onSubmit(message.trim())
    } catch (err) {
      toast.error(getErrorMessage(err, 'generic'))
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Request Access" subtitle="Why do you want access to this data room?">
      <div className="flex flex-col gap-4">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          placeholder="e.g. I am an angel investor focused on AI/ML and would love to review your materials."
          className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark"
        />
        <button onClick={submit} disabled={sending} className="btn-primary w-full disabled:opacity-60">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockOpen className="h-4 w-4" />} Send Request
        </button>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// NDA gate
// ---------------------------------------------------------------------------

function NdaGate({ room, onSign }: { room: DataRoom; onSign: () => void }) {
  const [agreed, setAgreed] = useState(false)
  const [signing, setSigning] = useState(false)

  const sign = async () => {
    if (!agreed) return
    setSigning(true)
    try {
      await onSign()
    } catch (err) {
      toast.error(getErrorMessage(err, 'generic'))
    } finally {
      setSigning(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-amber-500" />
        <h2 className="text-base font-bold">Confidentiality agreement required</h2>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        The founder requires you to accept this agreement before you can view any documents.
      </p>
      <div className="mt-4 max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm leading-relaxed text-gray-600 dark:border-dark-300 dark:bg-dark dark:text-gray-400">
        {room.nda_text || 'You agree to keep all information shared in this data room strictly confidential and to use it solely to evaluate this startup for a potential investment.'}
      </div>
      <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="h-4 w-4 accent-primary"
        />
        I agree to the terms of this agreement
      </label>
      <button onClick={sign} disabled={!agreed || signing} className="btn-primary mt-4 w-full disabled:opacity-60">
        {signing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSignature className="h-4 w-4" />} Sign & View Documents
      </button>
    </div>
  )
}
