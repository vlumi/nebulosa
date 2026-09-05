import { epochOf } from './elements'
import { strix1, strix9 } from '../test/fixtures'
import { nearestSample, positionAt, satelliteFrom, splitAtAntimeridian, trackSamples } from './orbit'

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
  const path = trackSamples(sat, epochOf(strix9), 30).map((s) => s.lonLat)
  expect(path.length).toBe(Math.floor((2 * sat.periodMinutes * 60) / 30) + 1)
  expect(path.some(([lon], i) => i > 0 && Math.abs(lon - path[i - 1][0]) > 180)).toBe(true)
  for (const [lon, lat] of path) {
    expect(Math.abs(lon)).toBeLessThanOrEqual(180)
    expect(Math.abs(lat)).toBeLessThanOrEqual(strix9.INCLINATION + 0.5)
  }
})

test('track samples carry increasing timestamps 30 s apart around the center', () => {
  const sat = satelliteFrom(strix1)
  const center = epochOf(strix1)
  const samples = trackSamples(sat, center, 30)
  expect(samples[0].timeMs).toBe(center.getTime() - sat.periodMinutes * 60_000)
  for (let i = 1; i < samples.length; i++) expect(samples[i].timeMs - samples[i - 1].timeMs).toBe(30_000)
})

test('nearest sample handles the antimeridian', () => {
  const samples = [
    { lonLat: [170, 0] as [number, number], timeMs: 0, altKm: 500 },
    { lonLat: [-179, 0] as [number, number], timeMs: 1, altKm: 500 },
    { lonLat: [0, 0] as [number, number], timeMs: 2, altKm: 500 },
  ]
  expect(nearestSample(samples, [179.5, 0.2])).toBe(1)
  expect(nearestSample(samples, [160, 0])).toBe(0)
})

test('the track span is configurable in orbits behind and ahead', () => {
  const sat = satelliteFrom(strix9)
  const center = epochOf(strix9)
  const samples = trackSamples(sat, center, 30, { pastOrbits: 0.5, futureOrbits: 2 })
  const periodMs = sat.periodMinutes * 60_000
  expect(samples[0].timeMs).toBe(center.getTime() - 0.5 * periodMs)
  expect(samples[samples.length - 1].timeMs).toBeGreaterThan(center.getTime() + 2 * periodMs - 30_000)
  expect(samples[samples.length - 1].timeMs).toBeLessThanOrEqual(center.getTime() + 2 * periodMs)
})

test('a path is cut at the antimeridian with the crossing point on both edges', () => {
  const pieces = splitAtAntimeridian([
    [170, 10],
    [178, 12],
    [-178, 14],
    [-170, 16],
    [175, 18],
  ])
  expect(pieces.map((piece) => piece.length)).toEqual([3, 4, 2])
  expect(pieces[0][2]).toEqual([180, 13])
  expect(pieces[1][0]).toEqual([-180, 13])
  expect(pieces[1][3][0]).toBe(-180)
  expect(pieces[1][3][1]).toBeCloseTo(17.333, 3)
  expect(pieces[2][0][0]).toBe(180)
  expect(splitAtAntimeridian([[0, 0]])).toEqual([])
})
