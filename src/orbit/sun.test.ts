import type { LonLat } from './orbit'
import { nightCells, subsolarPoint } from './sun'

test('the subsolar point sits near the equator at equinox and under the noon meridian', () => {
  const equinoxNoon = new Date('2026-03-20T12:00:00Z')
  const sun = subsolarPoint(equinoxNoon)
  expect(Math.abs(sun.lat)).toBeLessThan(0.5)
  expect(Math.abs(sun.lon)).toBeLessThan(4)

  const juneNoonTokyo = new Date('2026-06-21T03:00:00Z')
  const june = subsolarPoint(juneNoonTokyo)
  expect(june.lat).toBeCloseTo(23.4, 0)
  expect(june.lon).toBeGreaterThan(130)
  expect(june.lon).toBeLessThan(140)
})

test('night cells: the dark pole is fully ringed, the lit pole has none, cells stay narrow, the antisolar point is inside', () => {
  const june = new Date('2026-06-21T12:00:00Z')
  const cells = nightCells(june)
  const southern = cells.filter((ring) => ring[0][1] === -89.9)
  const lons = southern.flatMap((ring) => ring.map(([lon]) => lon))
  expect(Math.max(...lons) - Math.min(...lons)).toBeCloseTo(360, 6)
  expect(cells.some((ring) => ring.some(([, lat]) => lat > 89))).toBe(false)
  for (const ring of cells) {
    const ringLons = ring.map(([lon]) => lon)
    expect(Math.max(...ringLons) - Math.min(...ringLons)).toBeLessThanOrEqual(3 + 1e-9)
    for (const [lon, lat] of ring) {
      expect(Math.abs(lat)).toBeLessThanOrEqual(89.9)
      expect(lon).toBeGreaterThanOrEqual(-180)
      expect(lon).toBeLessThanOrEqual(183)
    }
  }
  const { lon, lat } = subsolarPoint(june)
  const covers = (x: number, y: number) =>
    cells.some((ring) => {
      const lats = ring.map(([, l]) => l)
      const lo = Math.min(...ring.map(([l]) => l))
      const hi = Math.max(...ring.map(([l]) => l))
      const within = (v: number) => v >= lo && v <= hi
      return y >= Math.min(...lats) && y <= Math.max(...lats) && (within(x) || within(x + 360) || within(x - 360))
    })
  expect(covers(lon + 180, -lat)).toBe(true)
  expect(covers(lon, lat)).toBe(false)
})

/** Total latitude covered by night cells at a longitude, summing each cell's height at that longitude. */
function coveredAt(cells: LonLat[][], lon: number): number {
  let total = 0
  for (const ring of cells) {
    const lons = ring.map(([l]) => l)
    const lo = Math.min(...lons)
    const hi = Math.max(...lons)
    const x = [lon, lon + 360, lon - 360].find((v) => v >= lo && v <= hi)
    if (x === undefined) continue
    // Heights of the ring's edges at x: the polygon is convex in latitude, so top minus bottom is the coverage.
    const ys: number[] = []
    for (let i = 0; i < ring.length; i++) {
      const [x1, y1] = ring[i]
      const [x2, y2] = ring[(i + 1) % ring.length]
      if (x1 === x2) {
        if (x1 === x) ys.push(y1, y2)
      } else if ((x >= x1 && x <= x2) || (x >= x2 && x <= x1)) ys.push(y1 + ((x - x1) / (x2 - x1)) * (y2 - y1))
    }
    if (ys.length) total += Math.max(...ys) - Math.min(...ys)
  }
  return total
}

test('cells tile the night exactly: at any longitude the covered latitude equals the span below the terminator', () => {
  const date = new Date('2026-09-05T04:00:00Z')
  // Narrow columns, so the chord across each is close to the curve even where the terminator runs steeply.
  const cells = nightCells(date, 3, 0.25)
  const { lon: sunLon, lat: sunLat } = subsolarPoint(date)
  const decl = (sunLat * Math.PI) / 180
  for (const delta of [0.51, 17.23, 61.94, 88.41, 133.77, -45.13, -179.91]) {
    const lon = ((sunLon + 180 + delta + 540) % 360) - 180
    const terminator = (Math.atan(Math.cos((delta * Math.PI) / 180) / Math.tan(decl)) * 180) / Math.PI
    const expected = Math.max(0, Math.min(89.9, terminator) + 89.9)
    expect(coveredAt(cells, lon)).toBeCloseTo(expected, 1)
  }
})

test('every cell is a simple polygon: three to five distinct vertices, positive area, no spurs', () => {
  for (const iso of ['2026-06-21T12:00:00Z', '2026-09-05T04:00:00Z', '2026-12-21T00:00:00Z', '2026-03-20T09:00:00Z']) {
    for (const ring of nightCells(new Date(iso))) {
      expect(ring.length).toBeGreaterThanOrEqual(3)
      expect(ring.length).toBeLessThanOrEqual(5)
      expect(new Set(ring.map(([lon, lat]) => `${lon.toFixed(9)},${lat.toFixed(9)}`)).size).toBe(ring.length)
      let area = 0
      for (let i = 0; i < ring.length; i++) {
        const [x1, y1] = ring[i]
        const [x2, y2] = ring[(i + 1) % ring.length]
        area += x1 * y2 - x2 * y1
      }
      expect(Math.abs(area)).toBeGreaterThan(1e-9)
    }
  }
})
