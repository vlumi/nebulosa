import { ecfToLookAngles, eciToEcf, gstime, propagate } from 'satellite.js'
import type { Satellite } from './orbit'

const RAD = Math.PI / 180
const DEG = 180 / Math.PI

export interface Location {
  lat: number
  lon: number
}

/** One period of geometric visibility above the horizon: not an imaging opportunity, just line of sight. */
export interface Pass {
  noradId: number
  name: string
  startMs: number
  peakMs: number
  endMs: number
  maxElevationDeg: number
  peakAzimuthDeg: number
}

interface Look {
  elevationDeg: number
  azimuthDeg: number
}

export function lookAt(sat: Satellite, location: Location, timeMs: number): Look | null {
  const pv = propagate(sat.satrec, new Date(timeMs))
  if (!pv) return null
  const observer = { latitude: location.lat * RAD, longitude: location.lon * RAD, height: 0 }
  const angles = ecfToLookAngles(observer, eciToEcf(pv.position, gstime(new Date(timeMs))))
  return { elevationDeg: angles.elevation * DEG, azimuthDeg: angles.azimuth * DEG }
}

function elevation(sat: Satellite, location: Location, timeMs: number): number {
  return lookAt(sat, location, timeMs)?.elevationDeg ?? -90
}

/** Time in [lo, hi] where elevation crosses `threshold`, given it is below at `lo` and above at `hi` (or vice versa). */
function crossing(sat: Satellite, location: Location, lo: number, hi: number, threshold: number, rising: boolean): number {
  for (let i = 0; i < 20 && hi - lo > 500; i++) {
    const mid = (lo + hi) / 2
    const above = elevation(sat, location, mid) > threshold
    if (above === rising) hi = mid
    else lo = mid
  }
  return (lo + hi) / 2
}

export function passesOver(
  sat: Satellite,
  location: Location,
  from: Date,
  hours = 24,
  minElevationDeg = 0,
  stepSeconds = 30,
): Pass[] {
  const passes: Pass[] = []
  const stepMs = stepSeconds * 1000
  const endMs = from.getTime() + hours * 3_600_000
  const initial = elevation(sat, location, from.getTime())
  let current: { startMs: number; peakMs: number; peakElevation: number } | null =
    initial > minElevationDeg ? { startMs: from.getTime(), peakMs: from.getTime(), peakElevation: initial } : null

  for (let t = from.getTime() + stepMs; t <= endMs; t += stepMs) {
    const el = elevation(sat, location, t)
    if (current === null && el > minElevationDeg) {
      current = { startMs: crossing(sat, location, t - stepMs, t, minElevationDeg, true), peakMs: t, peakElevation: el }
    } else if (current !== null) {
      if (el > current.peakElevation) {
        current.peakMs = t
        current.peakElevation = el
      }
      if (el <= minElevationDeg) {
        passes.push(finish(sat, location, current, crossing(sat, location, t - stepMs, t, minElevationDeg, false)))
        current = null
      }
    }
  }
  if (current !== null) passes.push(finish(sat, location, current, endMs))
  return passes
}

function finish(
  sat: Satellite,
  location: Location,
  pass: { startMs: number; peakMs: number; peakElevation: number },
  endMs: number,
): Pass {
  let { peakMs, peakElevation } = pass
  for (let t = pass.peakMs - 30_000; t <= pass.peakMs + 30_000; t += 1000) {
    const el = elevation(sat, location, t)
    if (el > peakElevation) {
      peakElevation = el
      peakMs = t
    }
  }
  return {
    noradId: sat.omm.NORAD_CAT_ID,
    name: sat.omm.OBJECT_NAME,
    startMs: pass.startMs,
    peakMs,
    endMs,
    maxElevationDeg: peakElevation,
    peakAzimuthDeg: lookAt(sat, location, peakMs)?.azimuthDeg ?? 0,
  }
}

export function upcomingPasses(satellites: Satellite[], location: Location, from: Date, hours = 24): Pass[] {
  return satellites
    .flatMap((sat) => passesOver(sat, location, from, hours))
    .sort((a, b) => a.startMs - b.startMs)
}
