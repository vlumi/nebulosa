import { gstime, jday, sunPos } from 'satellite.js'
import type { LonLat } from './orbit'

const DEG = 180 / Math.PI
const RAD = Math.PI / 180

export interface SubsolarPoint {
  lon: number
  lat: number
}

/** Where the Sun is straight overhead. */
export function subsolarPoint(date: Date): SubsolarPoint {
  const { rtasc, decl } = sunPos(jday(date))
  const lon = (((rtasc - gstime(date)) * DEG + 540) % 360) - 180
  return { lon, lat: decl * DEG }
}

/** Deck's Mercator view has no projection for exactly 90°; the globe cannot tell the difference. */
const POLE = 89.9

/**
 * Half the width in longitude of the night at `latDeg`, centered on the antisolar meridian: from the Sun's
 * elevation being negative, cos(Δlon) > tan(lat)·tan(decl). Beyond ±1 the whole parallel is day (0) or night (180).
 */
function nightHalfWidth(latDeg: number, declRad: number): number {
  const v = Math.tan(latDeg * RAD) * Math.tan(declRad)
  if (v >= 1) return 0
  if (v <= -1) return 180
  return Math.acos(v) * DEG
}

/**
 * The night side as strips `bandDeg` of latitude tall, their edges sampled every `stepDeg` of longitude and
 * continuing past ±180° rather than jumping. Small pieces follow a sphere closely; one big polygon, cut into 10°
 * cells by the globe renderer, sagged into the basemap and speckled.
 */
export function nightStrips(date: Date, bandDeg = 3, stepDeg = 3): LonLat[][] {
  const sun = subsolarPoint(date)
  const decl = sun.lat * RAD
  const anti = sun.lon + 180
  const edge = (lat: number, forward: boolean): LonLat[] => {
    const w = nightHalfWidth(lat, decl)
    if (w === 0) return []
    const n = Math.max(1, Math.ceil((2 * w) / stepDeg))
    const points: LonLat[] = []
    for (let i = 0; i <= n; i++) points.push([anti - w + (2 * w * i) / n, lat])
    return forward ? points : points.reverse()
  }
  const strips: LonLat[][] = []
  for (let lat0 = -POLE; lat0 < POLE; lat0 += bandDeg) {
    const lat1 = Math.min(POLE, lat0 + bandDeg)
    const bottom = edge(lat0, true)
    const top = edge(lat1, false)
    if (bottom.length === 0 && top.length === 0) continue
    // Where the night ends between the two latitudes, the strip tapers to a point on the antisolar meridian.
    strips.push([
      ...(bottom.length ? bottom : [[anti, lat0] as LonLat]),
      ...(top.length ? top : [[anti, lat1] as LonLat]),
    ])
  }
  return strips
}
