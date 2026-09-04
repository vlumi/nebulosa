import { useEffect, useMemo, useRef, useState } from 'react'
import { approach } from './smoothing'

/** The simulated time as displayed: follows `targetMs`, easing across jumps frame by frame. */
export function useSmoothedTime(targetMs: number): Date {
  const [displayed, setDisplayed] = useState(targetMs)
  const current = useRef(targetMs)

  useEffect(() => {
    if (current.current === targetMs) return
    let last = performance.now()
    let frame = requestAnimationFrame(function step(t) {
      current.current = approach(current.current, targetMs, t - last)
      last = t
      setDisplayed(current.current)
      if (current.current !== targetMs) frame = requestAnimationFrame(step)
    })
    return () => cancelAnimationFrame(frame)
  }, [targetMs])

  return useMemo(() => new Date(displayed), [displayed])
}
