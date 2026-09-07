import { ja } from '../i18n/strings'
import {
  compassPoint,
  dayLabel,
  formatAge,
  formatDuration,
  formatLocation,
  formatOffset,
  hhmm,
  utcMinute,
  utcSecond,
} from './format'

const t0 = Date.UTC(2026, 8, 4, 12, 0, 0)
const minute = 60_000

test('UTC time strings', () => {
  expect(hhmm(t0 + 5 * minute)).toBe('12:05')
  expect(utcMinute(t0)).toBe('2026-09-04 12:00')
  expect(utcSecond(t0 + 7000)).toBe('2026-09-04 12:00:07')
  expect(dayLabel(t0)).toBe('Fri 4 Sep')
})

test('age in hours, then days', () => {
  const from = new Date('2026-09-04T00:00:00Z')
  expect(formatAge(from, new Date('2026-09-04T00:30:00Z'))).toBe('under an hour')
  expect(formatAge(from, new Date('2026-09-05T13:00:00Z'))).toBe('37 h')
  expect(formatAge(from, new Date('2026-09-07T01:00:00Z'))).toBe('3 d')
})

test('offset from real time', () => {
  expect(formatOffset(t0, t0)).toBe('now')
  expect(formatOffset(t0 + 135 * minute, t0)).toBe('+2 h 15 min')
  expect(formatOffset(t0 - 45 * minute, t0)).toBe('−45 min')
  expect(formatOffset(t0 + 12 * 60 * minute, t0)).toBe('+12 h')
})

test('location with hemispheres', () => {
  expect(formatLocation({ lat: 35.68, lon: 139.69 })).toBe('35.68°N 139.69°E')
  expect(formatLocation({ lat: -33.87, lon: -70.65 })).toBe('33.87°S 70.65°W')
})

test('compass points', () => {
  expect(compassPoint(0)).toBe('N')
  expect(compassPoint(44)).toBe('NE')
  expect(compassPoint(180)).toBe('S')
  expect(compassPoint(359)).toBe('N')
  expect(compassPoint(-90)).toBe('W')
})

test('durations ahead: seconds under a minute, then minutes, then hours and minutes', () => {
  expect(formatDuration(45_000)).toBe('45 s')
  expect(formatDuration(23 * minute)).toBe('23 min')
  expect(formatDuration(72 * minute)).toBe('1 h 12 min')
  expect(formatDuration(120 * minute)).toBe('2 h')
  expect(formatDuration(-5_000)).toBe('0 s')
})

test('the same helpers in Japanese take their words and their day order from the dictionary', () => {
  const from = new Date('2026-09-04T00:00:00Z')
  expect(dayLabel(t0, ja)).toBe('9月4日 (金)')
  expect(formatAge(from, new Date('2026-09-04T00:30:00Z'), ja)).toBe('1時間未満')
  expect(formatAge(from, new Date('2026-09-05T13:00:00Z'), ja)).toBe('37時間')
  expect(formatAge(from, new Date('2026-09-07T01:00:00Z'), ja)).toBe('3日')
  expect(formatOffset(t0, t0, ja)).toBe(ja.time.now)
  expect(formatOffset(t0 + 135 * minute, t0, ja)).toBe('+2時間 15分')
  expect(formatOffset(t0 - 45 * minute, t0, ja)).toBe('−45分')
  expect(formatDuration(72 * minute, ja)).toBe('1時間 12分')
  expect(formatDuration(45_000, ja)).toBe('45秒')
  expect(compassPoint(225, ja)).toBe('南西')
})
