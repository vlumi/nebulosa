import { isLive, liveClock, RATES, scrubbedTo, simTime, withPaused, withRate, type Clock } from './clock'
import { formatOffset, utcDate, utcSecond } from '../shared/format'
import { Segmented } from '../shared/Segmented'
import styles from './TimeBar.module.css'

const DAY_MS = 86_400_000
const STEP_MS = 60_000

interface Props {
  clock: Clock
  now: Date
  onChange: (clock: Clock) => void
}

export function TimeBar({ clock, now, onChange }: Props) {
  const realMs = now.getTime()
  const simMs = simTime(clock, realMs)
  // The slider spans the displayed UTC day; the date picker beside it moves between days.
  const dayStartMs = simMs - (((simMs % DAY_MS) + DAY_MS) % DAY_MS)
  const playing = !clock.paused

  return (
    <div className={styles.bar}>
      <button type="button" onClick={() => onChange(liveClock(realMs))} disabled={isLive(clock, realMs)}>
        Live
      </button>
      <button
        type="button"
        aria-label={playing ? 'Pause' : 'Play'}
        onClick={() => onChange(withPaused(clock, playing, realMs))}
      >
        {playing ? '❚❚' : '▶'}
      </button>
      <Segmented
        label="Speed"
        options={RATES}
        value={clock.rate}
        onChange={(rate) => onChange(withRate(clock, rate, realMs))}
        format={(rate) => `${rate}×`}
      />
      <input
        type="range"
        aria-label="Time of day (UTC)"
        min={0}
        max={DAY_MS - STEP_MS}
        step={STEP_MS}
        value={simMs - dayStartMs}
        onChange={(e) => onChange(scrubbedTo(clock, dayStartMs + Number(e.target.value), realMs))}
      />
      <input
        type="date"
        aria-label="Date (UTC)"
        value={utcDate(simMs)}
        onChange={(e) => {
          if (!e.target.value) return
          const dayMs = Date.parse(`${e.target.value}T00:00:00Z`)
          onChange(withPaused(scrubbedTo(clock, dayMs + (simMs - dayStartMs), realMs), true, realMs))
        }}
      />
      <output>
        {utcSecond(simMs)} UTC
        <span className="muted"> · {formatOffset(simMs, realMs)}</span>
      </output>
    </div>
  )
}
