import type { ReactNode } from 'react'
import styles from './Disclosure.module.css'

interface Props {
  summary: ReactNode
  open: boolean
  onToggle: (open: boolean) => void
  children: ReactNode
}

/** A collapsible section whose body can take part in the parent's layout, unlike a native <details>. */
export function Disclosure({ summary, open, onToggle, children }: Props) {
  return (
    <>
      <button type="button" className={styles.summary} aria-expanded={open} onClick={() => onToggle(!open)}>
        {summary}
      </button>
      {open && children}
    </>
  )
}
