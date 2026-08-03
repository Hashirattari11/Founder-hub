import { Check, Plus } from 'lucide-react'

interface ChipSelectorProps {
  options: readonly string[]
  selected: string[]
  onChange: (selected: string[]) => void
  max?: number
  compact?: boolean
}

export function ChipSelector({
  options,
  selected,
  onChange,
  max,
  compact,
}: ChipSelectorProps) {
  const toggle = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter((s) => s !== option))
    } else if (!max || selected.length < max) {
      onChange([...selected, option])
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = selected.includes(option)
        return (
          <button
            key={option}
            type="button"
            onClick={() => toggle(option)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
              compact ? 'text-xs px-2.5 py-1' : ''
            } ${
              active
                ? 'border-primary bg-primary text-white shadow-md shadow-primary/30'
                : 'border-gray-200 bg-white text-gray-600 hover:border-primary hover:text-primary dark:border-dark-300 dark:bg-dark dark:text-gray-300'
            }`}
          >
            {active ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {option}
          </button>
        )
      })}
    </div>
  )
}
