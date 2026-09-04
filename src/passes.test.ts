import { epochOf } from './elements'
import { satelliteFrom } from './orbit'
import { lookAt, passesOver, upcomingPasses } from './passes'
import { strix1, strix9 } from './test/fixtures'

const tokyo = { lat: 35.68, lon: 139.69 }
const tromso = { lat: 69.65, lon: 18.96 }

test('a sun-synchronous satellite passes Tokyo a few times a day, each pass a few minutes long', () => {
  const sat = satelliteFrom(strix1)
  const passes = passesOver(sat, tokyo, epochOf(strix1), 24)
  expect(passes.length).toBeGreaterThanOrEqual(2)
  expect(passes.length).toBeLessThanOrEqual(8)
  for (const pass of passes) {
    expect(pass.startMs).toBeLessThan(pass.peakMs)
    expect(pass.peakMs).toBeLessThan(pass.endMs)
    const minutes = (pass.endMs - pass.startMs) / 60_000
    expect(minutes).toBeGreaterThan(1)
    expect(minutes).toBeLessThan(15)
    expect(pass.maxElevationDeg).toBeGreaterThan(0)
    expect(pass.maxElevationDeg).toBeLessThanOrEqual(90)
    expect(Math.abs(lookAt(sat, tokyo, pass.startMs)!.elevationDeg)).toBeLessThan(0.5)
    expect(lookAt(sat, tokyo, pass.peakMs)!.elevationDeg).toBeCloseTo(pass.maxElevationDeg, 6)
  }
  for (let i = 1; i < passes.length; i++) expect(passes[i].startMs).toBeGreaterThan(passes[i - 1].endMs)
})

test('a 38° orbit never rises above the horizon at Tromsø', () => {
  expect(passesOver(satelliteFrom(strix9), tromso, epochOf(strix9), 24)).toEqual([])
})

test('upcoming passes across the constellation are sorted by start time', () => {
  const passes = upcomingPasses([strix1, strix9].map(satelliteFrom), tokyo, epochOf(strix1), 24)
  expect(new Set(passes.map((p) => p.name))).toEqual(new Set(['STRIX-1', 'STRIX-9']))
  for (let i = 1; i < passes.length; i++) expect(passes[i].startMs).toBeGreaterThanOrEqual(passes[i - 1].startMs)
})
