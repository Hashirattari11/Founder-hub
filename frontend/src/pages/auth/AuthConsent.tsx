import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ShieldCheck } from 'lucide-react'
import { useSession } from '../../context/AuthContext'
import { AuthLayout } from '../../components/AuthLayout'
import { getErrorMessage } from '../../lib/errors'
import { recordUserConsent } from '../../lib/consent'
import { Seo } from '../../components/Seo'

export default function AuthConsent() {
  const { user } = useSession()
  const navigate = useNavigate()
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  if (!user) return null

  const canContinue = termsAccepted && privacyAccepted

  const onContinue = async () => {
    if (!canContinue) {
      toast.error('Please accept the Terms of Service and Privacy Policy to create your account.')
      return
    }
    setSubmitting(true)
    try {
      await recordUserConsent(user.id)
      toast.success('Thanks — let’s finish setting up your profile.')
      navigate('/complete-profile', { replace: true })
    } catch (error) {
      toast.error(getErrorMessage(error, 'generic'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Seo title="Accept Terms — FounderHub AI" description="Review and accept FounderHub Terms of Service and Privacy Policy." />
      <AuthLayout
        title="Before you continue"
        subtitle="New accounts must accept our Terms of Service and Privacy Policy."
      >
        <div className="mb-6 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="h-7 w-7" />
          </div>
        </div>

        <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-dark-300 dark:bg-dark">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <span className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
              I agree to the{' '}
              <Link to="/terms" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">
                Terms of Service
              </Link>
              <span className="text-red-500"> *</span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={privacyAccepted}
              onChange={(e) => setPrivacyAccepted(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <span className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
              I have read and agree to the{' '}
              <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">
                Privacy Policy
              </Link>
              <span className="text-red-500"> *</span>
            </span>
          </label>
        </div>

        <p className="mt-3 text-center text-xs text-gray-500 dark:text-gray-400">
          Both agreements are required to create your FounderHub account.
        </p>

        <button
          type="button"
          onClick={onContinue}
          disabled={!canContinue || submitting}
          className="btn-primary mt-6 w-full disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Saving...' : 'Continue'}
        </button>
      </AuthLayout>
    </>
  )
}
