import type { Clock } from './clock'
import { startFrameLoop, useFrame } from './frame'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

test('the frame loop writes real time each frame, eases the displayed time to the clock, registers one frame per tick, and stops when told', () => {
  const ticks: FrameRequestCallback[] = []
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((cb: FrameRequestCallback) => ticks.push(cb)),
  )
  const cancel = vi.fn()
  vi.stubGlobal('cancelAnimationFrame', cancel)
  const t0 = Date.UTC(2026, 8, 4, 12, 0, 0)
  const target = t0 + 3_600_000
  vi.spyOn(Date, 'now').mockReturnValue(t0)
  vi.spyOn(performance, 'now').mockReturnValue(1000)
  useFrame.setState({ nowMs: 0, timeMs: t0 })
  const clock: Clock = { anchorReal: t0, anchorSim: target, rate: 1, paused: false }

  const stop = startFrameLoop(() => clock)
  expect(ticks).toHaveLength(1)

  ticks[0](1016)
  const first = useFrame.getState()
  expect(first.nowMs).toBe(t0)
  expect(first.timeMs).toBeGreaterThan(t0)
  expect(first.timeMs).toBeLessThan(target)
  expect(ticks).toHaveLength(2)

  for (let i = 1; i < 200; i++) ticks[i](1016 + i * 16)
  expect(useFrame.getState().timeMs).toBe(target)
  expect(ticks).toHaveLength(201)

  stop()
  expect(cancel).toHaveBeenCalledWith(201)
})
