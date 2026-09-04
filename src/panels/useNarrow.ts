import { useEffect, useState } from 'react'

/** Phones, and desktop windows too short for two panels above each other. Keep in step with index.css. */
export const NARROW_QUERY = '(max-width: 720px), (max-height: 560px)'

/** True on small viewports, see NARROW_QUERY; false where matchMedia is unavailable (tests). */
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
