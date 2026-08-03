import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { getSavedStartups, saveStartup, unsaveStartup } from '../lib/startups'

export function useSavedStartups(userId: string | undefined) {
  const [savedIds, setSavedIds] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!userId) return
    let active = true
    setLoading(true)
    getSavedStartups(userId)
      .then((startups) => {
        if (!active) return
        const ids: Record<string, boolean> = {}
        for (const s of startups) ids[s.id] = true
        setSavedIds(ids)
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [userId])

  const toggleSave = useCallback(
    async (startupId: string) => {
      if (!userId) return
      const currentlySaved = !!savedIds[startupId]
      setSavedIds((prev) => ({ ...prev, [startupId]: !currentlySaved }))
      try {
        if (currentlySaved) {
          await unsaveStartup(userId, startupId)
        } else {
          await saveStartup(userId, startupId)
        }
      } catch {
        setSavedIds((prev) => ({ ...prev, [startupId]: currentlySaved }))
        toast.error('Could not update saved startups')
      }
    },
    [userId, savedIds],
  )

  return { savedIds, toggleSave, loading }
}
