import { useCallback, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, X } from 'lucide-react'

export interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

interface ConfirmDialogProps extends ConfirmOptions {
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  danger = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-dark-300 dark:bg-dark-100"
          role="dialog"
          aria-modal="true"
        >
          <button
            onClick={onCancel}
            aria-label="Close dialog"
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-dark-200 dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-start gap-4">
            <span
              className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${
                danger
                  ? 'bg-red-500/15 text-red-500'
                  : 'bg-primary/15 text-primary'
              }`}
            >
              <AlertTriangle className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <h3 className="text-lg font-bold leading-snug">{title}</h3>
              {message && (
                <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400">{message}</p>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              onClick={onCancel}
              className="inline-flex items-center justify-center rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100 dark:border-dark-300 dark:text-gray-300 dark:hover:bg-dark-200"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              autoFocus
              className={`inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors ${
                danger
                  ? 'bg-red-500 shadow-red-500/25 hover:bg-red-600'
                  : 'bg-primary shadow-primary/25 hover:bg-primary-dark'
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

/**
 * Promise-based confirm dialog. Returns `[confirm, dialog]`:
 * - `confirm(options)` opens the dialog and resolves `true`/`false`.
 * - `dialog` must be rendered once in the component's JSX.
 *
 *   const { confirm, dialog } = useConfirm()
 *   if (!(await confirm({ title: 'Delete?', message: '...' }))) return
 *   ...
 *   return <>...{dialog}</>
 */
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const [resolveFn, setResolveFn] = useState<((value: boolean) => void) | null>(null)

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setResolveFn(() => resolve)
      setOptions(opts)
    })
  }, [])

  const handleClose = useCallback(
    (result: boolean) => {
      setOptions(null)
      resolveFn?.(result)
      setResolveFn(null)
    },
    [resolveFn],
  )

  const dialog = options ? (
    <ConfirmDialog {...options} onConfirm={() => handleClose(true)} onCancel={() => handleClose(false)} />
  ) : null

  return { confirm, dialog }
}
