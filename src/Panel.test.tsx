import { render, screen, within } from '@testing-library/react'
import { satelliteFrom } from './orbit'
import { Panel } from './Panel'
import { strix1, strix9 } from './test/fixtures'

const sats = [strix1, strix9].map(satelliteFrom)
const now = new Date('2026-09-04T04:41:00Z')

test('shows no detail block until a satellite is selected', () => {
  render(<Panel satellites={sats} now={now} selected={null} onSelect={vi.fn()} />)
  expect(screen.queryByRole('definition')).toBeNull()
})

test('describes the selected satellite in human terms', () => {
  render(<Panel satellites={sats} now={now} selected={strix1.NORAD_CAT_ID} onSelect={vi.fn()} />)
  const detail = within(screen.getByLabelText('STRIX-1 details'))
  expect(detail.getByText('2022 · 2022-113A')).toBeInTheDocument()
  expect(detail.getByText('sun-synchronous, 97.44°')).toBeInTheDocument()
  expect(detail.getByText(/^4\d\d km$/)).toBeInTheDocument()
  expect(detail.getByText('93.3 min · 15.43 rev/day')).toBeInTheDocument()
  expect(detail.getByText('0.0002')).toBeInTheDocument()
  expect(detail.getByText('2026-09-03 20:40 UTC · 8 h old')).toBeInTheDocument()
})
