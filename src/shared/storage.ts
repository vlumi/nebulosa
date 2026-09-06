/** The browser's localStorage, or nothing where it is unavailable or forbidden; callers then keep state for the visit only. */
export function storage(): Storage | undefined {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}
