import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

interface PlaceholderPageProps {
  title: string
  description: string
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-dark-300">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 max-w-md text-gray-500">{description}</p>
      <Link to="/dashboard" className="btn-ghost mt-6">
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>
    </div>
  )
}
