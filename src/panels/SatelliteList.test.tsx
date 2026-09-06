import { render, screen, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { satelliteFrom } from '../orbit/orbit'
import { SatelliteList } from './SatelliteList'
import { strix1, strix9 } from '../test/fixtures'

const sats = [strix1, strix9].map(satelliteFrom)
const now = new Date('2026-09-04T04:41:00Z')

test('shows no detail block until a satellite is selected', () => {
  render(
    <SatelliteList
      satellites={sats}
      now={now}
      selected={null}
      onSelect={vi.fn()}
      span={{ pastOrbits: 1, futureOrbits: 1 }}
      onSpanChange={vi.fn()}
      nextPass={null}
      passes={[]}
    />,
  )
  expect(screen.queryByRole('definition')).toBeNull()
})

test('describes the selected satellite in human terms', () => {
  render(
    <SatelliteList
      satellites={sats}
      now={now}
      selected={strix1.NORAD_CAT_ID}
      onSelect={vi.fn()}
      span={{ pastOrbits: 1, futureOrbits: 1 }}
      onSpanChange={vi.fn()}
      nextPass={null}
      passes={[]}
    />,
  )
  const detail = within(screen.getByLabelText('STRIX-1 details'))
  expect(detail.getByText('2022 · 2022-113A')).toBeInTheDocument()
  expect(detail.getByText('sun-synchronous, 97.44°')).toBeInTheDocument()
  expect(detail.getByText(/^4\d\d km$/)).toBeInTheDocument()
  expect(detail.getByText('93.3 min · 15.43 rev/day')).toBeInTheDocument()
  expect(detail.getByText('0.0002')).toBeInTheDocument()
  expect(detail.getByText('2026-09-03 20:40 UTC · 8 h old')).toBeInTheDocument()
})

test('the track span selects report a new span', async () => {
  const onSpanChange = vi.fn()
  render(
    <SatelliteList
      satellites={sats}
      now={now}
      selected={null}
      onSelect={vi.fn()}
      span={{ pastOrbits: 1, futureOrbits: 1 }}
      onSpanChange={onSpanChange}
      nextPass={null}
      passes={[]}
    />,
  )
  await userEvent.click(
    within(screen.getByRole('radiogroup', { name: 'Track ahead' })).getByRole('radio', { name: '3' }),
  )
  expect(onSpanChange).toHaveBeenCalledWith({ pastOrbits: 1, futureOrbits: 3 })
  await userEvent.click(
    within(screen.getByRole('radiogroup', { name: 'Track behind' })).getByRole('radio', { name: '½' }),
  )
  expect(onSpanChange).toHaveBeenCalledWith({ pastOrbits: 0.5, futureOrbits: 1 })
})

test('the selected satellite reads out where it is now, its next pass and its next terminator crossing', () => {
  const nextPass = {
    noradId: strix1.NORAD_CAT_ID,
    name: 'STRIX-1',
    startMs: Date.now() + 75 * 60_000,
    peakMs: Date.now() + 80 * 60_000,
    endMs: Date.now() + 85 * 60_000,
    maxElevationDeg: 40,
    peakAzimuthDeg: 90,
    offNadirDeg: 45,
  }
  render(
    <SatelliteList
      satellites={sats}
      now={now}
      selected={strix1.NORAD_CAT_ID}
      onSelect={vi.fn()}
      span={{ pastOrbits: 1, futureOrbits: 1 }}
      onSpanChange={vi.fn()}
      nextPass={nextPass}
      placeName="Tokyo"
      passes={[nextPass]}
    />,
  )
  const readout = within(screen.getByLabelText('STRIX-1 now'))
  expect(readout.getByText(/^\d+\.\d+°[NS] \d+\.\d+°[EW]$/)).toBeInTheDocument()
  expect(readout.getByText(/^\d{3} km$/)).toBeInTheDocument()
  expect(readout.getByText(/^7\.\d\d km\/s$/)).toBeInTheDocument()
  expect(readout.getByText(/^[NESW]{1,3} \d{1,3}°$/)).toBeInTheDocument()
  expect(readout.getByText(/^in 1 h 1[45] min · \d\d:\d\d UTC over Tokyo$/)).toBeInTheDocument()
  expect(readout.getByText(/^(day|night) in /)).toBeInTheDocument()
})
