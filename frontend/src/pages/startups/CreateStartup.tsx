import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Rocket } from 'lucide-react'
import { AppHeader } from '../../components/AppHeader'
import { StartupForm } from '../../components/startups/StartupForm'
import { ConfettiSuccess } from '../../components/ConfettiSuccess'
import { notifyMatchedUsers } from '../../lib/startups'
import type { Startup } from '../../types'

export default function CreateStartup() {
  const navigate = useNavigate()
  const [published, setPublished] = useState<Startup | null>(null)

  const handleDone = async (startup: Startup, isPublished: boolean) => {
    if (isPublished) {
      setPublished(startup)
      // Trigger the matching pipeline (Day 11).
      await notifyMatchedUsers(startup.id)
    } else {
      toast.success('Draft saved! You can publish it from My Startups.')
      navigate('/dashboard/startups')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark">
      <AppHeader title="Create a Startup" backTo="/dashboard" />
      <main className="container-x pt-8 pb-24 lg:pb-8">
        <div className="mb-8">
          <h1 className="flex items-center gap-2 text-2xl font-extrabold sm:text-3xl">
            <Rocket className="h-7 w-7 text-primary" />
            Create a Startup
          </h1>
          <p className="mt-1 text-sm text-gray-500 sm:text-base">
            Post your startup and get matched with the right people.
          </p>
        </div>

        <StartupForm mode="create" onDone={handleDone} />
      </main>

      <ConfettiSuccess
        open={!!published}
        title="Startup published!"
        message={`${published?.name ?? 'Your startup'} is now live on FounderHub. Matching is running — the right people will find you.`}
        primaryAction={{ label: 'View Startup', to: published ? `/startups/${published.id}` : '/dashboard' }}
        secondaryAction={{ label: 'Go to My Startups', to: '/dashboard/startups' }}
      />
    </div>
  )
}
