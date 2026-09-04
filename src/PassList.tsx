import { FAMILY_COLORS } from './layers'
import type { OrbitFamily } from './orbit'
import { formatLocation, type Location, type Pass } from './passes'

interface Props {
  location: Location
  passes: Pass[]
  familyOf: (noradId: number) => OrbitFamily
  onShow: (pass: Pass) => void
  onGoTo: (pass: Pass) => void
  limit?: number
}

const hhmm = (ms: number) => new Date(ms).toISOString().slice(11, 16)

export function PassList({ location, passes, familyOf, onShow, onGoTo, limit = 10 }: Props) {
  return (
    <>
      <p className="muted">
        Next 24 h from now over {formatLocation(location)}, line of sight above the horizon. Drag the pin to move.
      </p>
      {passes.length === 0 && <p className="muted">None.</p>}
      <ol>
        {passes.slice(0, limit).map((pass) => (
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
      {passes.length > limit && <p className="muted">and {passes.length - limit} more</p>}
    </>
  )
}
