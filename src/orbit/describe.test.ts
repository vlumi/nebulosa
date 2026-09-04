import { describeOrbit, formatAltitude } from './describe'
import { strix1, strix9 } from '../test/fixtures'

test('derives period, altitude and launch year from the elements', () => {
  const d = describeOrbit(strix1)
  expect(d.launchYear).toBe(2022)
  expect(d.periodMinutes).toBeCloseTo(93.32, 2)
  expect(d.semiMajorAxisKm).toBeCloseTo(6815, 0)
  expect(d.perigeeKm).toBeGreaterThan(435)
  expect(d.apogeeKm).toBeLessThan(442)
  expect(d.apogeeKm).toBeGreaterThan(d.perigeeKm)
  expect(d.epoch.toISOString()).toBe('2026-09-03T20:40:50.042Z')
  expect(formatAltitude(d)).toMatch(/^4[34]\d km$/)
})

test('shows perigee and apogee separately when they differ', () => {
  const d = describeOrbit({ ...strix9, ECCENTRICITY: 0.01 })
  expect(formatAltitude(d)).toMatch(/^\d+–\d+ km$/)
  expect(describeOrbit(strix9).launchYear).toBe(2026)
})
