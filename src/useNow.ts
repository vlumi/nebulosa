import { useEffect, useState } from 'react'

/** Real wall-clock time, re-read every `intervalMs`; 0 means every animation frame. */
export function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    if (intervalMs > 0) {
      const id = setInterval(() => setNow(new Date()), intervalMs)
      return () => clearInterval(id)
    }
    let frame = requestAnimationFrame(function tick() {
      setNow(new Date())
      frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [intervalMs])
  return now
}
