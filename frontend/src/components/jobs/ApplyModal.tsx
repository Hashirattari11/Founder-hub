import { useEffect, useRef, useState } from 'react'
import { getErrorMessage } from '../../lib/errors'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Loader2, Send, Sparkles, FileText, Upload, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useSession } from '../../context/AuthContext'
import { applyToJob, hasAppliedToJob, getResumes, uploadResumePdf, notifyJobApplication } from '../../lib/jobs'
import { AVAILABILITY_OPTIONS } from '../../lib/jobUi'
import type { Job, Resume } from '../../types'
import { API_URL } from '../../lib/config'

interface ApplyModalProps {
  job: Job
  open: boolean
  onClose: () => void
  onApplied: () => void
}

export function JobApplyModal({ job, open, onClose, onApplied }: ApplyModalProps) {
  const { user, profile, session } = useSession()
  const [coverLetter, setCoverLetter] = useState('')
  const [resumes, setResumes] = useState<Resume[]>([])
  const [selectedResume, setSelectedResume] = useState('')
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [portfolioUrl, setPortfolioUrl] = useState('')
  const [expectedSalary, setExpectedSalary] = useState('')
  const [availability, setAvailability] = useState('')
  const [generating, setGenerating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [alreadyApplied, setAlreadyApplied] = useState(false)
  const [checking, setChecking] = useState(true)
  const [showResumePicker, setShowResumePicker] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!open || !user) return
    setChecking(true)
    setAlreadyApplied(false)
    hasAppliedToJob(job.id, user.id)
      .then(setAlreadyApplied)
      .finally(() => setChecking(false))
    getResumes(user.id)
      .then((list) => {
        setResumes(list)
        const def = list.find((r) => r.is_default) ?? list[0]
        if (def) setSelectedResume(def.id)
      })
      .catch(() => {})
    return () => abortRef.current?.abort()
  }, [open, user, job.id])

  const generateCoverLetter = async () => {
    if (!profile) return
    setGenerating(true)
    setCoverLetter('')
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const res = await fetch(`${API_URL}/api/ai/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({
          feature: 'cover_letter',
          idea: null,
          context: {
            job_title: job.title,
            startup_name: job.startups?.name ?? 'the startup',
            name: profile.full_name ?? 'there',
            profile_role: profile.role ?? 'professional',
            skills: profile.skills ?? [],
          },
        }),
        signal: controller.signal,
      })
      if (!res.ok || !res.body) throw new Error('AI generation failed')
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
              setCoverLetter((prev) => prev + parsed)
            } else if (parsed.error) {
              streamError = parsed.error
              done = true
              break
            } else if (typeof parsed.text === 'string') {
              setCoverLetter((prev) => prev + parsed.text)
            }
          } catch {
            // ignore partial frames
          }
        }
      }
      if (streamError) throw new Error(streamError)
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        toast.error(getErrorMessage(err, 'generic'))
      }
    } finally {
      setGenerating(false)
      abortRef.current = null
    }
  }

  const submit = async () => {
    if (!user) return
    if (coverLetter.trim().length < 50) {
      toast.error('Cover letter must be at least 50 characters')
      return
    }
    setSubmitting(true)
    try {
      let resumeUrl: string | null = null
      const selected = resumes.find((r) => r.id === selectedResume)
      if (pdfFile) {
        resumeUrl = await uploadResumePdf(pdfFile, user.id)
      } else if (selected?.pdf_url) {
        resumeUrl = selected.pdf_url
      }
      await applyToJob({
        jobId: job.id,
        applicantId: user.id,
        coverLetter,
        resumeUrl,
        portfolioUrl: portfolioUrl.trim() || null,
        expectedSalary: expectedSalary ? Number(expectedSalary) : null,
        availability: availability || null,
      })
      notifyJobApplication(job.id, user.id)
      toast.success('Application submitted!')
      onApplied()
      onClose()
    } catch (err) {
      toast.error(getErrorMessage(err, 'generic'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl dark:bg-dark-100"
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-dark-300">
              <div>
                <h2 className="text-lg font-bold">Apply for {job.title}</h2>
                <p className="text-sm text-gray-500">{job.startups?.name ?? 'FounderHub'}</p>
              </div>
              <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-200" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>

            {checking ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Checking…
              </div>
            ) : alreadyApplied ? (
              <div className="flex flex-col items-center px-6 py-16 text-center">
                <CheckCircle2 className="h-12 w-12 text-green-500" />
                <h3 className="mt-4 text-lg font-bold">You have already applied</h3>
                <p className="mt-1 text-sm text-gray-500">Track this application from My Applications.</p>
                <button onClick={onClose} className="btn-primary mt-6">
                  Close
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-5 px-6 py-5">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-sm font-semibold">Cover letter</label>
                    <button
                      onClick={generateCoverLetter}
                      disabled={generating}
                      className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
                    >
                      {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                      {generating ? 'Generating…' : 'Generate with AI'}
                    </button>
                  </div>
                  <textarea
                    value={coverLetter}
                    onChange={(e) => setCoverLetter(e.target.value)}
                    rows={7}
                    placeholder="Write a short cover letter telling the founder why you're a great fit…"
                    className="w-full resize-none rounded-xl border border-gray-200 bg-white p-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark"
                  />
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-sm font-semibold">Resume</label>
                    <button
                      onClick={() => setShowResumePicker((v) => !v)}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      {showResumePicker ? 'Hide' : 'Choose'}
                    </button>
                  </div>
                  {showResumePicker ? (
                    <div className="flex flex-col gap-2 rounded-xl border border-gray-200 p-3 dark:border-dark-300">
                      {resumes.length > 0 && (
                        <div className="flex flex-col gap-2">
                          {resumes.map((resume) => (
                            <label key={resume.id} className="flex cursor-pointer items-center gap-2 text-sm">
                              <input
                                type="radio"
                                name="resume"
                                checked={selectedResume === resume.id}
                                onChange={() => {
                                  setSelectedResume(resume.id)
                                  setPdfFile(null)
                                }}
                                className="h-4 w-4 text-primary focus:ring-primary"
                              />
                              <FileText className="h-4 w-4 text-gray-400" />
                              <span className="text-gray-700 dark:text-gray-300">{resume.title}</span>
                              {resume.is_default && <span className="text-xs text-gray-400">(default)</span>}
                            </label>
                          ))}
                        </div>
                      )}
                      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-2.5 text-sm text-gray-500 hover:border-primary hover:text-primary dark:border-dark-400">
                        <Upload className="h-4 w-4" />
                        {pdfFile ? pdfFile.name : 'Upload a new PDF'}
                        <input
                          type="file"
                          accept="application/pdf,.pdf"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              setPdfFile(file)
                              setSelectedResume('')
                            }
                          }}
                        />
                      </label>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      {pdfFile ? (
                        <>
                          <FileText className="h-4 w-4 text-primary" />
                          <span>{pdfFile.name}</span>
                          <button onClick={() => setPdfFile(null)} className="text-xs text-red-500 hover:underline">
                            Remove
                          </button>
                        </>
                      ) : resumes.find((r) => r.id === selectedResume)?.pdf_url ? (
                        <>
                          <FileText className="h-4 w-4 text-primary" />
                          <span>{resumes.find((r) => r.id === selectedResume)?.title}</span>
                        </>
                      ) : (
                        <span>No resume attached</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <label className="text-sm font-semibold">Portfolio URL</label>
                    <input
                      type="url"
                      value={portfolioUrl}
                      onChange={(e) => setPortfolioUrl(e.target.value)}
                      placeholder="https://…"
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold">Expected salary ($/mo)</label>
                    <input
                      type="number"
                      min={0}
                      value={expectedSalary}
                      onChange={(e) => setExpectedSalary(e.target.value)}
                      placeholder="Optional"
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold">Availability</label>
                  <select
                    value={availability}
                    onChange={(e) => setAvailability(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark"
                  >
                    <option value="">Select availability…</option>
                    {AVAILABILITY_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <button onClick={submit} disabled={submitting} className="btn-primary flex items-center justify-center gap-2 disabled:opacity-50">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {submitting ? 'Submitting…' : 'Submit Application'}
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
