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

/** One orbit before to one orbit after `center`, split where the path crosses the antimeridian. */
export function groundTrack(sat: Satellite, center: Date, stepSeconds = 30): LonLat[][] {
  const halfSpanMs = sat.periodMinutes * 60_000
  const segments: LonLat[][] = []
  let current: LonLat[] = []
  let previousLon: number | null = null
  for (let t = center.getTime() - halfSpanMs; t <= center.getTime() + halfSpanMs; t += stepSeconds * 1000) {
    const p = positionAt(sat, new Date(t))
    if (!p) continue
    if (previousLon !== null && Math.abs(p.lon - previousLon) > 180) {
      segments.push(current)
      current = []
    }
    current.push([p.lon, p.lat])
    previousLon = p.lon
  }
  if (current.length) segments.push(current)
  return segments
}
