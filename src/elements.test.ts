import { epochOf, formatAge, newestEpoch } from './elements'
import { strix1, strix9 } from './fixtures'

test('reads the epoch as UTC', () => {
  expect(epochOf(strix1).toISOString()).toBe('2026-09-03T20:40:50.042Z')
})

test('picks the newest epoch across the set', () => {
  expect(newestEpoch([strix9, strix1])).toEqual(epochOf(strix1))
})

test('formats age in hours, then days', () => {
  const t0 = new Date('2026-09-04T00:00:00Z')
  expect(formatAge(t0, new Date('2026-09-04T00:30:00Z'))).toBe('under an hour')
  expect(formatAge(t0, new Date('2026-09-05T13:00:00Z'))).toBe('37 h')
  expect(formatAge(t0, new Date('2026-09-07T01:00:00Z'))).toBe('3 d')
})
