import { nightStrips, subsolarPoint } from './sun'

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

test('night strips: the dark pole is a full ring, the lit pole has none, and the antisolar point is inside', () => {
  const june = new Date('2026-06-21T12:00:00Z')
  const strips = nightStrips(june)
  const southern = strips.find((ring) => ring[0][1] === -89.9)!
  expect(southern).toBeDefined()
  const lons = southern.map(([lon]) => lon)
  expect(Math.max(...lons) - Math.min(...lons)).toBeCloseTo(360, 6)
  expect(strips.some((ring) => ring.some(([, lat]) => lat > 89))).toBe(false)
  for (const ring of strips) {
    for (let i = 1; i < ring.length; i++) expect(Math.abs(ring[i][0] - ring[i - 1][0])).toBeLessThan(180)
    expect(new Set(ring.map(([, lat]) => lat)).size).toBe(2)
  }
  const { lon, lat } = subsolarPoint(june)
  const covers = (x: number, y: number) =>
    strips.some((ring) => {
      const lats = ring.map(([, l]) => l)
      const lo = Math.min(...ring.map(([l]) => l))
      const hi = Math.max(...ring.map(([l]) => l))
      const within = (v: number) => v >= lo && v <= hi
      return y >= Math.min(...lats) && y <= Math.max(...lats) && (within(x) || within(x + 360) || within(x - 360))
    })
  expect(covers(lon + 180, -lat)).toBe(true)
  expect(covers(lon, lat)).toBe(false)
})
