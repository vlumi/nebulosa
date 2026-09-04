import { familyCss } from '../shared/palette'
import panel from './panel.module.css'
import styles from './PassList.module.css'
import type { OrbitFamily } from '../orbit/orbit'
import { compassPoint, dayLabel, formatLocation, hhmm, utcDayIndex } from '../shared/format'
import { HORIZONS_H, MIN_ELEVATIONS, type Location, type Pass, type PassFilters } from '../orbit/passes'

interface Props {
  location: Location
  passes: Pass[]
  filters: PassFilters
  onFiltersChange: (filters: PassFilters) => void
  /** Name of the selected satellite when the list can be narrowed to it. */
  selectedName?: string
  familyOf: (noradId: number) => OrbitFamily
  onShow: (pass: Pass) => void
  onGoTo: (pass: Pass) => void
  /** The pass last shown or gone to, marked in the list. */
  activePass?: Pass | null
  /** Reference for the day separators: a row is inserted where the UTC date changes from today's. */
  now: Date
}

export function PassList({
  location,
  passes,
  filters,
  onFiltersChange,
  selectedName,
  familyOf,
  onShow,
  onGoTo,
  activePass = null,
  now,
}: Props) {
  const isActive = (pass: Pass) => activePass?.noradId === pass.noradId && activePass.peakMs === pass.peakMs
  const set = (change: Partial<PassFilters>) => onFiltersChange({ ...filters, ...change })
  return (
    <>
      <div className={styles.header}>
        <p className="muted">Line of sight above the horizon over {formatLocation(location)}. Drag the pin to move.</p>
        <div className={styles.controls}>
          <label>
            Next{' '}
            <select
              className={panel.control}
              aria-label="Hours ahead"
              value={filters.horizonHours}
              onChange={(e) => set({ horizonHours: Number(e.target.value) })}
            >
              {HORIZONS_H.map((h) => (
                <option key={h} value={h}>
                  {h} h
                </option>
              ))}
            </select>
          </label>
          <label>
            Min{' '}
            <select
              className={panel.control}
              aria-label="Minimum elevation"
              value={filters.minElevationDeg}
              onChange={(e) => set({ minElevationDeg: Number(e.target.value) })}
            >
              {MIN_ELEVATIONS.map((deg) => (
                <option key={deg} value={deg}>
                  {deg}°
                </option>
              ))}
            </select>
          </label>
          {selectedName && (
            <label>
              <input
                type="checkbox"
                checked={filters.onlySelected}
                onChange={(e) => set({ onlySelected: e.target.checked })}
              />{' '}
              only {selectedName}
            </label>
          )}
        </div>
        {passes.length === 0 && <p className="muted">None.</p>}
      </div>
      <ol className={`${panel.list} ${styles.list}`}>
        {passes.map((pass, i) => (
          <li key={`${pass.noradId}-${pass.startMs}`} data-dimmed={activePass && !isActive(pass) ? '' : undefined}>
            {utcDayIndex(pass.startMs) !== utcDayIndex(i === 0 ? now.getTime() : passes[i - 1].startMs) && (
              <div className={`${styles.day} muted`}>{dayLabel(pass.startMs)} UTC</div>
            )}
            <div className={styles.passRow}>
              <button
                type="button"
                className={`${panel.row} ${styles.show}`}
                aria-current={isActive(pass) ? 'true' : undefined}
                onClick={() => onShow(pass)}
                title="Show where the satellite will be at the peak"
              >
                <span className={panel.swatch} style={{ background: familyCss(familyOf(pass.noradId)) }} />
                <span className={styles.time}>
                  {hhmm(pass.startMs)}–{hhmm(pass.endMs)}
                </span>
                {pass.name}
                <span className={`${styles.detail} muted`}>
                  max {Math.round(pass.maxElevationDeg)}° {compassPoint(pass.peakAzimuthDeg)}
                </span>
              </button>
              <button
                type="button"
                className={`${panel.row} ${styles.goto}`}
                aria-label={`Go to ${pass.name} pass at ${hhmm(pass.peakMs)}`}
                onClick={() => onGoTo(pass)}
              >
                ⏱
              </button>
            </div>
          </li>
        ))}
      </ol>
    </>
  )
}
