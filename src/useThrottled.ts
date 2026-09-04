import { useEffect, useRef, useState } from 'react'

/** Follows `value`, but accepts a new one at most every `minIntervalMs` (trailing edge kept). */
export function useThrottled<T>(value: T, minIntervalMs: number): T {
  const [accepted, setAccepted] = useState(value)
  const lastAccept = useRef(0)

  useEffect(() => {
    const wait = Math.max(0, lastAccept.current + minIntervalMs - performance.now())
    const id = setTimeout(() => {
      lastAccept.current = performance.now()
      setAccepted(value)
    }, wait)
    return () => clearTimeout(id)
  }, [value, minIntervalMs])

  return accepted
}
