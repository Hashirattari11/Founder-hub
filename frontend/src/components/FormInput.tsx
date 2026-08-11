import {
  useId,
  cloneElement,
  isValidElement,
  Children,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type ReactNode,
  type ReactElement,
} from 'react'

interface FieldProps {
  label: string
  error?: string
  children: ReactNode
}

const NATIVE_CONTROLS = ['input', 'select', 'textarea']

function isNativeControl(type: unknown): type is 'input' | 'select' | 'textarea' {
  return typeof type === 'string' && (NATIVE_CONTROLS as string[]).includes(type)
}

/**
 * Applies the generated id (+ error aria link) to a single field child.
 * Native divs/buttons (e.g. custom pickers) are left untouched so the label
 * never points at a non-form element ("Incorrect use of <label for=...>").
 */
function applyControlProps(el: ReactElement, id: string, error?: string): ReactElement {
  if (isNativeControl(el.type) === false && typeof el.type === 'string') {
    return el
  }
  return cloneElement(
    el as ReactElement<{ id?: string; 'aria-describedby'?: string }>,
    { id, ...(error ? { 'aria-describedby': `${id}-error` } : {}) },
  )
}

export function Field({ label, error, children }: FieldProps) {
  const id = useId()

  let labelable = false
  let content: ReactNode

  if (isValidElement(children)) {
    labelable = true
    content = applyControlProps(children, id, error)
  } else {
    // Multiple children (e.g. control + helper text): only the first element is
    // the form control — give it the id, leave the rest alone.
    const items = Children.toArray(children)
    content = items.map((child, index) => {
      if (index === 0 && isValidElement(child)) {
        const el = applyControlProps(child as ReactElement, id, error)
        if (child !== el) labelable = true
        return el
      }
      return child
    })
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={labelable ? id : undefined} className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>
      {content}
      {error && (
        <p id={`${id}-error`} className="text-xs text-red-500">
          {error}
        </p>
      )}
    </div>
  )
}

const inputClasses =
  'w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition-colors placeholder:text-gray-400 focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark'

export function TextInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${inputClasses} ${className ?? ''}`} {...props} />
}

export function SelectInput({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`${inputClasses} cursor-pointer ${className ?? ''}`}
      {...props}
    />
  )
}
