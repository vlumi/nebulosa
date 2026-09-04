import { render, screen } from '@testing-library/react'
import App from './App'
import { strix1, strix9 } from './fixtures'

vi.mock('maplibre-gl', () => ({
  Map: vi.fn(function () { return { addControl: vi.fn(), remove: vi.fn() } }),
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
  expect(await screen.findByText('STRIX-1')).toBeInTheDocument()
  expect(screen.getByText('STRIX-9')).toBeInTheDocument()
  expect(screen.getByText(/2 satellites · elements from 2026-09-03 20:40 UTC/)).toBeInTheDocument()
  expect(fetch).toHaveBeenCalledWith('/data/elements.json')
})

test('reports a failed load', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })))
  render(<App />)
  expect(await screen.findByRole('alert')).toHaveTextContent('503')
})
