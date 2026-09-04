import { familyCss } from '../shared/palette'
import panel from './panel.module.css'
import { Segmented } from '../shared/Segmented'
import styles from './PassList.module.css'
import type { OrbitFamily } from '../orbit/orbit'
import { compassPoint, dayLabel, formatLocation, hhmm, utcDayIndex } from '../shared/format'
import { HORIZONS_H, MIN_ELEVATIONS, type Location, type Pass, type PassFilters } from '../orbit/passes'
import { inReach, STEERING } from '../orbit/swath'

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
        <p className="muted">
          Line of sight above the horizon over {formatLocation(location)}. Drag the pin to move. Accent peaks are within
          the radar's {STEERING.minDeg}–{STEERING.maxDeg}° steering range.
        </p>
        <div className={styles.controls}>
          <label>
            Next{' '}
            <Segmented
              label="Hours ahead"
              options={HORIZONS_H}
              value={filters.horizonHours}
              onChange={(horizonHours) => set({ horizonHours })}
              format={(h) => `${h} h`}
            />
          </label>
          <label>
            Min{' '}
            <Segmented
              label="Minimum elevation"
              options={MIN_ELEVATIONS}
              value={filters.minElevationDeg}
              onChange={(minElevationDeg) => set({ minElevationDeg })}
              format={(deg) => `${deg}°`}
            />
          </label>
          <label title="Peaks the radar can steer to; straight overhead is too close for a side-looking radar">
            <input
              type="checkbox"
              checked={filters.inReachOnly}
              onChange={(e) => set({ inReachOnly: e.target.checked })}
            />{' '}
            in SAR reach
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
                <span
                  className={`${styles.detail} muted`}
                  data-reach={inReach(pass.offNadirDeg) ? '' : undefined}
                  title={`${Math.round(pass.offNadirDeg)}° off nadir at the peak${inReach(pass.offNadirDeg) ? ', within SAR reach' : ''}`}
                >
                  {Math.round(pass.maxElevationDeg)}° {compassPoint(pass.peakAzimuthDeg)}
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
