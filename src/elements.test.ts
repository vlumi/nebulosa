import { epochOf, newestEpoch } from './elements'
import { strix1, strix9 } from './test/fixtures'

test('reads the epoch as UTC, with or without a trailing Z', () => {
  expect(epochOf(strix1).toISOString()).toBe('2026-09-03T20:40:50.042Z')
  expect(epochOf({ ...strix1, EPOCH: '2026-09-03T20:40:50Z' }).toISOString()).toBe('2026-09-03T20:40:50.000Z')
})

test('picks the newest epoch across the set', () => {
  expect(newestEpoch([strix9, strix1])).toEqual(epochOf(strix1))
})
