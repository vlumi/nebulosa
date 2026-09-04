import { render, screen, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import App from './App'
import { strix1, strix9 } from './test/fixtures'

vi.mock('maplibre-gl', () => ({
  Map: vi.fn(function () { return { addControl: vi.fn(), remove: vi.fn(), easeTo: vi.fn() } }),
  Marker: vi.fn(function () {
    const marker = { setLngLat: () => marker, addTo: () => marker, on: () => marker, getLngLat: () => ({ lng: 0, lat: 0 }) }
    return marker
  }),
  NavigationControl: vi.fn(),
  setWorkerUrl: vi.fn(),
}))
vi.mock('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url', () => ({ default: '/worker.js' }))
vi.mock('@deck.gl/mapbox', () => ({ MapboxOverlay: vi.fn(function () { return { setProps: vi.fn() } }) }))
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
  const firstRow = passes.getAllByRole('listitem')[0]

  await userEvent.click(firstRow.querySelector('button')!)
  expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1)
  expect(screen.getByRole('button', { name: 'Live' })).toBeDisabled()

  await userEvent.click(within(firstRow).getByRole('button', { name: /^Go to / }))
  expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Live' })).toBeEnabled()
})
