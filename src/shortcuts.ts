import type { Pass } from './orbit/passes'
import type { Satellite } from './orbit/orbit'
import type { Theme } from './shared/theme'
import type { Strings } from './i18n/strings'
import { useApp } from './store'

/** One arrow step of the track probe, and the step with Shift held. */
export const PROBE_STEP_MS = 30_000
export const PROBE_BIG_STEP_MS = 5 * 60_000

/** The keyboard scheme, in one place: the handler dispatches on it and the legend renders from it, `does` naming a help string. */
export const SHORTCUTS: { keys: string; does: keyof Strings['help'] }[] = [
  { keys: '↑ ↓', does: 'stepPanel' },
  { keys: 'Shift ↑ ↓', does: 'movePlace' },
  { keys: '← →', does: 'probe' },
  { keys: '⏎', does: 'goToPass' },
  { keys: 'Space', does: 'playPause' },
  { keys: 'L', does: 'live' },
  { keys: '1 2 3', does: 'sheets' },
  { keys: 'O', does: 'onlySelected' },
  { keys: 'F', does: 'follow' },
  { keys: 'V', does: 'ride' },
  { keys: 'R', does: 'reach' },
  { keys: 'G', does: 'globe' },
  { keys: 'T', does: 'theme' },
  { keys: 'Esc', does: 'escape' },
  { keys: 'I', does: 'about' },
  { keys: '?', does: 'help' },
]

const FORM_FIELDS = new Set(['INPUT', 'SELECT', 'TEXTAREA'])

/** Whether a key event should be left to the element that has focus rather than handled globally. */
export function belongsToFocusedControl(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null
  if (!target) return false
  if (FORM_FIELDS.has(target.tagName) || target.isContentEditable) return true
  if (target.getAttribute('role') === 'radio' && event.key.startsWith('Arrow')) return true
  return target.tagName === 'BUTTON' && (event.key === 'Enter' || event.key === ' ')
}

/**
 * After a pointer click on a button or the slider, drop focus so the global shortcuts keep working;
 * keyboard activation (`detail` 0) keeps focus where the keyboard user put it.
 */
export function releaseFocusAfterPointerClick(event: MouseEvent): void {
  if (event.detail === 0) return
  const control = (event.target as Element | null)?.closest<HTMLElement>('button, input[type="range"]')
  control?.blur()
}

/** Index after stepping through a list of `length`: from nothing, forward picks the first and back the last. */
export function stepIndex(current: number, delta: 1 | -1, length: number): number {
  if (length === 0) return -1
  if (current < 0) return delta > 0 ? 0 : length - 1
  return Math.max(0, Math.min(length - 1, current + delta))
}

interface ShortcutContext {
  satellites: Satellite[]
  /** The pass list as shown, so the arrows step through what the reader sees. */
  passes: Pass[]
  theme: Theme
  /** The displayed moment, where a fresh probe starts. */
  displayedMs: () => number
}

/** Acts on a key press against the store; true when the key was one of ours and the browser should not also act. */
export function dispatchShortcut(
  e: KeyboardEvent,
  { satellites, passes, theme, displayedMs }: ShortcutContext,
): boolean {
  if (belongsToFocusedControl(e) || e.metaKey || e.ctrlKey || e.altKey) return false
  const s = useApp.getState()
  const satelliteIndex = satellites.findIndex((sat) => sat.omm.NORAD_CAT_ID === s.selection.noradId)
  const passIndex = passes.findIndex(
    (p) => p.noradId === s.selection.activePass?.noradId && p.peakMs === s.selection.activePass?.peakMs,
  )
  const placeIndex = s.places.findIndex((p) => p.id === s.placeId)
  switch (e.key) {
    case '?':
    case '/':
      s.setHelpOpen(!s.helpOpen)
      break
    case 'Escape':
      s.escape()
      break
    case 'ArrowDown':
    case 'ArrowUp': {
      const delta = e.key === 'ArrowDown' ? 1 : -1
      if (s.sheet === 'passes') {
        const i = stepIndex(passIndex, delta, passes.length)
        if (i >= 0) s.showPass(passes[i])
      } else if (s.sheet === 'places' && e.shiftKey) {
        if (s.placeId !== null) s.reorderPlace(s.placeId, delta)
      } else if (s.sheet === 'places') {
        const i = stepIndex(placeIndex, delta, s.places.length)
        if (i >= 0) s.selectPlace(s.places[i].id, true)
      } else {
        const i = stepIndex(satelliteIndex, delta, satellites.length)
        if (i >= 0) s.selectFromList(satellites[i].omm.NORAD_CAT_ID)
      }
      break
    }
    case 'ArrowRight':
    case 'ArrowLeft':
      s.probe((e.shiftKey ? PROBE_BIG_STEP_MS : PROBE_STEP_MS) * (e.key === 'ArrowRight' ? 1 : -1), displayedMs())
      break
    case 'Enter':
      if (s.selection.activePass) s.goToPass(s.selection.activePass)
      break
    case ' ':
      s.togglePlay()
      break
    case 'l':
    case 'L':
      s.goLive()
      break
    case '1':
      s.toggleSheet('satellites')
      break
    case '2':
      s.toggleSheet('places')
      break
    case '3':
      s.toggleSheet('passes')
      break
    case 'o':
    case 'O':
      if (s.selection.noradId !== null) s.toggleOnlySelected()
      break
    case 'r':
    case 'R':
      s.toggleReach()
      break
    case 'g':
    case 'G':
      s.toggleGlobe()
      break
    case 'f':
    case 'F':
      if (s.selection.noradId !== null) s.toggleFollow()
      break
    case 'v':
    case 'V':
      s.setRide(!s.ride)
      break
    case 'i':
    case 'I':
      s.setAboutOpen(!s.aboutOpen)
      break
    case 't':
    case 'T':
      s.setThemeChoice(theme === 'light' ? 'dark' : 'light')
      break
    default:
      return false
  }
  return true
}
