import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ShieldCheck } from 'lucide-react'
import { useSession } from '../../context/AuthContext'
import { AuthLayout } from '../../components/AuthLayout'
import { ConsentAgreementFields } from '../../components/auth/ConsentAgreementFields'
import { getErrorMessage } from '../../lib/errors'
import { hasUserConsent, recordUserConsent } from '../../lib/consent'
import { Seo } from '../../components/Seo'

export default function AuthConsent() {
  const { user, profile, signOut } = useSession()
  const navigate = useNavigate()
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (!user) return
    let active = true
    ;(async () => {
      try {
        const consented = await hasUserConsent(user.id)
        if (!active) return
        if (consented) {
          navigate(profile?.username ? '/dashboard' : '/complete-profile', { replace: true })
          return
        }
      } finally {
        if (active) setChecking(false)
      }
    })()
    return () => {
      active = false
    }
  }, [user, profile?.username, navigate])

  if (!user || checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-dark">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
      </div>
    )
  }

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
      <Seo title="Accept Terms — FounderHub" description="Review and accept FounderHub Terms of Service and Privacy Policy." />
      <AuthLayout
        title="Before you continue"
        subtitle="New accounts must accept our Terms of Service and Privacy Policy."
      >
        <div className="mb-6 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="h-7 w-7" />
          </div>
        </div>

        <ConsentAgreementFields
          termsAccepted={termsAccepted}
          privacyAccepted={privacyAccepted}
          onTermsChange={setTermsAccepted}
          onPrivacyChange={setPrivacyAccepted}
        />

        <button
          type="button"
          onClick={onContinue}
          disabled={!canContinue || submitting}
          className="btn-primary mt-6 w-full disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Saving...' : 'Continue'}
        </button>

        <button
          type="button"
          onClick={() => void signOut()}
          className="btn-ghost mt-3 w-full text-sm"
        >
          Sign out
        </button>
      </AuthLayout>
    </>
  )
}
