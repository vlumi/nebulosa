import { epochOf } from './elements'
import { strix1, strix9 } from './fixtures'
import { groundTrack, positionAt, satelliteFrom } from './orbit'

test('derives period and orbit family from the elements', () => {
  const s1 = satelliteFrom(strix1)
  expect(s1.periodMinutes).toBeCloseTo(93.32, 2)
  expect(s1.family).toBe('sun-synchronous')
  expect(satelliteFrom(strix9).family).toBe('mid-inclination')
})

test('propagates to a low-Earth-orbit position at epoch', () => {
  const p = positionAt(satelliteFrom(strix1), epochOf(strix1))
  expect(p).not.toBeNull()
  expect(p!.altKm).toBeGreaterThan(350)
  expect(p!.altKm).toBeLessThan(650)
  expect(Math.abs(p!.lat)).toBeLessThanOrEqual(strix1.INCLINATION)
  expect(Math.abs(p!.lon)).toBeLessThanOrEqual(180)
})

test('ground track spans two orbits with longitudes kept in range', () => {
  const sat = satelliteFrom(strix9)
  const path = groundTrack(sat, epochOf(strix9), 30)
  expect(path.length).toBe(Math.floor((2 * sat.periodMinutes * 60) / 30) + 1)
  expect(path.some(([lon], i) => i > 0 && Math.abs(lon - path[i - 1][0]) > 180)).toBe(true)
  for (const [lon, lat] of path) {
    expect(Math.abs(lon)).toBeLessThanOrEqual(180)
    expect(Math.abs(lat)).toBeLessThanOrEqual(strix9.INCLINATION + 0.5)
  }
})
