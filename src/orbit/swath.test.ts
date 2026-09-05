import type { TrackSample } from './orbit'
import { groundOffsetKm, inReach, offNadirForElevation, reachRibbons, STEERING } from './swath'

test('a look off nadir lands hundreds of kilometers to the side, farther the steeper the look', () => {
  expect(groundOffsetKm(15, 500)).toBeCloseTo(134, -1)
  expect(groundOffsetKm(30, 500)).toBeCloseTo(290, -1)
  expect(groundOffsetKm(45, 500)).toBeCloseTo(524, -1)
  expect(groundOffsetKm(30, 437)).toBeLessThan(groundOffsetKm(30, 514))
})

test('the off-nadir look at the peak follows from the peak elevation: overhead is nadir, 40° is the edge of reach', () => {
  expect(offNadirForElevation(90, 500)).toBeCloseTo(0, 6)
  expect(offNadirForElevation(40.3, 500)).toBeCloseTo(STEERING.maxDeg, 0)
  expect(offNadirForElevation(73.8, 500)).toBeCloseTo(STEERING.minDeg, 0)
  expect(inReach(offNadirForElevation(82, 500))).toBe(false)
  expect(inReach(offNadirForElevation(60, 500))).toBe(true)
  expect(inReach(offNadirForElevation(31, 500))).toBe(false)
})

test('ribbons lie beside the track on both sides, between the near and the far look', () => {
  const eastward: TrackSample[] = Array.from({ length: 41 }, (_, i) => ({
    lonLat: [i * 2, 0],
    timeMs: i * 30_000,
    altKm: 500,
  }))
  const polygons = reachRibbons(eastward)
  expect(polygons).toHaveLength(40)
  const [left, right] = polygons
  expect(left).toHaveLength(6)
  const kmPerDeg = 111.2
  for (const ring of polygons.filter((_, i) => i % 2 === 0)) {
    for (const [, lat] of ring) {
      expect(lat * kmPerDeg).toBeGreaterThan(130)
      expect(lat * kmPerDeg).toBeLessThan(530)
    }
  }
  for (const [, lat] of right) expect(lat).toBeLessThan(-1)
  expect(reachRibbons(eastward.slice(0, 1))).toEqual([])
})

test('ribbons wrap longitude and may reach the pole', () => {
  const polar: TrackSample[] = Array.from({ length: 5 }, (_, i) => ({
    lonLat: [178 + i, 83 + i * 0.5],
    timeMs: i,
    altKm: 500,
  }))
  for (const [lon, lat] of reachRibbons(polar).flat()) {
    expect(Math.abs(lon)).toBeLessThanOrEqual(180)
    expect(Math.abs(lat)).toBeLessThanOrEqual(90)
  }
})
