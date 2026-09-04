import { useEffect, useMemo, useRef, useState } from 'react'
import { approach } from './smoothing'

/** The simulated time as displayed: follows `targetMs`, easing across jumps frame by frame. */
export function useSmoothedTime(targetMs: number): Date {
  const [displayed, setDisplayed] = useState(targetMs)
  const target = useRef(targetMs)

  useEffect(() => {
    target.current = targetMs
  }, [targetMs])

  useEffect(() => {
    let current = target.current
    let last = performance.now()
    let frame = requestAnimationFrame(function step(t) {
      const next = approach(current, target.current, t - last)
      last = t
      if (next !== current) {
        current = next
        setDisplayed(next)
      }
      frame = requestAnimationFrame(step)
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  return useMemo(() => new Date(displayed), [displayed])
}
