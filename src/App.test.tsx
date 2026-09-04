import { render, screen, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import App from './App'
import { strix1, strix9 } from './test/fixtures'

vi.mock('maplibre-gl', () => ({
  Map: vi.fn(function () {
    return { addControl: vi.fn(), remove: vi.fn(), easeTo: vi.fn() }
  }),
  Marker: vi.fn(function () {
    const marker = {
      setLngLat: () => marker,
      addTo: () => marker,
      on: () => marker,
      getLngLat: () => ({ lng: 0, lat: 0 }),
    }
    return marker
  }),
  NavigationControl: vi.fn(),
  setWorkerUrl: vi.fn(),
}))
vi.mock('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url', () => ({ default: '/worker.js' }))
vi.mock('@deck.gl/mapbox', () => ({
  MapboxOverlay: vi.fn(function () {
    return { setProps: vi.fn() }
  }),
}))
afterEach(() => vi.unstubAllGlobals())

test('lists the constellation from /data/elements.json with the epoch age', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([strix1, strix9]))))
  render(<App />)
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('nebulosa')
  const panel = within(screen.getByRole('complementary', { name: 'Constellation' }))
  expect(await panel.findByText('STRIX-1')).toBeInTheDocument()
  expect(panel.getByText('STRIX-9')).toBeInTheDocument()
  expect(panel.getByText(/Elements from 2026-09-03 20:40 UTC/)).toBeInTheDocument()
  expect(panel.getByText(/· 2 · elements/)).toBeInTheDocument()
  expect(fetch).toHaveBeenCalledWith('/data/elements.json')
})

test('selecting a satellite in the panel highlights it and dims the rest', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([strix1, strix9]))))
  render(<App />)
  const panel = within(screen.getByRole('complementary', { name: 'Constellation' }))
  const strix9Button = await panel.findByRole('button', { name: /STRIX-9/ })
  const strix1Button = panel.getByRole('button', { name: /STRIX-1/ })

  await userEvent.click(strix9Button)
  expect(strix9Button).toHaveAttribute('aria-pressed', 'true')
  expect(strix1Button.closest('li')).toHaveClass('dimmed')

  await userEvent.click(strix9Button)
  expect(strix9Button).toHaveAttribute('aria-pressed', 'false')
  expect(strix1Button.closest('li')).not.toHaveClass('dimmed')

  await userEvent.click(strix1Button)
  expect(strix1Button).toHaveAttribute('aria-pressed', 'true')
  await userEvent.keyboard('{Escape}')
  expect(strix1Button).toHaveAttribute('aria-pressed', 'false')
})

test('reports a failed load', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })))
  render(<App />)
  expect(await screen.findByRole('alert')).toHaveTextContent('503')
})

test('showing a pass selects the satellite without touching the clock; going to it pauses at the peak', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([strix1, strix9]))))
  render(<App />)
  const passes = within(await screen.findByRole('complementary', { name: 'Passes' }))
  expect(passes.getByText(/Passes over 35.68°N 139.69°E/)).toBeInTheDocument()
  const firstRow = (await passes.findAllByRole('listitem'))[0]

  await userEvent.click(firstRow.querySelector('button')!)
  expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1)
  expect(screen.getByRole('button', { name: 'Live' })).toBeDisabled()
  expect(firstRow.querySelector('button')).toHaveAttribute('aria-current', 'true')
  expect(firstRow).not.toHaveClass('dimmed')
  expect(passes.getAllByRole('listitem')[1]).toHaveClass('dimmed')

  await userEvent.click(within(firstRow).getByRole('button', { name: /^Go to / }))
  expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Live' })).toBeEnabled()

  await userEvent.keyboard('{Escape}')
  expect(passes.queryByRole('button', { current: true })).toBeNull()
})

test('selecting a satellite narrows the pass list to it until the filter is turned off', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([strix1, strix9]))))
  render(<App />)
  const panel = within(screen.getByRole('complementary', { name: 'Constellation' }))
  const passes = within(await screen.findByRole('complementary', { name: 'Passes' }))
  const all = (await passes.findAllByRole('listitem')).length
  expect(all).toBeGreaterThan(1)
  expect(passes.queryByRole('checkbox')).toBeNull()

  await userEvent.click(panel.getByRole('button', { name: /STRIX-9/ }))
  const narrowed = passes.getAllByRole('listitem')
  expect(narrowed.length).toBeLessThan(all)
  expect(narrowed.every((li) => li.textContent!.includes('STRIX-9'))).toBe(true)

  await userEvent.click(passes.getByRole('checkbox', { name: /only STRIX-9/ }))
  expect(passes.getAllByRole('listitem')).toHaveLength(all)
})

test('the minimum-elevation filter drops low passes', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([strix1, strix9]))))
  render(<App />)
  const passes = within(await screen.findByRole('complementary', { name: 'Passes' }))
  const all = (await passes.findAllByRole('listitem')).length
  await userEvent.selectOptions(passes.getByRole('combobox', { name: 'Minimum elevation' }), '45')
  const high = passes.queryAllByRole('listitem')
  expect(high.length).toBeLessThan(all)
  expect(high.every((li) => Number(li.textContent!.match(/max (\d+)°/)![1]) >= 45)).toBe(true)
})

test('on a phone, opening one panel closes the other', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([strix1, strix9]))))
  const listeners: Array<() => void> = []
  vi.stubGlobal('matchMedia', () => ({
    matches: true,
    addEventListener: (_: string, fn: () => void) => listeners.push(fn),
    removeEventListener: vi.fn(),
  }))
  render(<App />)
  const satellites = within(screen.getByRole('complementary', { name: 'Constellation' }))
  const satellitesToggle = satellites.getByRole('button', { name: /^Satellites/ })
  expect(satellitesToggle).toHaveAttribute('aria-expanded', 'false')

  await userEvent.click(satellitesToggle)
  expect(satellitesToggle).toHaveAttribute('aria-expanded', 'true')
  const passes = within(await screen.findByRole('complementary', { name: 'Passes' }))
  const passesToggle = passes.getByRole('button', { name: /^Passes over/ })
  expect(passesToggle).toHaveAttribute('aria-expanded', 'false')

  await userEvent.click(passesToggle)
  expect(passesToggle).toHaveAttribute('aria-expanded', 'true')
  expect(satellitesToggle).toHaveAttribute('aria-expanded', 'false')
})

test('keyboard: arrows pick satellites, Shift-arrows pick passes, Enter goes there, Space pauses, S folds the panel, Esc clears', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([strix1, strix9]))))
  render(<App />)
  const panel = within(screen.getByRole('complementary', { name: 'Constellation' }))
  await panel.findByText('STRIX-1')
  const passes = within(screen.getByRole('complementary', { name: 'Passes' }))
  await passes.findAllByRole('listitem')

  await userEvent.keyboard('{ArrowDown}')
  expect(panel.getByRole('button', { name: /STRIX-1/ })).toHaveAttribute('aria-pressed', 'true')
  await userEvent.keyboard('{ArrowDown}')
  expect(panel.getByRole('button', { name: /STRIX-9/ })).toHaveAttribute('aria-pressed', 'true')
  await userEvent.keyboard('{ArrowUp}')
  expect(panel.getByRole('button', { name: /STRIX-1/ })).toHaveAttribute('aria-pressed', 'true')

  await userEvent.keyboard('{Shift>}{ArrowDown}{/Shift}')
  const rows = passes.getAllByRole('listitem')
  expect(rows[0].querySelector('button')).toHaveAttribute('aria-current', 'true')
  expect(screen.getByRole('button', { name: 'Live' })).toBeDisabled()

  await userEvent.keyboard('{Enter}')
  expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
  await userEvent.keyboard(' ')
  expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
  await userEvent.keyboard('l')
  expect(screen.getByRole('button', { name: 'Live' })).toBeDisabled()

  await userEvent.keyboard('s')
  expect(panel.getByRole('button', { name: /^Satellites/ })).toHaveAttribute('aria-expanded', 'false')
  await userEvent.keyboard('s')
  expect(panel.getByRole('button', { name: /^Satellites/ })).toHaveAttribute('aria-expanded', 'true')

  await userEvent.keyboard('{Escape}')
  expect(panel.queryAllByRole('button', { pressed: true })).toHaveLength(0)
})
