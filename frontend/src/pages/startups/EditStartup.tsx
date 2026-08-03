import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Pencil, Loader2, AlertTriangle } from 'lucide-react'
import { AppHeader } from '../../components/AppHeader'
import { StartupForm } from '../../components/startups/StartupForm'
import { getStartupById } from '../../lib/startups'
import { useSession } from '../../context/AuthContext'
import { notifyMatchedUsers } from '../../lib/startups'
import type { Startup } from '../../types'

export default function EditStartup() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useSession()
  const [startup, setStartup] = useState<Startup | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!id) return
    getStartupById(id)
      .then((data) => {
        if (!data) {
          setNotFound(true)
          return
        }
        if (data.founder_id !== user?.id) {
          toast.error("You don't own this startup")
          navigate('/dashboard/startups')
          return
        }
        setStartup(data)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id, user, navigate])

  const handleDone = async (updated: Startup, isPublished: boolean) => {
    if (isPublished) {
      // Re-run matching so newly-needed roles reach fresh people.
      await notifyMatchedUsers(updated.id)
      toast.success('Startup updated and published')
      navigate(`/startups/${updated.id}`)
    } else {
      toast.success('Changes saved as draft')
      navigate('/dashboard/startups')
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-dark">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (notFound || !startup) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 px-4 text-center dark:bg-dark">
        <AlertTriangle className="h-10 w-10 text-amber-500" />
        <h1 className="text-xl font-extrabold">Startup not found</h1>
        <p className="text-sm text-gray-500">This startup may have been deleted or you don't have access.</p>
        <Link to="/dashboard/startups" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">
          Back to My Startups
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark">
      <AppHeader title="Edit Startup" backTo="/dashboard/startups" />
      <main className="container-x py-8">
        <div className="mb-8">
          <h1 className="flex items-center gap-2 text-2xl font-extrabold sm:text-3xl">
            <Pencil className="h-7 w-7 text-primary" />
            Edit {startup.name}
          </h1>
          <p className="mt-1 text-sm text-gray-500 sm:text-base">
            Update your details. Publishing again re-runs AI matching.
          </p>
        </div>

        <StartupForm initial={startup} mode="edit" onDone={handleDone} />
      </main>
    </div>
  )
}
