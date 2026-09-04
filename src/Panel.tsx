import { describeOrbit, formatAltitude } from './describe'
import { formatAge, newestEpoch } from './elements'
import { FAMILY_COLORS } from './layers'
import type { Satellite } from './orbit'

interface Props {
  satellites: Satellite[]
  now: Date
  selected: number | null
  onSelect: (noradId: number | null) => void
}

export function Panel({ satellites, now, selected, onSelect }: Props) {
  const epoch = newestEpoch(satellites.map((s) => s.omm))
  return (
    <>
      <ul>
        {satellites.map((s) => {
          const id = s.omm.NORAD_CAT_ID
          const isSelected = id === selected
          return (
            <li key={id} className={selected !== null && !isSelected ? 'dimmed' : undefined}>
              <button type="button" aria-pressed={isSelected} onClick={() => onSelect(isSelected ? null : id)}>
                <span className="swatch" style={{ background: `rgb(${FAMILY_COLORS[s.family].join(' ')})` }} />
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
      <p className="muted">
        Elements from {epoch.toISOString().slice(0, 16).replace('T', ' ')} UTC · {formatAge(epoch, now)} old
      </p>
    </>
  )
}

function Detail({ satellite, now }: { satellite: Satellite; now: Date }) {
  const { omm, family } = satellite
  const d = describeOrbit(omm)
  const rows: [string, string][] = [
    ['Launched', `${d.launchYear} · ${omm.OBJECT_ID}`],
    ['Orbit', `${family === 'sun-synchronous' ? 'sun-synchronous' : 'mid-inclination'}, ${d.inclinationDeg.toFixed(2)}°`],
    ['Altitude', formatAltitude(d)],
    ['Period', `${d.periodMinutes.toFixed(1)} min · ${omm.MEAN_MOTION.toFixed(2)} rev/day`],
    ['Eccentricity', d.eccentricity.toFixed(4)],
    ['Elements', `${d.epoch.toISOString().slice(0, 16).replace('T', ' ')} UTC · ${formatAge(d.epoch, now)} old`],
  ]
  return (
    <dl className="detail" aria-label={`${omm.OBJECT_NAME} details`}>
      {rows.map(([term, value]) => (
        <div key={term}>
          <dt>{term}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}
