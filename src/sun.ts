import { gstime, jday, sunPos } from 'satellite.js'
import type { LonLat } from './orbit'

const DEG = 180 / Math.PI
const RAD = Math.PI / 180
/** Web Mercator cannot show the poles; the night polygon is closed here instead of at ±90°. */
const POLE_CAP = 85

export interface SubsolarPoint {
  lon: number
  lat: number
}

/** Where the Sun is straight overhead. */
export function subsolarPoint(date: Date): SubsolarPoint {
  const { rtasc, decl } = sunPos(jday(date))
  const lon = ((rtasc - gstime(date)) * DEG + 540) % 360 - 180
  return { lon, lat: decl * DEG }
}

/**
 * The night side as a polygon: the terminator curve sampled per degree of longitude, closed
 * over the pole that is in darkness. tan(lat) = -cos(lon - lon_sun) / tan(decl).
 */
export function nightPolygon(date: Date, stepDeg = 1): LonLat[] {
  const sun = subsolarPoint(date)
  const decl = sun.lat * RAD
  const darkPole = sun.lat >= 0 ? -POLE_CAP : POLE_CAP
  const curve: LonLat[] = []
  for (let lon = -180; lon <= 180; lon += stepDeg) {
    const lat = Math.atan(-Math.cos((lon - sun.lon) * RAD) / Math.tan(decl)) * DEG
    curve.push([lon, Math.max(-POLE_CAP, Math.min(POLE_CAP, lat))])
  }
  return [...curve, [180, darkPole], [-180, darkPole], curve[0]]
}
