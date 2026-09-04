import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { PassList } from './PassList'
import { DEFAULT_FILTERS, type Pass } from '../orbit/passes'

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

test('lists passes with times, duration and max elevation; show and go-to are separate actions', async () => {
  const onShow = vi.fn()
  const onGoTo = vi.fn()
  const passes = [pass('STRIX-1', 53815, 5, 47.4), pass('STRIX-9', 100561, 90, 12.2)]
  render(
    <PassList
      location={{ lat: 35.68, lon: 139.69 }}
      passes={passes}
      filters={{ ...DEFAULT_FILTERS, onlySelected: false }}
      onFiltersChange={vi.fn()}
      familyOf={() => 'sun-synchronous'}
      onShow={onShow}
      onGoTo={onGoTo}
      now={new Date(t0)}
    />,
  )
  expect(screen.getByText(/over 35.68°N 139.69°E/)).toBeInTheDocument()
  const rows = screen.getAllByRole('listitem')
  expect(rows[0]).toHaveTextContent('12:05–12:13STRIX-1max 47° S')
  expect(rows[1]).toHaveTextContent('13:30–13:38STRIX-9max 12° S')

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
      location={{ lat: 0, lon: 0 }}
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
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Hours ahead' }), '48')
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
      location={{ lat: 0, lon: 0 }}
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
