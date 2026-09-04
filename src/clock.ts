/**
 * Simulated time as an anchor pair plus a rate: sim = anchorSim + (real - anchorReal) * rate.
 * Rate 1 with a zero offset is live; rate 0 is paused.
 */
export interface Clock {
  anchorReal: number
  anchorSim: number
  rate: number
}

export const RATES = [1, 10, 60, 600] as const

export function liveClock(realMs: number): Clock {
  return { anchorReal: realMs, anchorSim: realMs, rate: 1 }
}

export function simTime(clock: Clock, realMs: number): number {
  return clock.anchorSim + (realMs - clock.anchorReal) * clock.rate
}

export function withRate(clock: Clock, rate: number, realMs: number): Clock {
  return { anchorReal: realMs, anchorSim: simTime(clock, realMs), rate }
}

export function scrubbedTo(clock: Clock, simMs: number, realMs: number): Clock {
  return { anchorReal: realMs, anchorSim: simMs, rate: clock.rate }
}

export function isLive(clock: Clock, realMs: number): boolean {
  return clock.rate === 1 && Math.abs(simTime(clock, realMs) - realMs) < 1000
}

export function formatOffset(simMs: number, realMs: number): string {
  const totalMinutes = Math.round((simMs - realMs) / 60_000)
  if (totalMinutes === 0) return 'now'
  const sign = totalMinutes < 0 ? '−' : '+'
  const abs = Math.abs(totalMinutes)
  const hours = Math.floor(abs / 60)
  const minutes = abs % 60
  const parts = [hours ? `${hours} h` : '', minutes ? `${minutes} min` : ''].filter(Boolean)
  return `${sign}${parts.join(' ')}`
}
