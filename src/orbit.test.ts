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

test('ground track spans two orbits and never jumps across the antimeridian', () => {
  const sat = satelliteFrom(strix9)
  const segments = groundTrack(sat, epochOf(strix9), 30)
  const points = segments.flat()
  expect(points.length).toBe(Math.floor((2 * sat.periodMinutes * 60) / 30) + 1)
  expect(segments.length).toBeGreaterThan(1)
  for (const segment of segments) {
    for (let i = 1; i < segment.length; i++) {
      expect(Math.abs(segment[i][0] - segment[i - 1][0])).toBeLessThan(180)
    }
  }
  for (const [, lat] of points) expect(Math.abs(lat)).toBeLessThanOrEqual(strix9.INCLINATION + 0.5)
})
