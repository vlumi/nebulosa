import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { PassList } from './PassList'
import { DEFAULT_FILTERS, type Pass } from '../orbit/passes'
import { TOKYO } from '../places/places'

const t0 = Date.UTC(2026, 8, 4, 12, 0, 0)
const pass = (name: string, noradId: number, startMin: number, maxEl: number): Pass => ({
  noradId,
  name,
  startMs: t0 + startMin * 60_000,
  peakMs: t0 + (startMin + 4) * 60_000,
  endMs: t0 + (startMin + 8) * 60_000,
  maxElevationDeg: maxEl,
  peakAzimuthDeg: 180,
  offNadirDeg: maxEl >= 40 ? 30 : 60,
})

test('lists passes with times, duration and max elevation; show and go-to are separate actions', async () => {
  const onShow = vi.fn()
  const onGoTo = vi.fn()
  const passes = [pass('STRIX-1', 53815, 5, 47.4), pass('STRIX-9', 100561, 90, 12.2)]
  render(
    <PassList
      place={TOKYO}
      passes={passes}
      filters={{ ...DEFAULT_FILTERS, onlySelected: false }}
      onFiltersChange={vi.fn()}
      familyOf={() => 'sun-synchronous'}
      onShow={onShow}
      onGoTo={onGoTo}
      now={new Date(t0)}
    />,
  )
  expect(screen.getByText(/over Tokyo/)).toBeInTheDocument()
  const rows = screen.getAllByRole('listitem')
  expect(rows[0]).toHaveTextContent('12:05–12:13STRIX-147° S')
  expect(rows[1]).toHaveTextContent('13:30–13:38STRIX-912° S')

  await userEvent.click(rows[1].querySelector('button')!)
  expect(onShow).toHaveBeenCalledWith(passes[1])
  expect(onGoTo).not.toHaveBeenCalled()

  await userEvent.click(screen.getByRole('button', { name: 'Go to STRIX-9 pass at 13:34' }))
  expect(onGoTo).toHaveBeenCalledWith(passes[1])
})

test('shows every pass; the horizon and the selected-only filter are controls', async () => {
  const many = Array.from({ length: 13 }, (_, i) => pass('STRIX-1', 53815, i * 100, 30))
  const onFiltersChange = vi.fn()
  render(
    <PassList
      place={TOKYO}
      passes={many}
      filters={DEFAULT_FILTERS}
      onFiltersChange={onFiltersChange}
      selectedName="STRIX-1"
      familyOf={() => 'sun-synchronous'}
      onShow={vi.fn()}
      onGoTo={vi.fn()}
      now={new Date(t0)}
    />,
  )
  expect(screen.getAllByRole('listitem')).toHaveLength(13)
  await userEvent.click(screen.getByRole('radio', { name: '48 h' }))
  expect(onFiltersChange).toHaveBeenCalledWith({ ...DEFAULT_FILTERS, horizonHours: 48 })
  const only = screen.getByRole('checkbox', { name: /only STRIX-1/ })
  expect(only).toBeChecked()
  await userEvent.click(only)
  expect(onFiltersChange).toHaveBeenCalledWith({ ...DEFAULT_FILTERS, onlySelected: false })
})

test('a separator row marks where the list crosses into a later UTC day', () => {
  const passes = [pass('STRIX-1', 53815, 60, 30), pass('STRIX-1', 53815, 60 + 24 * 60, 30)]
  render(
    <PassList
      place={TOKYO}
      passes={passes}
      filters={{ ...DEFAULT_FILTERS, horizonHours: 48, onlySelected: false }}
      onFiltersChange={vi.fn()}
      familyOf={() => 'sun-synchronous'}
      onShow={vi.fn()}
      onGoTo={vi.fn()}
      now={new Date(t0)}
    />,
  )
  const rows = screen.getAllByRole('listitem')
  expect(rows[0]).not.toHaveTextContent('UTC')
  expect(rows[1]).toHaveTextContent('Sat 5 Sep UTC13:00–13:08')
})

test('a peak inside the steering range is marked and titled with its look angle; the reach filter is a control', async () => {
  const onFiltersChange = vi.fn()
  render(
    <PassList
      place={TOKYO}
      passes={[pass('STRIX-1', 53815, 5, 60), pass('STRIX-9', 100561, 90, 20)]}
      filters={DEFAULT_FILTERS}
      onFiltersChange={onFiltersChange}
      familyOf={() => 'sun-synchronous'}
      onShow={vi.fn()}
      onGoTo={vi.fn()}
      now={new Date(t0)}
    />,
  )
  expect(screen.getByTitle('30° off nadir at the peak, within SAR reach')).toHaveAttribute('data-reach')
  expect(screen.getByTitle('60° off nadir at the peak')).not.toHaveAttribute('data-reach')
  await userEvent.click(screen.getByRole('checkbox', { name: 'in SAR reach' }))
  expect(onFiltersChange).toHaveBeenCalledWith({ ...DEFAULT_FILTERS, inReachOnly: true })
})
