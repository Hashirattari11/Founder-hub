import { Check, Plus } from 'lucide-react'
import { SKILLS } from '../types'

interface SkillsSelectorProps {
  selected: string[]
  onChange: (skills: string[]) => void
  max?: number
  pool?: readonly string[]
}

export function SkillsSelector({ selected, onChange, max = 8, pool = SKILLS }: SkillsSelectorProps) {
  const toggle = (skill: string) => {
    if (selected.includes(skill)) {
      onChange(selected.filter((s) => s !== skill))
    } else if (selected.length < max) {
      onChange([...selected, skill])
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {pool.map((skill) => {
          const active = selected.includes(skill)
          return (
            <button
              key={skill}
              type="button"
              onClick={() => toggle(skill)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
                active
                  ? 'border-primary bg-primary text-white shadow-md shadow-primary/30'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-primary hover:text-primary dark:border-dark-300 dark:bg-dark dark:text-gray-300'
              }`}
            >
              {active ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              {skill}
            </button>
          )
        })}
      </div>
      <p className="mt-3 text-xs text-gray-500">
        {selected.length}/{max} selected
      </p>
    </div>
  )
}
