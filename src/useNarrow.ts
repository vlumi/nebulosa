import { useEffect, useState } from 'react'

export const NARROW_QUERY = '(max-width: 720px)'

/** True on phone-sized viewports; false where matchMedia is unavailable (tests). */
export function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => window.matchMedia?.(NARROW_QUERY).matches ?? false)
  useEffect(() => {
    const media = window.matchMedia?.(NARROW_QUERY)
    if (!media) return
    const onChange = () => setNarrow(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])
  return narrow
}
