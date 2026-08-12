import { Link } from 'react-router-dom'

interface ConsentAgreementFieldsProps {
  termsAccepted: boolean
  privacyAccepted: boolean
  onTermsChange: (checked: boolean) => void
  onPrivacyChange: (checked: boolean) => void
  errorMessage?: string
}

export function ConsentAgreementFields({
  termsAccepted,
  privacyAccepted,
  onTermsChange,
  onPrivacyChange,
  errorMessage,
}: ConsentAgreementFieldsProps) {
  return (
    <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4 dark:border-primary/30 dark:bg-primary/10">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">
        Required agreements
      </p>

      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={termsAccepted}
          onChange={(e) => onTermsChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-primary focus:ring-primary"
        />
        <span className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
          I agree to the{' '}
          <Link
            to="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-primary hover:underline"
          >
            Terms of Service
          </Link>
          <span className="text-red-500"> *</span>
        </span>
      </label>

      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={privacyAccepted}
          onChange={(e) => onPrivacyChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-primary focus:ring-primary"
        />
        <span className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
          I have read and agree to the{' '}
          <Link
            to="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-primary hover:underline"
          >
            Privacy Policy
          </Link>
          <span className="text-red-500"> *</span>
        </span>
      </label>

      {errorMessage && <p className="text-xs text-red-500">{errorMessage}</p>}

      {!termsAccepted || !privacyAccepted ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Please accept the Terms of Service and Privacy Policy to create your account.
        </p>
      ) : null}
    </div>
  )
}
