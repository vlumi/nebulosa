import { useStrings } from '../i18n/useStrings'
import { describeOrbit, formatAltitude } from '../orbit/describe'
import type { Strings } from '../i18n/strings'
import { newestEpoch } from '../orbit/elements'
import { compassPoint, formatAge, formatDuration, formatLocation, hhmm, utcMinute } from '../shared/format'
import { nextTerminatorCrossing, stateAt, type TerminatorCrossing } from '../orbit/readout'
import type { Pass } from '../orbit/passes'
import { useFrame } from '../time/frame'
import { Timeline } from './Timeline'
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
  /** The selected satellite's next pass over the selected place, if both exist. */
  nextPass: Pass | null
  placeName?: string
  /** The selected satellite's passes over the selected place, for its timeline. */
  passes: Pass[]
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
  nextPass,
  placeName,
  passes,
}: Props) {
  const t = useStrings()
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
                  <span title={t.satellites.noradTitle}>#{id}</span> ·{' '}
                  <span title={t.satellites.inclinationTitle}>{s.omm.INCLINATION.toFixed(1)}°</span>
                </span>
              </button>
              {isSelected && (
                <>
                  <Detail satellite={s} now={now} t={t} />
                  <Readout satellite={s} nextPass={nextPass} placeName={placeName} t={t} />
                  <Timeline satellite={s} span={span} passes={passes} />
                </>
              )}
            </li>
          )
        })}
      </ul>
      <div className={`${styles.spanControls} muted`}>
        <span aria-hidden="true">◂</span>
        <Segmented
          label={t.satellites.behind}
          options={BEHIND_CHOICES}
          value={span.pastOrbits}
          onChange={(pastOrbits) => onSpanChange({ ...span, pastOrbits })}
          format={fraction}
        />
        {t.satellites.orbits}
        <Segmented
          label={t.satellites.ahead}
          options={SPAN_CHOICES}
          value={span.futureOrbits}
          onChange={(futureOrbits) => onSpanChange({ ...span, futureOrbits })}
          format={fraction}
        />
        <span aria-hidden="true">▸</span>
      </div>
      <p className={`${styles.footer} muted`}>
        {t.satellites.elementsFrom(utcMinute(epoch), formatAge(epoch, now, t))}
      </p>
    </>
  )
}

function Detail({ satellite, now, t }: { satellite: Satellite; now: Date; t: Strings }) {
  const { omm, family } = satellite
  const d = describeOrbit(omm)
  const rows: [string, string][] = [
    [t.satellites.launched, `${d.launchYear} · ${omm.OBJECT_ID}`],
    [t.satellites.orbit, `${t.satellites.family[family]}, ${d.inclinationDeg.toFixed(2)}°`],
    [t.satellites.altitude, formatAltitude(d)],
    [
      t.satellites.period,
      `${d.periodMinutes.toFixed(1)} min · ${omm.MEAN_MOTION.toFixed(2)} ${t.satellites.revPerDay}`,
    ],
    [t.satellites.eccentricity, d.eccentricity.toFixed(4)],
    [t.satellites.elements, `${utcMinute(d.epoch)} UTC · ${t.satellites.aged(formatAge(d.epoch, now, t))}`],
  ]
  return (
    <dl className={styles.detail} aria-label={t.satellites.details(omm.OBJECT_NAME)}>
      {rows.map(([term, value]) => (
        <div key={term}>
          <dt>{term}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * The next crossing is a scan of a whole orbit, so it is kept per satellite until it has passed, the clock has gone
 * backwards, or a minute has gone by without one; a second's tick never rescans.
 */
const knownCrossings = new Map<number, { fromMs: number; crossing: TerminatorCrossing | null }>()

function terminatorCrossingFor(satellite: Satellite, simMs: number): TerminatorCrossing | null {
  const known = knownCrossings.get(satellite.omm.NORAD_CAT_ID)
  const stale =
    !known ||
    simMs < known.fromMs ||
    (known.crossing !== null && simMs >= known.crossing.timeMs) ||
    (known.crossing === null && simMs - known.fromMs > 60_000)
  if (!stale) return known.crossing
  const fresh = { fromMs: simMs, crossing: nextTerminatorCrossing(satellite, simMs) }
  knownCrossings.set(satellite.omm.NORAD_CAT_ID, fresh)
  return fresh.crossing
}

/** Where the satellite is at the displayed moment, updated every second while the sheet is open. */
function Readout({
  satellite,
  nextPass,
  placeName,
  t,
}: {
  satellite: Satellite
  nextPass: Pass | null
  placeName?: string
  t: Strings
}) {
  const simMs = useFrame((f) => Math.floor(f.timeMs / 1000) * 1000)
  const state = stateAt(satellite, new Date(simMs))
  const crossing = terminatorCrossingFor(satellite, simMs)
  if (!state) return null
  const pass = nextPass && nextPass.endMs > simMs ? nextPass : null
  const rows: [string, string][] = [
    [t.satellites.over, formatLocation(state)],
    [t.satellites.height, `${Math.round(state.altKm)} km`],
    [t.satellites.speed, `${state.speedKmS.toFixed(2)} km/s`],
    [t.satellites.heading, `${compassPoint(state.headingDeg, t)} ${Math.round(state.headingDeg)}°`],
    [
      t.satellites.nextPass,
      !placeName
        ? t.satellites.noPlace
        : !pass
          ? t.satellites.noneListed(placeName)
          : pass.startMs <= simMs
            ? t.satellites.overNow(placeName, hhmm(pass.endMs))
            : t.satellites.passIn(formatDuration(pass.startMs - simMs, t), hhmm(pass.startMs), placeName),
    ],
    [
      t.satellites.terminator,
      crossing
        ? t.satellites.crossing(crossing.into, formatDuration(crossing.timeMs - simMs, t))
        : t.satellites.notCrossed,
    ],
  ]
  return (
    <dl className={styles.detail} aria-label={t.satellites.now(satellite.omm.OBJECT_NAME)}>
      {rows.map(([term, value]) => (
        <div key={term}>
          <dt>{term}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}
