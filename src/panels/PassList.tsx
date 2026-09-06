import { useStrings } from '../i18n/useStrings'
import { familyCss } from '../shared/palette'
import panel from './panel.module.css'
import { Segmented } from '../shared/Segmented'
import styles from './PassList.module.css'
import type { OrbitFamily } from '../orbit/orbit'
import { compassPoint, dayLabel, hhmm, utcDayIndex } from '../shared/format'
import { HORIZONS_H, PASS_SCOPES, type Pass, type PassFilters } from '../orbit/passes'
import type { Place } from '../places/places'
import { inReach } from '../orbit/swath'

interface Props {
  place: Place
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
  place,
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
  const t = useStrings()
  const isActive = (pass: Pass) => activePass?.noradId === pass.noradId && activePass.peakMs === pass.peakMs
  const set = (change: Partial<PassFilters>) => onFiltersChange({ ...filters, ...change })
  return (
    <>
      <div className={styles.header}>
        <p className="muted">{t.passes.header(place.name)}</p>
        <div className={styles.controls}>
          <span>
            {t.passes.next}{' '}
            <Segmented
              label={t.passes.hoursAhead}
              options={HORIZONS_H}
              value={filters.horizonHours}
              onChange={(horizonHours) => set({ horizonHours })}
              format={t.passes.hours}
            />
          </span>
          <span>
            {t.passes.show}{' '}
            <Segmented
              label={t.passes.scope}
              options={PASS_SCOPES}
              value={filters.within}
              onChange={(within) => set({ within })}
              format={(scope) => (scope === 'horizon' ? t.passes.aboveHorizon : t.passes.inReach)}
            />
          </span>
          {selectedName && (
            <label>
              <input
                type="checkbox"
                checked={filters.onlySelected}
                onChange={(e) => set({ onlySelected: e.target.checked })}
              />{' '}
              {t.passes.only(selectedName)}
            </label>
          )}
        </div>
        {passes.length === 0 && <p className="muted">{t.passes.none}</p>}
      </div>
      <ol className={`${panel.list} ${styles.list}`}>
        {passes.map((pass, i) => (
          <li key={`${pass.noradId}-${pass.startMs}`} data-dimmed={activePass && !isActive(pass) ? '' : undefined}>
            {utcDayIndex(pass.startMs) !== utcDayIndex(i === 0 ? now.getTime() : passes[i - 1].startMs) && (
              <div className={`${styles.day} muted`}>{dayLabel(pass.startMs, t)} UTC</div>
            )}
            <div className={styles.passRow}>
              <button
                type="button"
                className={`${panel.row} ${styles.show}`}
                aria-current={isActive(pass) ? 'true' : undefined}
                onClick={() => onShow(pass)}
                title={t.passes.showTitle}
              >
                <span className={panel.swatch} style={{ background: familyCss(familyOf(pass.noradId)) }} />
                <span className={styles.time}>
                  {hhmm(pass.startMs)}–{hhmm(pass.endMs)}
                </span>
                {pass.name}
                <span
                  className={`${styles.detail} muted`}
                  data-reach={inReach(pass.offNadirDeg) ? '' : undefined}
                  title={t.passes.offNadir(Math.round(pass.offNadirDeg), inReach(pass.offNadirDeg))}
                >
                  {Math.round(pass.maxElevationDeg)}° {compassPoint(pass.peakAzimuthDeg, t)}
                </span>
              </button>
              <button
                type="button"
                className={`${panel.row} ${styles.goto}`}
                aria-label={t.passes.goTo(pass.name, hhmm(pass.peakMs))}
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
