import type { ReactNode } from 'react'

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
      <button type="button" className="summary" aria-expanded={open} onClick={() => onToggle(!open)}>
        {summary}
      </button>
      {open && children}
    </>
  )
}
