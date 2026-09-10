import { epochOf } from './elements'
import { positionAt, satelliteFrom } from './orbit'
import { isDaylit, nextTerminatorCrossing, stateAt } from './readout'
import { subsolarPoint } from './sun'
import { strix1, strix9 } from '../test/fixtures'

test('a low orbit moves at about 7.6 km/s, and the state agrees with the position', () => {
  const sat = satelliteFrom(strix1)
  const at = epochOf(strix1)
  const state = stateAt(sat, at)!
  const position = positionAt(sat, at)!
  expect(state.speedKmS).toBeGreaterThan(7.4)
  expect(state.speedKmS).toBeLessThan(7.8)
  expect(state.lat).toBeCloseTo(position.lat, 6)
  expect(state.lon).toBeCloseTo(position.lon, 6)
  expect(state.altKm).toBeCloseTo(position.altKm, 6)
  expect(state.headingDeg).toBeGreaterThanOrEqual(0)
  expect(state.headingDeg).toBeLessThan(360)
})

test('the ground under the sun is lit and its antipode is dark', () => {
  const at = new Date('2026-09-04T12:00:00Z')
  const sun = subsolarPoint(at)
  expect(isDaylit(sun, at)).toBe(true)
  expect(isDaylit({ lat: -sun.lat, lon: sun.lon + 180 }, at)).toBe(false)
})

test('every low orbit crosses the terminator within one period, and the crossing is where daylight flips', () => {
  for (const omm of [strix1, strix9]) {
    const sat = satelliteFrom(omm)
    const fromMs = epochOf(omm).getTime()
    const crossing = nextTerminatorCrossing(sat, fromMs)!
    expect(crossing.timeMs).toBeGreaterThan(fromMs)
    expect(crossing.timeMs).toBeLessThan(fromMs + sat.periodMinutes * 60_000 + 30_000)
    const before = isDaylit(positionAt(sat, new Date(crossing.timeMs - 2000))!, new Date(crossing.timeMs - 2000))
    const after = isDaylit(positionAt(sat, new Date(crossing.timeMs + 2000))!, new Date(crossing.timeMs + 2000))
    expect(before).not.toBe(after)
    expect(crossing.into).toBe(after ? 'day' : 'night')
  }
})
