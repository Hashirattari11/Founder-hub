// Circular 0-100 score ring with traffic-light coloring.
export function scoreColor(score: number | null): string {
  if (score === null) return '#9CA3AF'
  if (score >= 70) return '#22C55E'
  if (score >= 40) return '#F59E0B'
  return '#EF4444'
}

export function ScoreRing({
  score,
  size = 132,
  stroke = 12,
  label,
}: {
  score: number | null
  size?: number
  stroke?: number
  label?: string
}) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const value = score ?? 0
  const color = scoreColor(value)
  const dash = (value / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            className="text-gray-200 dark:text-dark-300"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-extrabold" style={{ color }}>
            {score === null ? '--' : score}
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            / 100
          </span>
        </div>
      </div>
      {label ? <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">{label}</div> : null}
    </div>
  )
}

export function ScoreBar({ label, score, note }: { label: string; score: number; note?: string }) {
  const color = scoreColor(score)
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{label}</span>
        <span className="text-sm font-bold" style={{ color }}>
          {score}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-dark-300">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
      {note ? <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{note}</p> : null}
    </div>
  )
}
