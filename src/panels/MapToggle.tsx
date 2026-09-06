import type { ReactNode } from 'react'
import styles from './MapToggle.module.css'

interface Props {
  /** Pressed state for an on/off toggle; leave out for a plain action. */
  on?: boolean
  onToggle: () => void
  /** The full name; also the tooltip. An icon-only toggle has no other text. */
  label: string
  children: ReactNode
}

/** A pill button in the title row that switches something on the map on or off. */
export function MapToggle({ on, onToggle, label, children }: Props) {
  return (
    <button type="button" className={styles.pill} aria-pressed={on} aria-label={label} title={label} onClick={onToggle}>
      {children}
    </button>
  )
}
