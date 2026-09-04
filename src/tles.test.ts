import { formatAge, newestEpoch, tleEpoch } from './tles'

const strix1 = '1 53815U 22113A   26246.86169031  .00017698  00000+0  40157-3 0  9995'
const strix5 = '1 65971U 25229A   26246.23087356  .00002054  00000+0  15413-3 0  9999'

test('decodes the TLE epoch as UTC', () => {
  expect(tleEpoch(strix1).toISOString()).toMatch(/^2026-09-03T20:40:50/)
})

test('picks the newest epoch across the set', () => {
  const tles = [strix5, strix1].map((line1) => ({ name: '', noradId: 0, line1, line2: '' }))
  expect(newestEpoch(tles)).toEqual(tleEpoch(strix1))
})

test('formats age in hours, then days', () => {
  const t0 = new Date('2026-09-04T00:00:00Z')
  expect(formatAge(t0, new Date('2026-09-04T00:30:00Z'))).toBe('under an hour')
  expect(formatAge(t0, new Date('2026-09-05T13:00:00Z'))).toBe('37 h')
  expect(formatAge(t0, new Date('2026-09-07T01:00:00Z'))).toBe('3 d')
})
