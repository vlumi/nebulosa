import { useEffect, useMemo, useRef, useState } from 'react'
import { simTime, type Clock } from './clock'
import { approach } from './smoothing'

/**
 * One animation-frame loop for both clocks: the real wall-clock time, and the displayed simulated
 * time, which follows `clock` and eases across jumps instead of cutting.
 */
export function useClockTime(clock: Clock): { now: Date; time: Date } {
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [displayedMs, setDisplayedMs] = useState(() => simTime(clock, Date.now()))
  const latestClock = useRef(clock)
  useEffect(() => {
    latestClock.current = clock
  }, [clock])

  useEffect(() => {
    let displayed = simTime(latestClock.current, Date.now())
    let last = performance.now()
    let frame = requestAnimationFrame(function tick(t) {
      const real = Date.now()
      setNowMs(real)
      const next = approach(displayed, simTime(latestClock.current, real), t - last)
      last = t
      if (next !== displayed) {
        displayed = next
        setDisplayedMs(next)
      }
      frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  const now = useMemo(() => new Date(nowMs), [nowMs])
  const time = useMemo(() => new Date(displayedMs), [displayedMs])
  return { now, time }
}
