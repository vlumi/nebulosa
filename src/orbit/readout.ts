import { eciToGeodetic, gstime, propagate } from 'satellite.js'
import { positionAt, type GeoPoint, type Satellite } from './orbit'
import { initialBearing } from 'geo-coord'
import { DEG, RAD } from './geo'
import { subsolarPoint } from './sun'

export interface SatelliteState extends GeoPoint {
  speedKmS: number
  /** Direction of travel over the ground, clockwise from north. */
  headingDeg: number
}

const coordinates = ({ lat, lon }: { lat: number; lon: number }) => ({ latitude: lat, longitude: lon })

/** Where the satellite is, how fast it moves and which way it heads, at one moment. */
export function stateAt(sat: Satellite, date: Date): SatelliteState | null {
  const pv = propagate(sat.satrec, date)
  if (!pv || typeof pv.velocity !== 'object') return null
  const geo = eciToGeodetic(pv.position, gstime(date))
  const here = { lon: geo.longitude * DEG, lat: geo.latitude * DEG, altKm: geo.height }
  const next = positionAt(sat, new Date(date.getTime() + 1000))
  const { x, y, z } = pv.velocity
  return {
    ...here,
    speedKmS: Math.hypot(x, y, z),
    headingDeg: next ? initialBearing(coordinates(here), coordinates(next)) : 0,
  }
}

/** Whether the ground at a point is on the day side: the sun is above its horizon. */
export function isDaylit(point: { lat: number; lon: number }, date: Date): boolean {
  const sun = subsolarPoint(date)
  const cosDistance =
    Math.sin(point.lat * RAD) * Math.sin(sun.lat * RAD) +
    Math.cos(point.lat * RAD) * Math.cos(sun.lat * RAD) * Math.cos((point.lon - sun.lon) * RAD)
  return cosDistance > 0
}

export interface TerminatorCrossing {
  timeMs: number
  into: 'day' | 'night'
}

/** The next moment the ground track crosses the terminator, within one orbit; null if it never does. */
export function nextTerminatorCrossing(sat: Satellite, fromMs: number, stepSeconds = 30): TerminatorCrossing | null {
  const lit = (ms: number) => {
    const p = positionAt(sat, new Date(ms))
    return p ? isDaylit(p, new Date(ms)) : null
  }
  const start = lit(fromMs)
  if (start === null) return null
  const stepMs = stepSeconds * 1000
  const endMs = fromMs + sat.periodMinutes * 60_000 + stepMs
  for (let t = fromMs + stepMs; t <= endMs; t += stepMs) {
    if (lit(t) === start) continue
    let lo = t - stepMs
    let hi = t
    while (hi - lo > 1000) {
      const mid = (lo + hi) / 2
      if (lit(mid) === start) lo = mid
      else hi = mid
    }
    return { timeMs: hi, into: start ? 'night' : 'day' }
  }
  return null
}

export interface Stretch {
  fromMs: number
  toMs: number
  lit: boolean
}

/** Day and night along the ground track, one stretch per run of lit or unlit minutes. */
export function daylightStretches(satellite: Satellite, fromMs: number, toMs: number, stepMs = 60_000): Stretch[] {
  const stretches: Stretch[] = []
  for (let t = fromMs; t < toMs; t += stepMs) {
    const p = positionAt(satellite, new Date(t))
    if (!p) continue
    const lit = isDaylit(p, new Date(t))
    const last = stretches[stretches.length - 1]
    if (last && last.lit === lit) last.toMs = Math.min(t + stepMs, toMs)
    else stretches.push({ fromMs: t, toMs: Math.min(t + stepMs, toMs), lit })
  }
  return stretches
}
