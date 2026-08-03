export function TypingIndicator({ name }: { name?: string | null }) {
  return (
    <div className="flex items-center gap-1.5 px-1 text-xs text-gray-500 dark:text-gray-400">
      <span className="flex items-center gap-1">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms]" />
      </span>
      {name ? `${name.split(' ')[0]} is typing…` : 'typing…'}
    </div>
  )
}
