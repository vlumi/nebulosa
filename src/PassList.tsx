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
}

const hhmm = (ms: number) => new Date(ms).toISOString().slice(11, 16)

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
}: Props) {
  return (
    <>
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
      <ol>
        {passes.map((pass) => (
          <li key={`${pass.noradId}-${pass.startMs}`}>
            <button type="button" onClick={() => onShow(pass)} title="Show where the satellite will be at the peak">
              <span className="swatch" style={{ background: `rgb(${FAMILY_COLORS[familyOf(pass.noradId)].join(' ')})` }} />
              <span className="time">
                {hhmm(pass.startMs)}–{hhmm(pass.endMs)}
              </span>
              {pass.name}
              <span className="muted">
                {Math.round((pass.endMs - pass.startMs) / 60_000)} min · max {Math.round(pass.maxElevationDeg)}°
              </span>
            </button>
            <button type="button" className="goto" aria-label={`Go to ${pass.name} pass at ${hhmm(pass.peakMs)}`} onClick={() => onGoTo(pass)}>
              ⏱
            </button>
          </li>
        ))}
      </ol>
    </>
  )
}
