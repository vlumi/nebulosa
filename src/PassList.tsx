import { FAMILY_COLORS } from './layers'
import type { OrbitFamily } from './orbit'
import { formatLocation, HORIZONS_H, type Location, type Pass } from './passes'

interface Props {
  location: Location
  passes: Pass[]
  horizonHours: number
  onHorizonChange: (hours: number) => void
  /** Name of the selected satellite when the list can be narrowed to it. */
  selectedName?: string
  onlySelected: boolean
  onOnlySelectedChange: (only: boolean) => void
  familyOf: (noradId: number) => OrbitFamily
  onShow: (pass: Pass) => void
  onGoTo: (pass: Pass) => void
  /** Reference for the day separators: a row is inserted where the UTC date changes from today's. */
  now: Date
}

const hhmm = (ms: number) => new Date(ms).toISOString().slice(11, 16)
const utcDay = (ms: number) => Math.floor(ms / 86_400_000)
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const dayLabel = (ms: number) => {
  const d = new Date(ms)
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`
}

export function PassList({
  location,
  passes,
  horizonHours,
  onHorizonChange,
  selectedName,
  onlySelected,
  onOnlySelectedChange,
  familyOf,
  onShow,
  onGoTo,
  now,
}: Props) {
  return (
    <>
      <div className="pass-header">
      <p className="muted">
        Line of sight above the horizon over {formatLocation(location)}. Drag the pin to move.
      </p>
      <div className="pass-controls">
        <label>
          Next{' '}
          <select aria-label="Hours ahead" value={horizonHours} onChange={(e) => onHorizonChange(Number(e.target.value))}>
            {HORIZONS_H.map((h) => (
              <option key={h} value={h}>
                {h} h
              </option>
            ))}
          </select>
        </label>
        {selectedName && (
          <label>
            <input type="checkbox" checked={onlySelected} onChange={(e) => onOnlySelectedChange(e.target.checked)} />
            {' '}
            only {selectedName}
          </label>
        )}
      </div>
      {passes.length === 0 && <p className="muted">None.</p>}
      </div>
      <ol>
        {passes.map((pass, i) => (
          <li key={`${pass.noradId}-${pass.startMs}`}>
            {utcDay(pass.startMs) !== utcDay(i === 0 ? now.getTime() : passes[i - 1].startMs) && (
              <div className="day muted">{dayLabel(pass.startMs)} UTC</div>
            )}
            <div className="row">
            <button type="button" onClick={() => onShow(pass)} title="Show where the satellite will be at the peak">
              <span className="swatch" style={{ background: `rgb(${FAMILY_COLORS[familyOf(pass.noradId)].join(' ')})` }} />
              <span className="time">
                {hhmm(pass.startMs)}–{hhmm(pass.endMs)}
              </span>
              {pass.name}
              <span className="muted">max {Math.round(pass.maxElevationDeg)}°</span>
            </button>
            <button type="button" className="goto" aria-label={`Go to ${pass.name} pass at ${hhmm(pass.peakMs)}`} onClick={() => onGoTo(pass)}>
              ⏱
            </button>
            </div>
          </li>
        ))}
      </ol>
    </>
  )
}
