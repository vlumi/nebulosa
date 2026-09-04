/** The keyboard scheme, in one place: the handler dispatches on it and the legend renders from it. */
export const SHORTCUTS = [
  { keys: '↑ ↓', does: 'satellite' },
  { keys: '← →', does: 'probe along its track (Shift: 5 min)' },
  { keys: 'Shift ↑ ↓', does: 'pass' },
  { keys: '⏎', does: 'go to the pass' },
  { keys: 'Space', does: 'play / pause' },
  { keys: 'L', does: 'live' },
  { keys: 'S P', does: 'panels' },
  { keys: 'O', does: 'only the selected satellite\u2019s passes' },
  { keys: 'Esc', does: 'clear the pass, then the satellite' },
  { keys: '?', does: 'this help' },
] as const

const FORM_FIELDS = new Set(['INPUT', 'SELECT', 'TEXTAREA'])

/** Whether a key event should be left to the element that has focus rather than handled globally. */
export function belongsToFocusedControl(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null
  if (!target) return false
  if (FORM_FIELDS.has(target.tagName) || target.isContentEditable) return true
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
