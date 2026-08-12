import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface Props {
  children: ReactNode
  /** When true, "Try again" resets the boundary instead of reloading the page. */
  softReset?: boolean
  title?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info)
  }

  private handleRetry = () => {
    if (this.props.softReset) {
      this.setState({ hasError: false, error: null })
      return
    }
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div
        className={`flex flex-col items-center justify-center gap-4 bg-white px-6 text-center dark:bg-dark ${
          this.props.softReset ? 'h-full min-h-[280px] rounded-xl border border-gray-200 dark:border-dark-300' : 'min-h-screen'
        }`}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-2xl dark:bg-red-500/10">
          ⚠️
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">
            {this.props.title ?? 'Something went wrong'}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            An unexpected error occurred. Please try again.
          </p>
          {import.meta.env.DEV && this.state.error ? (
            <p className="mt-2 max-w-md break-words text-xs text-red-500">{this.state.error.message}</p>
          ) : null}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={this.handleRetry}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Try Again
          </button>
          <Link
            to="/"
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-dark-300 dark:text-gray-300 dark:hover:bg-dark-200"
          >
            Go Home
          </Link>
        </div>
      </div>
    )
  }
}
