import { approach } from './smoothing'

test('closes most of the gap within a few time constants and then snaps', () => {
  let value = 0
  const target = 3_600_000
  for (let i = 0; i < 30; i++) value = approach(value, target, 16)
  expect(value).toBeGreaterThan(target * 0.95)
  expect(value).toBeLessThan(target)
  for (let i = 0; i < 60; i++) value = approach(value, target, 16)
  expect(value).toBe(target)
})

test('small differences snap immediately', () => {
  expect(approach(1000, 1200, 16)).toBe(1200)
})
