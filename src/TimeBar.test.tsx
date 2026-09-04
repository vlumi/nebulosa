import { fireEvent, render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { liveClock, scrubbedTo, simTime, withRate } from './clock'
import { TimeBar } from './TimeBar'

const t0 = new Date('2026-09-04T12:00:00Z')
const hour = 3_600_000

test('live: the live button is disabled and the readout shows real time', () => {
  render(<TimeBar clock={liveClock(t0.getTime())} now={t0} onChange={vi.fn()} />)
  expect(screen.getByRole('button', { name: 'Live' })).toBeDisabled()
  expect(screen.getByRole('status')).toHaveTextContent('2026-09-04 12:00:00 UTC · now')
})

test('pause, speed and scrub produce the corresponding clocks', async () => {
  const onChange = vi.fn()
  render(<TimeBar clock={liveClock(t0.getTime())} now={t0} onChange={onChange} />)

  await userEvent.click(screen.getByRole('button', { name: 'Pause' }))
  expect(onChange.mock.lastCall![0].rate).toBe(0)

  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Speed' }), '60')
  expect(onChange.mock.lastCall![0].rate).toBe(60)

  fireEvent.change(screen.getByRole('slider', { name: 'Time offset' }), { target: { value: String(2 * hour) } })
  expect(simTime(onChange.mock.lastCall![0], t0.getTime())).toBe(t0.getTime() + 2 * hour)
})

test('a scrubbed, paused clock shows its offset and can go back to live', async () => {
  const onChange = vi.fn()
  const clock = scrubbedTo(withRate(liveClock(t0.getTime()), 0, t0.getTime()), t0.getTime() - 3 * hour, t0.getTime())
  render(<TimeBar clock={clock} now={t0} onChange={onChange} />)
  expect(screen.getByRole('status')).toHaveTextContent('2026-09-04 09:00:00 UTC · −3 h')
  expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Live' }))
  expect(onChange.mock.lastCall![0]).toEqual(liveClock(t0.getTime()))
})
