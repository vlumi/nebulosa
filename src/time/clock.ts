/**
 * Simulated time as an anchor pair plus a rate: sim = anchorSim + (real - anchorReal) * rate.
 * Pausing freezes the simulated time and keeps the rate, so play resumes at the speed that was chosen; a pause
 * that began live remembers so, and play then returns to live instead of trailing real time by the pause.
 */
export interface Clock {
  anchorReal: number
  anchorSim: number
  rate: number
  paused: boolean
  liveOnResume?: true
}

export const RATES = [1, 10, 60, 600] as const

export function liveClock(realMs: number): Clock {
  return { anchorReal: realMs, anchorSim: realMs, rate: 1, paused: false }
}

export function simTime(clock: Clock, realMs: number): number {
  return clock.anchorSim + (clock.paused ? 0 : (realMs - clock.anchorReal) * clock.rate)
}

/** Choosing a speed also plays. */
export function withRate(clock: Clock, rate: number, realMs: number): Clock {
  return { anchorReal: realMs, anchorSim: simTime(clock, realMs), rate, paused: false }
}

export function withPaused(clock: Clock, paused: boolean, realMs: number): Clock {
  if (!paused && clock.liveOnResume) return liveClock(realMs)
  const { liveOnResume: _, ...rest } = clock
  const held = { ...rest, anchorReal: realMs, anchorSim: simTime(clock, realMs), paused }
  return paused && isLive(clock, realMs) ? { ...held, liveOnResume: true } : held
}

export function scrubbedTo(clock: Clock, simMs: number, realMs: number): Clock {
  return { ...clock, anchorReal: realMs, anchorSim: simMs }
}

export function isLive(clock: Clock, realMs: number): boolean {
  return clock.rate === 1 && !clock.paused && Math.abs(simTime(clock, realMs) - realMs) < 1000
}
