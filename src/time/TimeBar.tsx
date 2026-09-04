import { isLive, liveClock, RATES, scrubbedTo, simTime, withRate, type Clock } from './clock'
import { formatOffset, utcDate, utcSecond } from '../shared/format'
import styles from './TimeBar.module.css'

const RANGE_MS = 12 * 3_600_000
const STEP_MS = 60_000

interface Props {
  clock: Clock
  now: Date
  onChange: (clock: Clock) => void
}

export function TimeBar({ clock, now, onChange }: Props) {
  const realMs = now.getTime()
  const simMs = simTime(clock, realMs)
  const offset = Math.max(-RANGE_MS, Math.min(RANGE_MS, simMs - realMs))
  const playing = clock.rate > 0

  return (
    <div className={styles.bar}>
      <button type="button" onClick={() => onChange(liveClock(realMs))} disabled={isLive(clock, realMs)}>
        Live
      </button>
      <button
        type="button"
        aria-label={playing ? 'Pause' : 'Play'}
        onClick={() => onChange(withRate(clock, playing ? 0 : 1, realMs))}
      >
        {playing ? '❚❚' : '▶'}
      </button>
      <select
        aria-label="Speed"
        value={playing ? clock.rate : 1}
        onChange={(e) => onChange(withRate(clock, Number(e.target.value), realMs))}
      >
        {RATES.map((rate) => (
          <option key={rate} value={rate}>
            {rate}×
          </option>
        ))}
      </select>
      <input
        type="range"
        aria-label="Time offset"
        min={-RANGE_MS}
        max={RANGE_MS}
        step={STEP_MS}
        value={offset}
        onChange={(e) => onChange(scrubbedTo(clock, realMs + Number(e.target.value), realMs))}
      />
      <input
        type="date"
        aria-label="Date (UTC)"
        value={utcDate(simMs)}
        onChange={(e) => {
          if (!e.target.value) return
          const dayMs = Date.parse(`${e.target.value}T00:00:00Z`)
          const timeOfDayMs = simMs % 86_400_000
          onChange(withRate(scrubbedTo(clock, dayMs + timeOfDayMs, realMs), 0, realMs))
        }}
      />
      <output>
        {utcSecond(simMs)} UTC
        <span className="muted"> · {formatOffset(simMs, realMs)}</span>
      </output>
    </div>
  )
}
