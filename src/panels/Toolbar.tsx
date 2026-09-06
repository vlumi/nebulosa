import type { ReactNode, Ref } from 'react'
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
  places: { count: number; selected?: string }
  /** Absent until the elements have loaded. */
  passes?: { count: number; active?: { name: string; peakMs: number } }
  onClearSatellite: () => void
  onClearPlace: () => void
  onClearPass: () => void
  /** The app measures where the toolbar sits to keep the map centered above it. */
  ref?: Ref<HTMLDivElement>
}

/**
 * One pill per list. Each shows what is chosen in it while its sheet is closed and opens the sheet on tap; while
 * something is chosen, a × behind a divider on its right clears that choice without opening anything.
 */
export function Toolbar({
  sheet,
  onToggle,
  satellites,
  places,
  passes,
  onClearSatellite,
  onClearPlace,
  onClearPass,
  ref,
}: Props) {
  return (
    <div ref={ref} className={styles.toolbar} role="toolbar" aria-label="Lists">
      <Pill
        pressed={sheet === 'satellites'}
        onToggle={() => onToggle('satellites')}
        clear={satellites.selected && { label: `Unselect ${satellites.selected.name}`, onClear: onClearSatellite }}
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
      </Pill>
      <Pill
        pressed={sheet === 'places'}
        onToggle={() => onToggle('places')}
        clear={places.selected ? { label: `Unselect ${places.selected}`, onClear: onClearPlace } : undefined}
      >
        Places{' '}
        {places.selected ? (
          <span className={styles.chosen}>{places.selected}</span>
        ) : (
          <span className="muted">· {places.count > 0 ? 'none picked' : 'none'}</span>
        )}
      </Pill>
      {passes && (
        <Pill
          pressed={sheet === 'passes'}
          onToggle={() => onToggle('passes')}
          clear={passes.active && { label: `Clear the ${passes.active.name} pass`, onClear: onClearPass }}
        >
          Passes{' '}
          {passes.active ? (
            <span className={styles.chosen}>
              {passes.active.name} {hhmm(passes.active.peakMs)}
            </span>
          ) : (
            <span className="muted">· {passes.count}</span>
          )}
        </Pill>
      )}
    </div>
  )
}

function Pill({
  pressed,
  onToggle,
  clear,
  children,
}: {
  pressed: boolean
  onToggle: () => void
  clear?: { label: string; onClear: () => void }
  children: ReactNode
}) {
  return (
    <div className={styles.pill} data-pressed={pressed ? '' : undefined}>
      <button type="button" aria-pressed={pressed} aria-controls="sheet" onClick={onToggle}>
        {children}
      </button>
      {clear && (
        <button
          type="button"
          className={styles.clear}
          aria-label={clear.label}
          title={clear.label}
          onClick={clear.onClear}
        >
          ×
        </button>
      )}
    </div>
  )
}
