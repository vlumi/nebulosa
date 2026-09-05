import type { OrbitFamily } from '../orbit/orbit'
import { familyCss } from '../shared/palette'
import { hhmm } from '../shared/format'
import type { Sheet } from '../store'
import panel from './panel.module.css'
import styles from './Toolbar.module.css'

interface Props {
  sheet: Sheet | null
  onToggle: (sheet: Sheet) => void
  satellites: { count: number; selected?: { name: string; family: OrbitFamily } }
  /** Absent until the elements have loaded. */
  passes?: { count: number; active?: { name: string; peakMs: number } }
}

/** One pill per list. Each shows what is chosen in it while its sheet is closed, and opens the sheet on tap. */
export function Toolbar({ sheet, onToggle, satellites, passes }: Props) {
  return (
    <div className={styles.toolbar} role="toolbar" aria-label="Lists">
      <button
        type="button"
        className={styles.pill}
        aria-pressed={sheet === 'satellites'}
        aria-controls="sheet"
        onClick={() => onToggle('satellites')}
      >
        Satellites{' '}
        {satellites.selected ? (
          <span className={styles.chosen}>
            <span className={panel.swatch} style={{ background: familyCss(satellites.selected.family) }} />
            {satellites.selected.name}
          </span>
        ) : (
          satellites.count > 0 && <span className="muted">· {satellites.count}</span>
        )}
      </button>
      {passes && (
        <button
          type="button"
          className={styles.pill}
          aria-pressed={sheet === 'passes'}
          aria-controls="sheet"
          onClick={() => onToggle('passes')}
        >
          Passes{' '}
          {passes.active ? (
            <span className={styles.chosen}>
              {passes.active.name} {hhmm(passes.active.peakMs)}
            </span>
          ) : (
            <span className="muted">· {passes.count}</span>
          )}
        </button>
      )}
    </div>
  )
}
