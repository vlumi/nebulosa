import { describeOrbit, formatAltitude } from '../orbit/describe'
import { newestEpoch } from '../orbit/elements'
import { compassPoint, formatAge, formatDuration, formatLocation, hhmm, utcMinute } from '../shared/format'
import { nextTerminatorCrossing, stateAt } from '../orbit/readout'
import type { Pass } from '../orbit/passes'
import { useFrame } from '../time/frame'
import { familyCss } from '../shared/palette'
import panel from './panel.module.css'
import { Segmented } from '../shared/Segmented'
import styles from './SatelliteList.module.css'
import { SPAN_CHOICES, type Satellite, type TrackSpan } from '../orbit/orbit'

interface Props {
  satellites: Satellite[]
  now: Date
  selected: number | null
  onSelect: (noradId: number | null) => void
  span: TrackSpan
  onSpanChange: (span: TrackSpan) => void
  /** Keep the selected satellite centered on the map. */
  follow: boolean
  onFollowChange: (follow: boolean) => void
  /** The selected satellite's next pass over the selected place, if both exist. */
  nextPass: Pass | null
  placeName?: string
}

const BEHIND_CHOICES = [...SPAN_CHOICES].reverse()
const fraction = (n: number) => ({ 0.25: '¼', 0.5: '½' })[n] ?? String(n)

export function SatelliteList({
  satellites,
  now,
  selected,
  onSelect,
  span,
  onSpanChange,
  follow,
  onFollowChange,
  nextPass,
  placeName,
}: Props) {
  const epoch = newestEpoch(satellites.map((s) => s.omm))
  return (
    <>
      <ul className={`${panel.list} ${styles.list}`}>
        {satellites.map((s) => {
          const id = s.omm.NORAD_CAT_ID
          const isSelected = id === selected
          return (
            <li key={id} data-dimmed={selected !== null && !isSelected ? '' : undefined}>
              <button
                type="button"
                className={panel.row}
                aria-pressed={isSelected}
                onClick={() => onSelect(isSelected ? null : id)}
              >
                <span className={panel.swatch} style={{ background: familyCss(s.family) }} />
                {s.omm.OBJECT_NAME}{' '}
                <span className="muted">
                  <span title="NORAD catalog number">#{id}</span> ·{' '}
                  <span title="Inclination">{s.omm.INCLINATION.toFixed(1)}°</span>
                </span>
              </button>
              {isSelected && (
                <>
                  <Detail satellite={s} now={now} />
                  <Readout satellite={s} nextPass={nextPass} placeName={placeName} />
                  <label
                    className={styles.follow}
                    title="Keep the map centered on it as time plays; dragging the map lets go"
                  >
                    <input type="checkbox" checked={follow} onChange={(e) => onFollowChange(e.target.checked)} /> Follow
                  </label>
                </>
              )}
            </li>
          )
        })}
      </ul>
      <div className={`${styles.spanControls} muted`}>
        <span aria-hidden="true">◂</span>
        <Segmented
          label="Track behind"
          options={BEHIND_CHOICES}
          value={span.pastOrbits}
          onChange={(pastOrbits) => onSpanChange({ ...span, pastOrbits })}
          format={fraction}
        />
        orbits
        <Segmented
          label="Track ahead"
          options={SPAN_CHOICES}
          value={span.futureOrbits}
          onChange={(futureOrbits) => onSpanChange({ ...span, futureOrbits })}
          format={fraction}
        />
        <span aria-hidden="true">▸</span>
      </div>
      <p className={`${styles.footer} muted`}>
        Elements from {utcMinute(epoch)} UTC · {formatAge(epoch, now)} old
      </p>
    </>
  )
}

function Detail({ satellite, now }: { satellite: Satellite; now: Date }) {
  const { omm, family } = satellite
  const d = describeOrbit(omm)
  const rows: [string, string][] = [
    ['Launched', `${d.launchYear} · ${omm.OBJECT_ID}`],
    ['Orbit', `${family}, ${d.inclinationDeg.toFixed(2)}°`],
    ['Altitude', formatAltitude(d)],
    ['Period', `${d.periodMinutes.toFixed(1)} min · ${omm.MEAN_MOTION.toFixed(2)} rev/day`],
    ['Eccentricity', d.eccentricity.toFixed(4)],
    ['Elements', `${utcMinute(d.epoch)} UTC · ${formatAge(d.epoch, now)} old`],
  ]
  return (
    <dl className={styles.detail} aria-label={`${omm.OBJECT_NAME} details`}>
      {rows.map(([term, value]) => (
        <div key={term}>
          <dt>{term}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Where the satellite is at the displayed moment, updated every second while the sheet is open. */
function Readout({
  satellite,
  nextPass,
  placeName,
}: {
  satellite: Satellite
  nextPass: Pass | null
  placeName?: string
}) {
  const simMs = useFrame((f) => Math.floor(f.timeMs / 1000) * 1000)
  const state = stateAt(satellite, new Date(simMs))
  if (!state) return null
  const crossing = nextTerminatorCrossing(satellite, simMs)
  const pass = nextPass && nextPass.endMs > simMs ? nextPass : null
  const rows: [string, string][] = [
    ['Over', formatLocation(state)],
    ['Height', `${Math.round(state.altKm)} km`],
    ['Speed', `${state.speedKmS.toFixed(2)} km/s`],
    ['Heading', `${compassPoint(state.headingDeg)} ${Math.round(state.headingDeg)}°`],
    [
      'Next pass',
      !placeName
        ? 'no place selected'
        : !pass
          ? `none listed over ${placeName}`
          : pass.startMs <= simMs
            ? `over ${placeName} now, until ${hhmm(pass.endMs)} UTC`
            : `in ${formatDuration(pass.startMs - simMs)} · ${hhmm(pass.startMs)} UTC over ${placeName}`,
    ],
    [
      'Terminator',
      crossing ? `${crossing.into} in ${formatDuration(crossing.timeMs - simMs)}` : 'not crossed this orbit',
    ],
  ]
  return (
    <dl className={styles.detail} aria-label={`${satellite.omm.OBJECT_NAME} now`}>
      {rows.map(([term, value]) => (
        <div key={term}>
          <dt>{term}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}
