import type { KeyboardEvent } from 'react'
import styles from './Segmented.module.css'

interface Props<T extends number> {
  label: string
  options: readonly T[]
  value: T
  onChange: (value: T) => void
  format?: (value: T) => string
}

const ARROW_DELTA: Record<string, 1 | -1> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }

/** A radio group drawn as one row of buttons: every choice visible, one click to change. */
export function Segmented<T extends number>({ label, options, value, onChange, format = String }: Props<T>) {
  const step = (event: KeyboardEvent<HTMLElement>) => {
    const delta = ARROW_DELTA[event.key]
    if (!delta) return
    event.preventDefault()
    const index = (options.indexOf(value) + delta + options.length) % options.length
    onChange(options[index])
    event.currentTarget.querySelectorAll('button')[index]?.focus()
  }

  return (
    <span role="radiogroup" aria-label={label} className={styles.group} onKeyDown={step}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={option === value}
          tabIndex={option === value ? 0 : -1}
          onClick={() => onChange(option)}
        >
          {format(option)}
        </button>
      ))}
    </span>
  )
}
