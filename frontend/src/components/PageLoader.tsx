export function PageLoader() {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 bg-white/90 backdrop-blur-xl dark:bg-dark/90">
      <div className="relative h-14 w-14">
        <div className="absolute inset-0 animate-spin rounded-2xl border-2 border-transparent border-t-fuchsia-500 border-r-violet-500 [animation-duration:1.1s]" />
        <div className="absolute inset-2.5 animate-spin rounded-full border-2 border-transparent border-b-cyan-400 [animation-direction:reverse] [animation-duration:0.8s]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-2 w-2 rounded-full bg-gradient-to-br from-fuchsia-500 to-cyan-400 shadow-lg shadow-fuchsia-500/40" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-fuchsia-500" />
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-500 [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400 [animation-delay:300ms]" />
      </div>
    </div>
  )
}
