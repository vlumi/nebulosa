import { isLive, liveClock, scrubbedTo, simTime, withPaused, withRate } from './clock'

const t0 = Date.UTC(2026, 8, 4, 12, 0, 0)
const minute = 60_000

test('a live clock follows real time', () => {
  const clock = liveClock(t0)
  expect(simTime(clock, t0 + 5 * minute)).toBe(t0 + 5 * minute)
  expect(isLive(clock, t0 + 5 * minute)).toBe(true)
})

test('pausing freezes simulated time; resuming continues from there', () => {
  const paused = withPaused(liveClock(t0), true, t0 + 2 * minute)
  expect(simTime(paused, t0 + 10 * minute)).toBe(t0 + 2 * minute)
  expect(isLive(paused, t0 + 10 * minute)).toBe(false)

  const resumed = withPaused(paused, false, t0 + 10 * minute)
  expect(simTime(resumed, t0 + 11 * minute)).toBe(t0 + 3 * minute)
  expect(isLive(resumed, t0 + 11 * minute)).toBe(false)
})

test('a faster rate advances simulated time proportionally', () => {
  const fast = withRate(liveClock(t0), 60, t0)
  expect(simTime(fast, t0 + minute)).toBe(t0 + 60 * minute)
})

test('scrubbing jumps simulated time and keeps the rate', () => {
  const scrubbed = scrubbedTo(withRate(liveClock(t0), 10, t0), t0 - 3 * 60 * minute, t0)
  expect(simTime(scrubbed, t0)).toBe(t0 - 3 * 60 * minute)
  expect(simTime(scrubbed, t0 + minute)).toBe(t0 - 3 * 60 * minute + 10 * minute)
})

test('pausing keeps the chosen rate, and play resumes at it', () => {
  const paused = withPaused(withRate(liveClock(t0), 60, t0), true, t0 + minute)
  expect(paused.rate).toBe(60)
  expect(simTime(paused, t0 + 5 * minute)).toBe(t0 + 60 * minute)
  expect(isLive(paused, t0 + 5 * minute)).toBe(false)

  const resumed = withPaused(paused, false, t0 + 5 * minute)
  expect(simTime(resumed, t0 + 6 * minute)).toBe(t0 + 120 * minute)

  expect(isLive(withPaused(liveClock(t0), true, t0), t0)).toBe(false)
})
