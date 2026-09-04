import { useEffect, useState } from 'react'

/** Real wall-clock time, re-read every animation frame. */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    let frame = requestAnimationFrame(function tick() {
      setNow(new Date())
      frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [])
  return now
}
