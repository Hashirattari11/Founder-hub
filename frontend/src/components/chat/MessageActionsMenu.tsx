import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

export interface MenuAction {
  label: string
  icon: ReactNode
  onClick: () => void
  danger?: boolean
}

interface MessageActionsMenuProps {
  x: number
  y: number
  actions: MenuAction[]
  onClose: () => void
}

export function MessageActionsMenu({ x, y, actions, onClose }: MessageActionsMenuProps) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const width = 220
  const itemHeight = 40
  const left = Math.max(8, Math.min(x, window.innerWidth - width - 8))
  const top = Math.max(8, Math.min(y, window.innerHeight - actions.length * itemHeight - 16))

  return (
    <div
      ref={ref}
      style={{ left, top, width }}
      className="fixed z-50 rounded-xl border border-gray-200 bg-white p-1.5 shadow-2xl dark:border-dark-300 dark:bg-dark-200"
    >
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          onClick={() => {
            action.onClick()
            onClose()
          }}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
            action.danger
              ? 'text-red-500 hover:bg-red-500/10'
              : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-dark-300'
          }`}
        >
          {action.icon}
          {action.label}
        </button>
      ))}
    </div>
  )
}
