import { useEffect, useState } from 'react'
import { getErrorMessage } from '../lib/errors'
import { Download, FileText, Loader2, Plus, Save, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { AppHeader } from '../components/AppHeader'
import { SkillsSelector } from '../components/SkillsSelector'
import { useSession } from '../context/AuthContext'
import { getResumes, saveResume, deleteResume } from '../lib/jobs'
import type { Resume } from '../types'

interface Experience {
  role: string
  company: string
  period: string
  details: string
}

interface Project {
  name: string
  link: string
  description: string
}

interface ResumeData {
  fullName: string
  title: string
  email: string
  phone: string
  location: string
  website: string
  summary: string
  skills: string[]
  experience: Experience[]
  projects: Project[]
}

const EMPTY: ResumeData = {
  fullName: '',
  title: '',
  email: '',
  phone: '',
  location: '',
  website: '',
  summary: '',
  skills: [],
  experience: [],
  projects: [],
}

function isResumeData(value: unknown): value is ResumeData {
  if (typeof value !== 'object' || value === null) return false
  return 'fullName' in (value as Record<string, unknown>)
}

const inputCls =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark'

function ExperienceEditor({
  items,
  onChange,
}: {
  items: Experience[]
  onChange: (items: Experience[]) => void
}) {
  const update = (i: number, patch: Partial<Experience>) =>
    onChange(items.map((item, idx) => (idx === i ? { ...item, ...patch } : item)))
  return (
    <div className="flex flex-col gap-4">
      {items.map((item, i) => (
        <div key={i} className="rounded-xl border border-gray-200 p-3 dark:border-dark-300">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input value={item.role} onChange={(e) => update(i, { role: e.target.value })} placeholder="Role" className={inputCls} />
            <input value={item.company} onChange={(e) => update(i, { company: e.target.value })} placeholder="Company" className={inputCls} />
          </div>
          <input value={item.period} onChange={(e) => update(i, { period: e.target.value })} placeholder="Period (e.g. 2023 - 2025)" className={`${inputCls} mt-2`} />
          <textarea value={item.details} onChange={(e) => update(i, { details: e.target.value })} placeholder="Key responsibilities / achievements" rows={2} className={`${inputCls} mt-2 resize-none`} />
          <button onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-red-500 hover:underline">
            <Trash2 className="h-3 w-3" /> Remove
          </button>
        </div>
      ))}
      <button onClick={() => onChange([...items, { role: '', company: '', period: '', details: '' }])} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
        <Plus className="h-4 w-4" /> Add experience
      </button>
    </div>
  )
}

function ProjectEditor({
  items,
  onChange,
}: {
  items: Project[]
  onChange: (items: Project[]) => void
}) {
  const update = (i: number, patch: Partial<Project>) =>
    onChange(items.map((item, idx) => (idx === i ? { ...item, ...patch } : item)))
  return (
    <div className="flex flex-col gap-4">
      {items.map((item, i) => (
        <div key={i} className="rounded-xl border border-gray-200 p-3 dark:border-dark-300">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input value={item.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="Project name" className={inputCls} />
            <input value={item.link} onChange={(e) => update(i, { link: e.target.value })} placeholder="Link (optional)" className={inputCls} />
          </div>
          <textarea value={item.description} onChange={(e) => update(i, { description: e.target.value })} placeholder="What did you build?" rows={2} className={`${inputCls} mt-2 resize-none`} />
          <button onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-red-500 hover:underline">
            <Trash2 className="h-3 w-3" /> Remove
          </button>
        </div>
      ))}
      <button onClick={() => onChange([...items, { name: '', link: '', description: '' }])} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
        <Plus className="h-4 w-4" /> Add project
      </button>
    </div>
  )
}

function ResumePreview({ data }: { data: ResumeData }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-8 text-gray-900 shadow-sm dark:border-dark-300">
      <div className="text-center">
        <h1 className="text-2xl font-extrabold tracking-tight">{data.fullName || 'Your Name'}</h1>
        <p className="mt-1 text-sm font-semibold text-primary">{data.title || 'Professional Title'}</p>
        <p className="mt-1 text-xs text-gray-500">
          {[data.email, data.phone, data.location, data.website].filter(Boolean).join('  ·  ')}
        </p>
      </div>

      {data.summary && (
        <section className="mt-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">Summary</h2>
          <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-gray-700">{data.summary}</p>
        </section>
      )}

      {data.skills.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">Skills</h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {data.skills.map((skill) => (
              <span key={skill} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                {skill}
              </span>
            ))}
          </div>
        </section>
      )}

      {data.experience.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">Experience</h2>
          <div className="mt-2 flex flex-col gap-3">
            {data.experience
              .filter((e) => e.role || e.company)
              .map((e, i) => (
                <div key={i}>
                  <div className="flex items-baseline justify-between">
                    <p className="text-sm font-bold">{e.role || 'Role'}</p>
                    <span className="text-xs text-gray-400">{e.period}</span>
                  </div>
                  <p className="text-xs font-semibold text-primary">{e.company}</p>
                  <p className="mt-1 whitespace-pre-line text-sm text-gray-600">{e.details}</p>
                </div>
              ))}
          </div>
        </section>
      )}

      {data.projects.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">Projects</h2>
          <div className="mt-2 flex flex-col gap-3">
            {data.projects
              .filter((p) => p.name)
              .map((p, i) => (
                <div key={i}>
                  <p className="text-sm font-bold">
                    {p.name}
                    {p.link && (
                      <span className="ml-1 font-normal text-primary">{p.link}</span>
                    )}
                  </p>
                  <p className="mt-0.5 text-sm text-gray-600">{p.description}</p>
                </div>
              ))}
          </div>
        </section>
      )}
    </div>
  )
}

function buildResumePdf(data: ResumeData): Promise<void> {
  return import('jspdf').then(({ default: jsPDF }) => {
    const PAGE_W = 210
    const PAGE_H = 297
    const MARGIN = 20
    const W = PAGE_W - MARGIN * 2
    const PURPLE: [number, number, number] = [124, 58, 237]
    const DARK: [number, number, number] = [31, 41, 55]
    const GRAY: [number, number, number] = [107, 114, 128]

    const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
    let y = MARGIN + 8

    const ensureSpace = (needed: number) => {
      if (y + needed > PAGE_H - MARGIN) {
        pdf.addPage()
        y = MARGIN
      }
    }

    const sectionTitle = (title: string) => {
      ensureSpace(14)
      y += 4
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(10)
      pdf.setTextColor(...PURPLE)
      pdf.text(title.toUpperCase(), MARGIN, y)
      pdf.setDrawColor(...PURPLE)
      pdf.setLineWidth(0.4)
      pdf.line(MARGIN, y + 1.4, PAGE_W - MARGIN, y + 1.4)
      y += 7
    }

    const body = (
      text: string,
      opts: { size?: number; color?: [number, number, number]; style?: 'normal' | 'bold' } = {},
    ) => {
      pdf.setFont('helvetica', opts.style ?? 'normal')
      pdf.setFontSize(opts.size ?? 9.5)
      pdf.setTextColor(...(opts.color ?? GRAY))
      const lines = pdf.splitTextToSize(text, W) as string[]
      for (const line of lines) {
        ensureSpace(6)
        pdf.text(line, MARGIN, y)
        y += 4.6
      }
    }

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(22)
    pdf.setTextColor(...DARK)
    pdf.text(data.fullName || 'Your Name', MARGIN, y)
    y += 8

    if (data.title) {
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.setTextColor(...PURPLE)
      pdf.text(data.title, MARGIN, y)
      y += 6
    }

    const contact = [data.email, data.phone, data.location, data.website]
      .filter(Boolean)
      .join('  |  ')
    if (contact) body(contact, { size: 9 })

    y += 2

    if (data.summary) {
      sectionTitle('Summary')
      body(data.summary, { color: DARK })
    }

    if (data.skills.length > 0) {
      sectionTitle('Skills')
      body(data.skills.join('  ·  '), { color: DARK })
    }

    const experience = data.experience.filter((e) => e.role || e.company)
    if (experience.length > 0) {
      sectionTitle('Experience')
      for (const e of experience) {
        ensureSpace(14)
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(10.5)
        pdf.setTextColor(...DARK)
        pdf.text(e.role || 'Role', MARGIN, y)
        if (e.period) {
          pdf.setFont('helvetica', 'normal')
          pdf.setFontSize(8.5)
          pdf.setTextColor(...GRAY)
          pdf.text(e.period, PAGE_W - MARGIN, y, { align: 'right' })
        }
        y += 5
        if (e.company) {
          pdf.setFont('helvetica', 'bold')
          pdf.setFontSize(9)
          pdf.setTextColor(...PURPLE)
          pdf.text(e.company, MARGIN, y)
          y += 5
        }
        if (e.details) body(e.details, { color: DARK })
        y += 2
      }
    }

    const projects = data.projects.filter((p) => p.name)
    if (projects.length > 0) {
      sectionTitle('Projects')
      for (const p of projects) {
        ensureSpace(14)
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(10.5)
        pdf.setTextColor(...DARK)
        pdf.text(p.name, MARGIN, y)
        y += 5
        if (p.link) {
          pdf.setFont('helvetica', 'normal')
          pdf.setFontSize(9)
          pdf.setTextColor(...PURPLE)
          pdf.text(p.link, MARGIN, y)
          y += 5
        }
        if (p.description) body(p.description, { color: DARK })
        y += 2
      }
    }

    pdf.save(`${(data.fullName || 'resume').replace(/\s+/g, '_')}.pdf`)
  })
}

export default function ResumeBuilder() {
  const { user, profile } = useSession()
  const [data, setData] = useState<ResumeData>(EMPTY)
  const [resumes, setResumes] = useState<Resume[]>([])
  const [selectedId, setSelectedId] = useState<string>('new')
  const [saving, setSaving] = useState(false)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    if (!user) return
    getResumes(user.id).then(setResumes).catch(() => {})
    if (profile) {
      setData((prev) => ({
        ...prev,
        fullName: prev.fullName || (profile.full_name ?? ''),
        title: prev.title || (profile.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : ''),
        email: prev.email || (user.email ?? ''),
        skills: prev.skills.length > 0 ? prev.skills : (profile.skills ?? []),
      }))
    }
  }, [user, profile])

  const loadResume = (id: string) => {
    setSelectedId(id)
    if (id === 'new') {
      setData({ ...EMPTY, fullName: profile?.full_name ?? '', email: user?.email ?? '', skills: profile?.skills ?? [] })
      return
    }
    const found = resumes.find((r) => r.id === id)
    if (found?.content && isResumeData(found.content)) setData(found.content)
  }

  const save = async () => {
    if (!user) return
    if (!data.fullName.trim()) {
      toast.error('Add your full name first')
      return
    }
    setSaving(true)
    try {
      const isNew = selectedId === 'new'
      const saved = await saveResume({
        userId: user.id,
        title: `${data.title || 'Untitled'} Resume`,
        content: data as unknown as Record<string, unknown>,
        isDefault: isNew && resumes.length === 0,
      })
      if (isNew) {
        setResumes((prev) => [...prev, saved])
        setSelectedId(saved.id)
      }
      toast.success('Resume saved')
    } catch (err) {
      toast.error(getErrorMessage(err, 'generic'))
    } finally {
      setSaving(false)
    }
  }

  const download = async () => {
    if (!data.fullName.trim()) {
      toast.error('Add your full name before downloading')
      return
    }
    setDownloading(true)
    try {
      await buildResumePdf(data)
      toast.success('PDF downloaded')
    } catch (err) {
      toast.error(getErrorMessage(err, 'generic'))
    } finally {
      setDownloading(false)
    }
  }

  const remove = async (id: string) => {
    try {
      await deleteResume(id)
      setResumes((prev) => prev.filter((r) => r.id !== id))
      setSelectedId('new')
      setData({ ...EMPTY, fullName: profile?.full_name ?? '', email: user?.email ?? '', skills: profile?.skills ?? [] })
      toast.success('Resume deleted')
    } catch (err) {
      toast.error(getErrorMessage(err, 'generic'))
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark">
      <AppHeader title="Resume Builder" backTo="/dashboard" />
      <main className="mx-auto max-w-6xl px-4 pt-6 pb-24 sm:px-6 lg:pb-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold">Resume Builder</h1>
            <p className="text-sm text-gray-500">Create a professional resume you can attach to job applications.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={selectedId} onChange={(e) => loadResume(e.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none dark:border-dark-300 dark:bg-dark">
              <option value="new">+ New resume</option>
              {resumes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
            <button onClick={save} disabled={saving} className="btn-ghost flex items-center gap-1.5 disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
            </button>
            <button onClick={download} disabled={downloading} className="btn-primary flex items-center gap-1.5 disabled:opacity-50">
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} PDF
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-5">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold">
                <FileText className="h-4 w-4 text-primary" /> Contact
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input value={data.fullName} onChange={(e) => setData({ ...data, fullName: e.target.value })} placeholder="Full name" className={inputCls} />
                <input value={data.title} onChange={(e) => setData({ ...data, title: e.target.value })} placeholder="Professional title" className={inputCls} />
                <input value={data.email} onChange={(e) => setData({ ...data, email: e.target.value })} placeholder="Email" className={inputCls} />
                <input value={data.phone} onChange={(e) => setData({ ...data, phone: e.target.value })} placeholder="Phone" className={inputCls} />
                <input value={data.location} onChange={(e) => setData({ ...data, location: e.target.value })} placeholder="Location" className={inputCls} />
                <input value={data.website} onChange={(e) => setData({ ...data, website: e.target.value })} placeholder="Website / GitHub" className={inputCls} />
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100">
              <h2 className="mb-3 text-sm font-bold">Summary</h2>
              <textarea
                value={data.summary}
                onChange={(e) => setData({ ...data, summary: e.target.value })}
                rows={4}
                placeholder="A short pitch about who you are and what you bring…"
                className={`${inputCls} resize-none`}
              />
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100">
              <h2 className="mb-3 text-sm font-bold">Skills</h2>
              <SkillsSelector selected={data.skills} onChange={(skills) => setData({ ...data, skills })} max={15} />
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100">
              <h2 className="mb-3 text-sm font-bold">Experience</h2>
              <ExperienceEditor items={data.experience} onChange={(experience) => setData({ ...data, experience })} />
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100">
              <h2 className="mb-3 text-sm font-bold">Projects</h2>
              <ProjectEditor items={data.projects} onChange={(projects) => setData({ ...data, projects })} />
            </div>
          </div>

          <div className="lg:sticky lg:top-24 lg:self-start">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Live preview</p>
            <ResumePreview data={data} />
          </div>
        </div>

        {selectedId !== 'new' && (
          <div className="mt-6 flex justify-end">
            <button onClick={() => remove(selectedId)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-500 hover:underline">
              <X className="h-4 w-4" /> Delete this resume
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
