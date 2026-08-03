import { Link } from 'react-router-dom'
import { Rocket } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-white px-6 text-center dark:bg-dark">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-brand text-white">
        <Rocket className="h-8 w-8" />
      </div>
      <div>
        <h1 className="text-6xl font-black tracking-tight text-gray-900 dark:text-white">404</h1>
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
          This page went to orbit and isn&apos;t coming back.
        </p>
      </div>
      <Link to="/" className="btn-primary">
        Back to Home
      </Link>
    </div>
  )
}
