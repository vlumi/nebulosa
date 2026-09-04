import { ecfToLookAngles, eciToEcf, gstime, propagate } from 'satellite.js'
import type { Omm } from './elements'
import { positionAt, satelliteFrom, type Satellite } from './orbit'
import { offNadirForElevation } from './swath'

const RAD = Math.PI / 180
const DEG = 180 / Math.PI

/** Choices for how far ahead the pass list looks. */
export const HORIZONS_H = [6, 12, 24, 48] as const
/** Choices for the least peak elevation a listed pass must reach. */
export const MIN_ELEVATIONS = [0, 10, 30, 45, 60] as const

/** How the pass list is narrowed. */
export interface PassFilters {
  horizonHours: number
  minElevationDeg: number
  /** Only the selected satellite's passes while one is selected. */
  onlySelected: boolean
  /** Only passes whose peak falls inside the radar's steering range. */
  inReachOnly: boolean
}

export const DEFAULT_FILTERS: PassFilters = {
  horizonHours: 24,
  minElevationDeg: 0,
  onlySelected: true,
  inReachOnly: false,
}

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
  /** The satellite's look angle off nadir toward the location at the peak. */
  offNadirDeg: number
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

/** Time in [lo, hi] where the satellite crosses the horizon, given it is below at one end and above at the other. */
function crossing(sat: Satellite, location: Location, lo: number, hi: number, rising: boolean): number {
  for (let i = 0; i < 20 && hi - lo > 500; i++) {
    const mid = (lo + hi) / 2
    const above = elevation(sat, location, mid) > 0
    if (above === rising) hi = mid
    else lo = mid
  }
  return (lo + hi) / 2
}

/** Longer than any low-Earth-orbit pass, so a pass in progress at `from` is found from its true rise. */
const LOOKBACK_MS = 20 * 60_000

/** Every pass above the horizon between `from` and `from + hours`, scanned every `stepSeconds`. */
export function passesOver(sat: Satellite, location: Location, from: Date, hours = 24, stepSeconds = 30): Pass[] {
  const passes: Pass[] = []
  const stepMs = stepSeconds * 1000
  const scanStartMs = from.getTime() - LOOKBACK_MS
  const endMs = from.getTime() + hours * 3_600_000
  const initial = elevation(sat, location, scanStartMs)
  let current: { startMs: number; peakMs: number; peakElevation: number } | null =
    initial > 0 ? { startMs: scanStartMs, peakMs: scanStartMs, peakElevation: initial } : null

  for (let t = scanStartMs + stepMs; t <= endMs; t += stepMs) {
    const el = elevation(sat, location, t)
    if (current === null && el > 0) {
      current = { startMs: crossing(sat, location, t - stepMs, t, true), peakMs: t, peakElevation: el }
    } else if (current !== null) {
      if (el > current.peakElevation) {
        current.peakMs = t
        current.peakElevation = el
      }
      if (el <= 0) {
        passes.push(finish(sat, location, current, crossing(sat, location, t - stepMs, t, false)))
        current = null
      }
    }
  }
  if (current !== null) passes.push(finish(sat, location, current, endMs))
  return passes.filter((pass) => pass.endMs > from.getTime())
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
    offNadirDeg: offNadirForElevation(peakElevation, positionAt(sat, new Date(peakMs))?.altKm ?? 500),
  }
}

export function upcomingPasses(satellites: Satellite[], location: Location, from: Date, hours = 24): Pass[] {
  return satellites.flatMap((sat) => passesOver(sat, location, from, hours)).sort((a, b) => a.startMs - b.startMs)
}

/** A pass computation as sent to the worker: plain data only, so it survives structured cloning. */
export interface PassRequest {
  id: number
  elements: Omm[]
  location: Location
  fromMs: number
  hours: number
}

export function computePasses({ elements, location, fromMs, hours }: PassRequest): Pass[] {
  return upcomingPasses(elements.map(satelliteFrom), location, new Date(fromMs), hours)
}
