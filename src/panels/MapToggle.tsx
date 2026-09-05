import type { ReactNode } from 'react'
import styles from './ReachToggle.module.css'

interface Props {
  on: boolean
  onToggle: () => void
  title: string
  children: ReactNode
}

/** A pill button in the map's corner that switches something on the map on or off. */
export function MapToggle({ on, onToggle, title, children }: Props) {
  return (
    <button type="button" className={styles.pill} aria-pressed={on} title={title} onClick={onToggle}>
      {children}
    </button>
  )
}
