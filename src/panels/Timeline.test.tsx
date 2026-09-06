import { fireEvent, render, screen } from '@testing-library/react'
import { satelliteFrom } from '../orbit/orbit'
import { useFrame } from '../time/frame'
import { strix1 } from '../test/fixtures'
import { Timeline } from './Timeline'
import { daylightStretches } from '../orbit/readout'

const sat = satelliteFrom(strix1)
const span = { pastOrbits: 1, futureOrbits: 1 }

test('day and night alternate along one orbit', () => {
  const fromMs = Date.parse('2026-09-04T12:00:00Z')
  const stretches = daylightStretches(sat, fromMs, fromMs + sat.periodMinutes * 60_000)
  expect(stretches.length).toBeGreaterThanOrEqual(2)
  expect(stretches.length).toBeLessThanOrEqual(3)
  stretches.forEach((s, i) => {
    if (i > 0) expect(s.lit).not.toBe(stretches[i - 1].lit)
    if (i > 0) expect(s.fromMs).toBe(stretches[i - 1].toMs)
  })
})

test('the strip shows the passes in its window and pointing at it moves the probe', () => {
  const nowMs = Date.parse('2026-09-04T12:00:00Z')
  useFrame.setState({ timeMs: nowMs })
  const onProbe = vi.fn()
  const inWindow = {
    noradId: 53815,
    name: 'STRIX-1',
    startMs: nowMs + 600_000,
    peakMs: nowMs + 900_000,
    endMs: nowMs + 1_200_000,
    maxElevationDeg: 50,
    peakAzimuthDeg: 90,
    offNadirDeg: 30,
  }
  const outside = {
    ...inWindow,
    startMs: nowMs + 10 * 3_600_000,
    peakMs: nowMs + 10 * 3_600_000,
    endMs: nowMs + 10 * 3_600_000 + 60_000,
  }
  render(<Timeline satellite={sat} span={span} passes={[inWindow, outside]} probeMs={null} onProbe={onProbe} />)
  const strip = screen.getByRole('slider', { name: 'Time along the track' })
  expect(strip.querySelectorAll('rect').length).toBeGreaterThan(2)
  const titles = [...strip.querySelectorAll('title')].map((t) => t.textContent)
  expect(titles).toHaveLength(1)
  expect(titles[0]).toBe('Pass 12:10–12:20 UTC, 50° peak')

  vi.spyOn(strip, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 200 } as DOMRect)
  strip.setPointerCapture = vi.fn()
  fireEvent.pointerDown(strip, { clientX: 100, pointerId: 1, buttons: 1 })
  expect(onProbe).toHaveBeenLastCalledWith(nowMs)
  fireEvent.pointerMove(strip, { clientX: 200, pointerId: 1, buttons: 1 })
  expect(onProbe).toHaveBeenLastCalledWith(Math.round((nowMs + sat.periodMinutes * 60_000) / 1000) * 1000)
  fireEvent.doubleClick(strip)
  expect(onProbe).toHaveBeenLastCalledWith(null)

  strip.focus()
  fireEvent.keyDown(strip, { key: 'ArrowRight' })
  expect(onProbe).toHaveBeenLastCalledWith(nowMs + 30_000)
  fireEvent.keyDown(strip, { key: 'ArrowLeft', shiftKey: true })
  expect(onProbe).toHaveBeenLastCalledWith(nowMs - 5 * 60_000)
})
