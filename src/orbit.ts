import { degreesLat, degreesLong, eciToGeodetic, gstime, json2satrec, propagate, type SatRec } from 'satellite.js'
import type { Omm } from './elements'

export type OrbitFamily = 'sun-synchronous' | 'mid-inclination'

export interface Satellite {
  omm: Omm
  satrec: SatRec
  periodMinutes: number
  family: OrbitFamily
}

export interface GeoPoint {
  lon: number
  lat: number
  altKm: number
}

export type LonLat = [number, number]

export function satelliteFrom(omm: Omm): Satellite {
  return {
    omm,
    satrec: json2satrec(omm),
    periodMinutes: 1440 / omm.MEAN_MOTION,
    family: omm.INCLINATION > 80 ? 'sun-synchronous' : 'mid-inclination',
  }
}

export function positionAt(sat: Satellite, date: Date): GeoPoint | null {
  const pv = propagate(sat.satrec, date)
  if (!pv) return null
  const geo = eciToGeodetic(pv.position, gstime(date))
  return { lon: degreesLong(geo.longitude), lat: degreesLat(geo.latitude), altKm: geo.height }
}

export interface TrackSample {
  lonLat: LonLat
  timeMs: number
}

/** How far a drawn track reaches behind and ahead of the satellite, in orbital periods. */
export interface TrackSpan {
  pastOrbits: number
  futureOrbits: number
}

export const DEFAULT_SPAN: TrackSpan = { pastOrbits: 1, futureOrbits: 1 }
export const SPAN_CHOICES = [0.25, 0.5, 1, 2, 3] as const

/** Positions every `stepSeconds` from `fromMs` to `toMs`; longitudes stay in [-180, 180], the renderer wraps. */
export function trackSamplesBetween(sat: Satellite, fromMs: number, toMs: number, stepSeconds = 30): TrackSample[] {
  const samples: TrackSample[] = []
  for (let t = fromMs; t <= toMs; t += stepSeconds * 1000) {
    const p = positionAt(sat, new Date(t))
    if (p) samples.push({ lonLat: [p.lon, p.lat], timeMs: t })
  }
  return samples
}

/** `span.pastOrbits` before to `span.futureOrbits` after `center`. */
export function trackSamples(
  sat: Satellite,
  center: Date,
  stepSeconds = 30,
  span: TrackSpan = DEFAULT_SPAN,
): TrackSample[] {
  const periodMs = sat.periodMinutes * 60_000
  return trackSamplesBetween(
    sat,
    center.getTime() - span.pastOrbits * periodMs,
    center.getTime() + span.futureOrbits * periodMs,
    stepSeconds,
  )
}

/** Index of the sample closest to `lonLat`, measured in degrees with longitude wrapped. */
export function nearestSample(samples: TrackSample[], [lon, lat]: LonLat): number {
  let best = 0
  let bestDistance = Infinity
  samples.forEach(({ lonLat: [sLon, sLat] }, i) => {
    const dLon = Math.min(Math.abs(sLon - lon), 360 - Math.abs(sLon - lon)) * Math.cos((lat * Math.PI) / 180)
    const d = dLon * dLon + (sLat - lat) * (sLat - lat)
    if (d < bestDistance) {
      bestDistance = d
      best = i
    }
  })
  return best
}
