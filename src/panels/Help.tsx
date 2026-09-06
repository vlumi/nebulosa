import type { ReactNode } from 'react'
import { useStrings } from '../i18n/useStrings'
import { SHORTCUTS } from '../shortcuts'
import styles from './Help.module.css'

interface Props {
  open: boolean
  onToggle: (open: boolean) => void
  /** Other map toggles, shown in the row beside the ? button. */
  children?: ReactNode
}

/** The corner bottom-right: the keyboard legend as a floating panel behind a ? button. */
export function Help({ open, onToggle, children }: Props) {
  const s = useStrings()
  return (
    <div className={styles.help}>
      {open && (
        <dl className={styles.legend} role="region" aria-label={s.help.title}>
          {SHORTCUTS.map(({ keys, does }) => (
            <div key={keys}>
              <dt>
                <kbd>{keys}</kbd>
              </dt>
              <dd>{s.help[does]}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className={styles.buttons}>
        {children}
        <button
          type="button"
          className={styles.toggle}
          aria-label={s.help.title}
          aria-expanded={open}
          onClick={() => onToggle(!open)}
        >
          ?
        </button>
      </div>
    </div>
  )
}
