import { User } from 'lucide-react'

interface AvatarProps {
  src?: string | null
  name?: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizes = {
  sm: 'h-9 w-9 text-xs',
  md: 'h-12 w-12 text-sm',
  lg: 'h-20 w-20 text-2xl',
  xl: 'h-32 w-32 text-4xl',
}

export function Avatar({ src, name, size = 'md', className }: AvatarProps) {
  const initials = (name ?? 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  const base = `flex items-center justify-center rounded-full font-bold text-white ${sizes[size]} ${className ?? ''}`

  if (src) {
    return (
      <img src={src} alt={name ?? 'avatar'} className={`${base} object-cover`} />
    )
  }

  return (
    <div className={`${base} bg-gradient-brand`}>
      {initials || <User className="h-1/2 w-1/2" />}
    </div>
  )
}
