import { bearingDeg, DEG, destination, EARTH_RADIUS_KM, RAD } from './geo'
import type { LonLat, TrackSample } from './orbit'

/** How far off nadir StriX can steer its beam, per Synspective's SAR data page; which side it looks is not published. */
export const STEERING = { minDeg: 15, maxDeg: 45 } as const

/** Ground distance from the sub-satellite point to where a look `offNadirDeg` off nadir meets the ground. */
export function groundOffsetKm(offNadirDeg: number, altKm: number): number {
  const look = offNadirDeg * RAD
  const incidence = Math.asin(((EARTH_RADIUS_KM + altKm) / EARTH_RADIUS_KM) * Math.sin(look))
  return EARTH_RADIUS_KM * (incidence - look)
}

/** The look angle off nadir at which the satellite sees a point that sees it at `elevationDeg`. */
export function offNadirForElevation(elevationDeg: number, altKm: number): number {
  return Math.asin((EARTH_RADIUS_KM / (EARTH_RADIUS_KM + altKm)) * Math.cos(elevationDeg * RAD)) * DEG
}

export function inReach(offNadirDeg: number): boolean {
  return offNadirDeg >= STEERING.minDeg && offNadirDeg <= STEERING.maxDeg
}

/** Two segments per polygon: small pieces follow the sphere closely, and none can fold over near the poles. */
const SAMPLES_PER_POLYGON = 2

/**
 * The ground the radar can reach along a track: a ribbon on each side, from the nearest to the farthest
 * look, as a run of small quads.
 */
export function reachRibbons(samples: TrackSample[]): LonLat[][] {
  if (samples.length < 2) return []
  const edges = samples.map((sample, i) => {
    const point = ([lon, lat]: LonLat) => ({ lon, lat })
    const heading =
      i < samples.length - 1
        ? bearingDeg(point(sample.lonLat), point(samples[i + 1].lonLat))
        : bearingDeg(point(samples[i - 1].lonLat), point(sample.lonLat))
    const near = groundOffsetKm(STEERING.minDeg, sample.altKm)
    const far = groundOffsetKm(STEERING.maxDeg, sample.altKm)
    const side = (turn: number): [LonLat, LonLat] => [
      destination(sample.lonLat, heading + turn, near),
      destination(sample.lonLat, heading + turn, far),
    ]
    return { left: side(-90), right: side(90) }
  })
  const polygons: LonLat[][] = []
  for (let start = 0; start < edges.length - 1; start += SAMPLES_PER_POLYGON) {
    const run = edges.slice(start, start + SAMPLES_PER_POLYGON + 1)
    for (const side of ['left', 'right'] as const) {
      polygons.push([...run.map((e) => e[side][0]), ...run.map((e) => e[side][1]).reverse()])
    }
  }
  return polygons
}
