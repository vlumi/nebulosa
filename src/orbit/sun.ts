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
 * The latitude of the terminator at a longitude `deltaDeg` away from the antisolar meridian: the Sun is on the
 * horizon where tan(lat) = cos(Δ) / tan(decl). Night lies below it when the Sun is north of the equator, above
 * it when south.
 */
function terminatorLat(deltaDeg: number, declRad: number): number {
  return Math.atan(Math.cos(deltaDeg * RAD) / Math.tan(declRad)) * DEG
}

/**
 * The part of one grid cell that is night, given the terminator's latitude `a` at its west edge and `b` at its
 * east edge: the rectangle clipped by the straight line between them, with vertices wherever that line
 * crosses the cell's top or bottom. Night lies below the line when the Sun is north of the equator, above it
 * when south. Null when the cell is all day.
 */
function nightInCell(lon0: number, lon1: number, a: number, b: number, lat0: number, lat1: number, north: boolean) {
  // The cell edge that is certainly night: the bottom when night lies below the line, the top when above.
  const nightLimit = north ? lat0 : lat1
  if (north ? Math.max(a, b) <= lat0 : Math.min(a, b) >= lat1) return null
  const clamp = (lat: number) => Math.max(lat0, Math.min(lat1, lat))
  // Along the line from the east edge back to the west edge, note where it crosses the cell's top or bottom.
  const line: LonLat[] = [[lon1, clamp(b)]]
  const crossings = (b > a ? [lat1, lat0] : [lat0, lat1]).filter((lat) => lat > Math.min(a, b) && lat < Math.max(a, b))
  for (const lat of crossings) line.push([lon0 + ((lat - a) / (b - a)) * (lon1 - lon0), lat])
  line.push([lon0, clamp(a)])
  // The night side's own edge of the cell, then the terminator side of it.
  return ([[lon0, nightLimit], [lon1, nightLimit], ...line] as LonLat[]).filter(
    (point, i, ring) => i === 0 || point[0] !== ring[i - 1][0] || point[1] !== ring[i - 1][1],
  )
}

/**
 * The night side as cells `bandDeg` of latitude tall and `stepDeg` of longitude wide, each cut exactly along the
 * terminator where it passes through. Small pieces follow a sphere closely and can each be judged visible or
 * hidden on their own; anything wider than half the world confuses the globe renderer's grid cutter.
 */
export function nightCells(date: Date, bandDeg = 3, stepDeg = 3): LonLat[][] {
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
    for (let lat0 = -POLE; lat0 < POLE; lat0 += bandDeg) {
      const cell = nightInCell(lon[0], lon[1], a, b, lat0, Math.min(POLE, lat0 + bandDeg), north)
      if (cell && cell.length >= 3) cells.push(cell)
    }
  }
  return cells
}
