import { useEffect, useRef, type RefObject } from 'react'

/** The latest value of `value` in a ref, for callbacks created once that must not go stale. */
export function useLatest<T>(value: T): RefObject<T> {
  const ref = useRef(value)
  useEffect(() => {
    ref.current = value
  }, [value])
  return ref
}
