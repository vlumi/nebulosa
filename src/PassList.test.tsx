import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { PassList } from './PassList'
import { formatLocation, type Pass } from './passes'

const t0 = Date.UTC(2026, 8, 4, 12, 0, 0)
const pass = (name: string, noradId: number, startMin: number, maxEl: number): Pass => ({
  noradId,
  name,
  startMs: t0 + startMin * 60_000,
  peakMs: t0 + (startMin + 4) * 60_000,
  endMs: t0 + (startMin + 8) * 60_000,
  maxElevationDeg: maxEl,
  peakAzimuthDeg: 180,
})

test('formats a location with hemispheres', () => {
  expect(formatLocation({ lat: 35.68, lon: 139.69 })).toBe('35.68°N 139.69°E')
  expect(formatLocation({ lat: -33.87, lon: -70.65 })).toBe('33.87°S 70.65°W')
})

test('lists passes with times, duration and max elevation; show and go-to are separate actions', async () => {
  const onShow = vi.fn()
  const onGoTo = vi.fn()
  const passes = [pass('STRIX-1', 53815, 5, 47.4), pass('STRIX-9', 100561, 90, 12.2)]
  render(
    <PassList location={{ lat: 35.68, lon: 139.69 }} passes={passes} familyOf={() => 'sun-synchronous'} onShow={onShow} onGoTo={onGoTo} />,
  )
  expect(screen.getByRole('heading')).toHaveTextContent('Passes over 35.68°N 139.69°E')
  const rows = screen.getAllByRole('listitem')
  expect(rows[0]).toHaveTextContent('12:05–12:13STRIX-18 min · max 47°')
  expect(rows[1]).toHaveTextContent('13:30–13:38STRIX-98 min · max 12°')

  await userEvent.click(rows[1].querySelector('button')!)
  expect(onShow).toHaveBeenCalledWith(passes[1])
  expect(onGoTo).not.toHaveBeenCalled()

  await userEvent.click(screen.getByRole('button', { name: 'Go to STRIX-9 pass at 13:34' }))
  expect(onGoTo).toHaveBeenCalledWith(passes[1])
})

test('caps the list and says how many more there are', () => {
  const many = Array.from({ length: 13 }, (_, i) => pass('STRIX-1', 53815, i * 100, 30))
  render(<PassList location={{ lat: 0, lon: 0 }} passes={many} familyOf={() => 'sun-synchronous'} onShow={vi.fn()} onGoTo={vi.fn()} limit={10} />)
  expect(screen.getAllByRole('listitem')).toHaveLength(10)
  expect(screen.getByText('and 3 more')).toBeInTheDocument()
})
