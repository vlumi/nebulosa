import { describeOrbit, formatAltitude } from '../orbit/describe'
import { newestEpoch } from '../orbit/elements'
import { formatAge, utcMinute } from '../shared/format'
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
}

const BEHIND_CHOICES = [...SPAN_CHOICES].reverse()
const fraction = (n: number) => ({ 0.25: '¼', 0.5: '½' })[n] ?? String(n)

export function SatelliteList({ satellites, now, selected, onSelect, span, onSpanChange }: Props) {
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
              {isSelected && <Detail satellite={s} now={now} />}
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
