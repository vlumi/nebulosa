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

/** Web Mercator, and so MapLibre's fills, end here; the polar caps beyond are drawn by deck.gl. */
export const POLE_CAP = 85
/** Deck's Mercator view has no projection for exactly 90°; the globe cannot tell the difference. */
const POLE = 89.9
const SEAM = 0.5

/**
 * The latitude of the terminator at a longitude `deltaDeg` away from the antisolar meridian: the Sun is on the
 * horizon where tan(lat) = cos(Δ) / tan(decl). Night lies below it when the Sun is north of the equator, above
 * it when south.
 */
function terminatorLat(deltaDeg: number, declRad: number): number {
  return Math.atan(Math.cos(deltaDeg * RAD) / Math.tan(declRad)) * DEG
}

/**
 * The part of one grid cell that is night, given the terminator's latitude `a` at its west edge and `b` at its
 * east edge: the cell rectangle clipped against the straight line between them (Sutherland–Hodgman, one edge),
 * night lying below the line when the Sun is north of the equator and above it when south. Null when all day.
 */
function nightInCell(lon0: number, lon1: number, a: number, b: number, lat0: number, lat1: number, north: boolean) {
  const lineAt = (lon: number) => a + ((lon - lon0) / (lon1 - lon0)) * (b - a)
  const inside = ([lon, lat]: LonLat) => (north ? lat <= lineAt(lon) : lat >= lineAt(lon))
  const corners: LonLat[] = [
    [lon0, lat0],
    [lon1, lat0],
    [lon1, lat1],
    [lon0, lat1],
  ]
  const clipped: LonLat[] = []
  corners.forEach((p, i) => {
    const q = corners[(i + 1) % 4]
    const pIn = inside(p)
    if (pIn) clipped.push(p)
    if (pIn !== inside(q)) {
      // A vertical edge meets the line at its own longitude; a horizontal one where the line reaches its latitude.
      clipped.push(p[0] === q[0] ? [p[0], lineAt(p[0])] : [lon0 + ((p[1] - a) / (b - a)) * (lon1 - lon0), p[1]])
    }
  })
  return clipped.length >= 3 ? clipped : null
}

/**
 * The night side as cells `bandDeg` of latitude tall and `stepDeg` of longitude wide, each cut exactly along the
 * terminator where it passes through. Small pieces follow a sphere closely and can each be judged visible or
 * hidden on their own; anything wider than half the world confuses the globe renderer's grid cutter.
 */
export function nightCells(date: Date, bandDeg = 3, stepDeg = 3, fromLat = -POLE, toLat = POLE): LonLat[][] {
  const sun = subsolarPoint(date)
  const decl = sun.lat * RAD
  const north = decl >= 0
  const cells: LonLat[][] = []
  for (let delta = -180; delta < 180; delta += stepDeg) {
    const edge = [delta, Math.min(180, delta + stepDeg)]
    const [a, b] = edge.map((d) => terminatorLat(d, decl))
    // Longitudes of this column, brought back to within a turn of the antimeridian.
    const lon = edge.map((d) => ((sun.lon + 180 + d + 540) % 360) - 180)
    if (lon[1] < lon[0]) lon[1] += 360
    for (let lat0 = fromLat; lat0 < toLat; lat0 += bandDeg) {
      const cell = nightInCell(lon[0], lon[1], a, b, lat0, Math.min(toLat, lat0 + bandDeg), north)
      if (cell && cell.length >= 3) cells.push(cell)
    }
  }
  return cells
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
  // Half a degree past the antimeridian on each side, so the fill's two halves overlap instead of meeting at a
  // hairline seam between tiles.
  for (let lon = -180 - SEAM; lon <= 180 + SEAM; lon += stepDeg) {
    const lat = Math.atan(-Math.cos((lon - sun.lon) * RAD) / Math.tan(decl)) * DEG
    curve.push([lon, Math.max(-POLE_CAP, Math.min(POLE_CAP, lat))])
  }
  return [...curve, [180 + SEAM, darkPole], [-180 - SEAM, darkPole], curve[0]]
}

/** The night in the two polar caps, beyond what MapLibre's Mercator fills can reach, as cells for deck.gl. */
export function polarNightCells(date: Date): LonLat[][] {
  const band = (POLE - POLE_CAP) / 2
  return [...nightCells(date, band, 3, POLE_CAP, POLE), ...nightCells(date, band, 3, -POLE, -POLE_CAP)]
}
