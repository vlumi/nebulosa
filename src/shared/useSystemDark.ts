import { useEffect, useState } from 'react'

const QUERY = '(prefers-color-scheme: dark)'

/** Whether the operating system prefers dark; true where matchMedia is unavailable (tests), matching the default. */
export function useSystemDark(): boolean {
  const [dark, setDark] = useState(() => window.matchMedia?.(QUERY).matches ?? true)
  useEffect(() => {
    const media = window.matchMedia?.(QUERY)
    if (!media) return
    const onChange = () => setDark(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])
  return dark
}
