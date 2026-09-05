import { nightPolygon, subsolarPoint } from './sun'

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

test('the night polygon covers the antisolar point and leaves the subsolar point out', () => {
  const date = new Date('2026-09-04T04:00:00Z')
  const sun = subsolarPoint(date)
  const polygon = nightPolygon(date)
  const inside = (lon: number, lat: number) => {
    let hit = false
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i]
      const [xj, yj] = polygon[j]
      if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) hit = !hit
    }
    return hit
  }
  const antisolarLon = sun.lon > 0 ? sun.lon - 180 : sun.lon + 180
  expect(inside(antisolarLon, -sun.lat)).toBe(true)
  expect(inside(sun.lon, sun.lat)).toBe(false)
  expect(polygon[0]).toEqual(polygon[polygon.length - 1])
})

test('the night polygon closes over whichever pole is dark: south in June, north in December', () => {
  const closing = (iso: string) => nightPolygon(new Date(iso)).at(-2)![1]
  expect(closing('2026-06-21T12:00:00Z')).toBe(-85)
  expect(closing('2026-12-21T12:00:00Z')).toBe(85)
})
