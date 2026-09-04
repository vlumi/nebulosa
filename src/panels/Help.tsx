import { SHORTCUTS } from '../shortcuts'
import styles from './Help.module.css'

interface Props {
  open: boolean
  onToggle: (open: boolean) => void
}

/** The keyboard legend as a floating panel bottom-right, behind a ? button. */
export function Help({ open, onToggle }: Props) {
  return (
    <div className={styles.help}>
      {open && (
        <dl className={styles.legend} role="dialog" aria-label="Keyboard shortcuts">
          {SHORTCUTS.map(({ keys, does }) => (
            <div key={keys}>
              <dt>
                <kbd>{keys}</kbd>
              </dt>
              <dd>{does}</dd>
            </div>
          ))}
        </dl>
      )}
      <button
        type="button"
        className={styles.toggle}
        aria-label="Keyboard shortcuts"
        aria-expanded={open}
        onClick={() => onToggle(!open)}
      >
        ?
      </button>
    </div>
  )
}
