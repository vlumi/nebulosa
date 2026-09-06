import { useMemo, type PointerEvent } from 'react'
import type { Pass } from '../orbit/passes'
import type { Satellite, TrackSpan } from '../orbit/orbit'
import { daylightStretches } from '../orbit/readout'
import { hhmm } from '../shared/format'
import { PROBE_BIG_STEP_MS, PROBE_STEP_MS } from '../shortcuts'
import { useFrame } from '../time/frame'
import styles from './Timeline.module.css'

interface Props {
  satellite: Satellite
  span: TrackSpan
  /** This satellite's passes over the selected place; those inside the window are drawn. */
  passes: Pass[]
  probeMs: number | null
  onProbe: (timeMs: number | null) => void
}

const STEP_MS = 60_000

/**
 * The drawn track as a strip of time: the flown part left of the center, the part ahead to its right, day and
 * night along it, this satellite's passes over the place, and the probe. Pointing at the strip moves the probe.
 */
export function Timeline({ satellite, span, passes, probeMs, onProbe }: Props) {
  const minute = useFrame((f) => Math.floor(f.timeMs / STEP_MS))
  const nowMs = minute * STEP_MS
  const periodMs = satellite.periodMinutes * STEP_MS
  const fromMs = nowMs - span.pastOrbits * periodMs
  const toMs = nowMs + span.futureOrbits * periodMs
  const stretches = useMemo(() => daylightStretches(satellite, fromMs, toMs), [satellite, fromMs, toMs])
  const x = (ms: number) => ((ms - fromMs) / (toMs - fromMs)) * 100
  const shown = passes.filter((p) => p.endMs > fromMs && p.startMs < toMs)

  const probeFrom = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    onProbe(Math.round((fromMs + fraction * (toMs - fromMs)) / 1000) * 1000)
  }

  return (
    <svg
      className={styles.strip}
      viewBox="0 0 100 10"
      preserveAspectRatio="none"
      role="slider"
      aria-label="Time along the track"
      aria-valuemin={fromMs}
      aria-valuemax={toMs}
      aria-valuenow={probeMs ?? nowMs}
      aria-valuetext={`${hhmm(probeMs ?? nowMs)} UTC`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        probeFrom(e)
      }}
      onPointerMove={(e) => {
        if (e.buttons) probeFrom(e)
      }}
      onDoubleClick={() => onProbe(null)}
      tabIndex={0}
      onKeyDown={(e) => {
        const direction = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
        if (!direction) return
        e.preventDefault()
        onProbe((probeMs ?? nowMs) + direction * (e.shiftKey ? PROBE_BIG_STEP_MS : PROBE_STEP_MS))
      }}
    >
      {stretches.map((s) => (
        <rect
          key={s.fromMs}
          x={x(s.fromMs)}
          y={0}
          width={x(s.toMs) - x(s.fromMs)}
          height={10}
          className={s.lit ? styles.day : styles.night}
        />
      ))}
      {shown.map((p) => (
        <rect
          key={p.startMs}
          x={x(Math.max(p.startMs, fromMs))}
          y={2.5}
          width={x(Math.min(p.endMs, toMs)) - x(Math.max(p.startMs, fromMs))}
          height={5}
          className={styles.pass}
        >
          <title>{`Pass ${hhmm(p.startMs)}–${hhmm(p.endMs)} UTC, ${Math.round(p.maxElevationDeg)}° peak`}</title>
        </rect>
      ))}
      <line x1={x(nowMs)} x2={x(nowMs)} y1={0} y2={10} className={styles.now} />
      {probeMs !== null && probeMs >= fromMs && probeMs <= toMs && (
        <line x1={x(probeMs)} x2={x(probeMs)} y1={0} y2={10} className={styles.probe} />
      )}
    </svg>
  )
}
