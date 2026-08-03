import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  message: string
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Only log in development — avoids noisy console output in production.
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught:', error, info)
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-6 text-center dark:bg-dark">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-2xl dark:bg-red-500/10">
          ⚠️
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">
            Something went wrong
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {this.state.message || 'An unexpected error occurred.'}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Reload page
          </button>
          <a
            href="/"
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-dark-300 dark:text-gray-300 dark:hover:bg-dark-200"
          >
            Go home
          </a>
        </div>
      </div>
    )
  }
}
