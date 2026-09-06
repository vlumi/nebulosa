import { epochOf } from './elements'
import { satelliteFrom } from './orbit'
import { computePasses, lookAt, nextPassOf, passesOver, upcomingPasses, type Pass } from './passes'
import { strix1, strix9 } from '../test/fixtures'

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
    expect(pass.offNadirDeg).toBeGreaterThan(0)
    expect(pass.offNadirDeg).toBeLessThan(90 - pass.maxElevationDeg)
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

test('a pass already in progress keeps its true rise time', () => {
  const sat = satelliteFrom(strix1)
  const [first] = passesOver(sat, tokyo, epochOf(strix1), 24)
  const midPass = new Date((first.startMs + first.endMs) / 2)
  const [inProgress] = passesOver(sat, tokyo, midPass, 24)
  expect(inProgress.startMs).toBeCloseTo(first.startMs, -3)
  expect(Math.abs(inProgress.peakMs - first.peakMs)).toBeLessThan(2000)
  expect(inProgress.endMs).toBeCloseTo(first.endMs, -3)
  expect(passesOver(sat, tokyo, new Date(first.endMs + 60_000), 24)[0].startMs).toBeGreaterThan(first.endMs)
})

test('a pass request computes the same list as the direct call', () => {
  const from = epochOf(strix1)
  const direct = upcomingPasses([strix1, strix9].map(satelliteFrom), tokyo, from, 12)
  const viaRequest = computePasses({
    id: 1,
    elements: [strix1, strix9],
    location: tokyo,
    fromMs: from.getTime(),
    hours: 12,
  })
  expect(viaRequest).toEqual(direct)
})

test('a pass in progress at the end of the horizon keeps its true set time', () => {
  const sat = satelliteFrom(strix1)
  const from = epochOf(strix1)
  const full = passesOver(sat, tokyo, from, 48)
  const cut = full.find((p) => p.startMs > from.getTime() + 3_600_000)!
  const hours = (cut.peakMs - from.getTime()) / 3_600_000
  const short = passesOver(sat, tokyo, from, hours)
  const last = short[short.length - 1]
  expect(last.startMs).toBe(cut.startMs)
  expect(last.endMs).toBe(cut.endMs)
  expect(last.peakMs).toBe(cut.peakMs)
  expect(short.every((p) => p.startMs < from.getTime() + hours * 3_600_000)).toBe(true)
})

test('the next pass at a moment is the first of that satellite still to end then, in progress or ahead', () => {
  const pass = (noradId: number, startMs: number, endMs: number) => ({ noradId, startMs, endMs }) as Pass
  const passes = [pass(1, 100, 200), pass(2, 150, 250), pass(1, 400, 500), pass(1, 700, 800)]
  expect(nextPassOf(passes, 1, 0)).toBe(passes[0])
  expect(nextPassOf(passes, 1, 150)).toBe(passes[0])
  expect(nextPassOf(passes, 1, 300)).toBe(passes[2])
  expect(nextPassOf(passes, 1, 500)).toBe(passes[3])
  expect(nextPassOf(passes, 1, 900)).toBeNull()
  expect(nextPassOf(passes, 3, 0)).toBeNull()
})
