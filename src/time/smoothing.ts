/**
 * Move `current` toward `target` by an exponential approach with time constant `tauMs`,
 * snapping once within `snapMs`. Used to animate jumps in simulated time instead of cutting.
 */
export function approach(current: number, target: number, dtMs: number, tauMs = 120, snapMs = 250): number {
  const diff = target - current
  if (Math.abs(diff) <= snapMs) return target
  return current + diff * (1 - Math.exp(-dtMs / tauMs))
}
