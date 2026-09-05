import { render, screen, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import App from './App'
import { resetApp, useApp } from './store'
import { strix1, strix9 } from './test/fixtures'
import { TOKYO } from './places/places'

vi.mock('maplibre-gl', () => ({
  Map: vi.fn(function () {
    return {
      addControl: vi.fn(),
      remove: vi.fn(),
      easeTo: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      isStyleLoaded: () => false,
      getSource: vi.fn(),
      getLayer: vi.fn(),
      setProjection: vi.fn(),
      getCenter: () => ({ lng: 139.7, lat: 35.7 }),
      getZoom: () => 1.5,
      getCanvas: () => ({ clientWidth: 1400, clientHeight: 900 }),
      queryRenderedFeatures: () => [],
      project: () => ({ x: 0, y: 0 }),
      unproject: () => ({ lng: 139.7, lat: 35.7 }),
    }
  }),
  Marker: vi.fn(function () {
    const marker = {
      setLngLat: () => marker,
      addTo: () => marker,
      on: () => marker,
      getLngLat: () => ({ lng: 0, lat: 0 }),
      getElement: () => document.createElement('div'),
      remove: () => {},
    }
    return marker
  }),
  NavigationControl: vi.fn(),
  setWorkerUrl: vi.fn(),
}))
vi.mock('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url', () => ({ default: '/worker.js' }))
vi.mock('@deck.gl/maplibre', () => ({
  MapLibreOverlay: vi.fn(function () {
    return { setProps: vi.fn() }
  }),
}))
afterEach(() => vi.unstubAllGlobals())
beforeEach(resetApp)

test('lists the constellation from /data/elements.json with the epoch age', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([strix1, strix9]))))
  render(<App />)
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('nebulosa')
  const panel = within(screen.getByRole('complementary', { name: 'Constellation' }))
  expect(await panel.findByText('STRIX-1')).toBeInTheDocument()
  expect(panel.getByText('STRIX-9')).toBeInTheDocument()
  expect(panel.getByText(/Elements from 2026-09-03 20:40 UTC/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^Satellites · 2/ })).toBeInTheDocument()
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
  expect(strix1Button.closest('li')).toHaveAttribute('data-dimmed')

  await userEvent.click(strix9Button)
  expect(strix9Button).toHaveAttribute('aria-pressed', 'false')
  expect(strix1Button.closest('li')).not.toHaveAttribute('data-dimmed')

  await userEvent.click(strix1Button)
  expect(strix1Button).toHaveAttribute('aria-pressed', 'true')
  await userEvent.keyboard('{Escape}')
  expect(screen.getByRole('button', { name: /^Places · none picked/ })).toBeInTheDocument()
  await userEvent.keyboard('{Escape}')
  expect(strix1Button).toHaveAttribute('aria-pressed', 'false')
})

test('reports a failed load', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })))
  render(<App />)
  expect(await screen.findByRole('alert')).toHaveTextContent('503')
})

const openPasses = async () => {
  await userEvent.click(await screen.findByRole('button', { name: /^Passes/ }))
  return within(await screen.findByRole('complementary', { name: 'Passes' }))
}

test('showing a pass selects the satellite without touching the clock; going to it pauses at the peak', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([strix1, strix9]))))
  render(<App />)
  const passes = await openPasses()
  expect(passes.getByText(/over Tokyo/)).toBeInTheDocument()
  const firstRow = (await passes.findAllByRole('listitem'))[0]

  await userEvent.click(firstRow.querySelector('button')!)
  expect(screen.getByRole('button', { name: /^Satellites STRIX-/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Live' })).toBeDisabled()
  expect(firstRow.querySelector('button')).toHaveAttribute('aria-current', 'true')
  expect(firstRow).not.toHaveAttribute('data-dimmed')
  expect(passes.getAllByRole('listitem')[1]).toHaveAttribute('data-dimmed')

  await userEvent.click(within(firstRow).getByRole('button', { name: /^Go to / }))
  expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Live' })).toBeEnabled()

  await userEvent.keyboard('{Escape}')
  expect(passes.queryByRole('button', { current: true })).toBeNull()
})

test('selecting a satellite narrows the pass list to it until the filter is turned off', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([strix1, strix9]))))
  render(<App />)
  let passes = await openPasses()
  const all = (await passes.findAllByRole('listitem')).length
  expect(all).toBeGreaterThan(1)
  expect(passes.queryByRole('checkbox', { name: /only / })).toBeNull()

  await userEvent.click(screen.getByRole('button', { name: /^Satellites/ }))
  const panel = within(screen.getByRole('complementary', { name: 'Constellation' }))
  await userEvent.click(panel.getByRole('button', { name: /STRIX-9/ }))
  expect(screen.getByRole('button', { name: /^Satellites STRIX-9/ })).toBeInTheDocument()
  passes = await openPasses()
  const narrowed = passes.getAllByRole('listitem')
  expect(narrowed.length).toBeLessThan(all)
  expect(narrowed.every((li) => li.textContent!.includes('STRIX-9'))).toBe(true)

  await userEvent.click(passes.getByRole('checkbox', { name: /only STRIX-9/ }))
  expect(passes.getAllByRole('listitem')).toHaveLength(all)
})

test('the swath filter keeps only the passes the radar can steer to', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([strix1, strix9]))))
  render(<App />)
  const passes = await openPasses()
  const all = (await passes.findAllByRole('listitem')).length
  await userEvent.click(passes.getByRole('radio', { name: 'in SAR reach' }))
  const reachable = passes.queryAllByRole('listitem')
  expect(reachable.length).toBeLessThan(all)
  expect(reachable.every((li) => li.querySelector('[data-reach]'))).toBe(true)
})

test('on a phone the map comes first: one sheet at a time, and choosing something closes it', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([strix1, strix9]))))
  vi.stubGlobal('matchMedia', () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
  render(<App />)
  await screen.findByRole('button', { name: /^Passes/ })
  expect(screen.queryByRole('complementary')).toBeNull()

  await userEvent.click(screen.getByRole('button', { name: /^Satellites/ }))
  expect(screen.getByRole('complementary', { name: 'Constellation' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /^Passes/ }))
  expect(screen.queryByRole('complementary', { name: 'Constellation' })).toBeNull()
  const passes = within(screen.getByRole('complementary', { name: 'Passes' }))

  const firstRow = (await passes.findAllByRole('listitem'))[0]
  await userEvent.click(firstRow.querySelector('button')!)
  expect(screen.queryByRole('complementary')).toBeNull()
  expect(screen.getByRole('button', { name: /^Passes STRIX-\d \d\d:\d\d/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^Satellites STRIX-/ })).toBeInTheDocument()
})

test('keyboard: arrows step through the open sheet, Enter goes to the pass, Space pauses, S and P switch sheets, Esc clears', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([strix1, strix9]))))
  render(<App />)
  const panel = within(screen.getByRole('complementary', { name: 'Constellation' }))
  await panel.findByText('STRIX-1')
  await screen.findByRole('button', { name: /^Passes · / })

  await userEvent.keyboard('{ArrowDown}')
  expect(panel.getByRole('button', { name: /STRIX-1/ })).toHaveAttribute('aria-pressed', 'true')
  await userEvent.keyboard('{ArrowDown}')
  expect(panel.getByRole('button', { name: /STRIX-9/ })).toHaveAttribute('aria-pressed', 'true')
  await userEvent.keyboard('{ArrowUp}')
  expect(panel.getByRole('button', { name: /STRIX-1/ })).toHaveAttribute('aria-pressed', 'true')

  await userEvent.keyboard('p')
  expect(screen.queryByRole('complementary', { name: 'Constellation' })).toBeNull()
  const passes = within(screen.getByRole('complementary', { name: 'Passes' }))
  await userEvent.keyboard('{ArrowDown}')
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
  expect(screen.getByRole('complementary', { name: 'Constellation' })).toBeInTheDocument()
  expect(screen.queryByRole('complementary', { name: 'Passes' })).toBeNull()
  await userEvent.keyboard('s')
  expect(screen.queryByRole('complementary')).toBeNull()
  await userEvent.keyboard('p')
  const reopened = within(screen.getByRole('complementary', { name: 'Passes' }))

  await userEvent.keyboard('o')
  expect(reopened.getByRole('checkbox', { name: /only STRIX-1/ })).not.toBeChecked()
  await userEvent.keyboard('o')
  expect(reopened.getByRole('checkbox', { name: /only STRIX-1/ })).toBeChecked()

  await userEvent.keyboard('?')
  expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeInTheDocument()
  await userEvent.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).toBeNull()

  await userEvent.keyboard('{Escape}')
  expect(reopened.queryByRole('button', { current: true })).toBeNull()
  await userEvent.keyboard('s')
  const constellation = within(screen.getByRole('complementary', { name: 'Constellation' }))
  expect(constellation.getByRole('button', { name: /STRIX-1/ })).toHaveAttribute('aria-pressed', 'true')
  await userEvent.keyboard('{Escape}')
  expect(screen.getByRole('button', { name: /^Places · none picked/ })).toBeInTheDocument()
  await userEvent.keyboard('{Escape}')
  expect(constellation.queryAllByRole('button', { pressed: true })).toHaveLength(0)
})

test('shortcuts keep working after clicking a button with the mouse', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([strix1, strix9]))))
  render(<App />)
  const panel = within(screen.getByRole('complementary', { name: 'Constellation' }))
  await userEvent.click(await panel.findByRole('button', { name: /STRIX-9/ }))
  expect(document.activeElement).toBe(document.body)
  await userEvent.keyboard(' ')
  expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
})

test('places: the pill names the selected place; with none, passes wait for one; removing a place unselects it', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([strix1, strix9]))))
  render(<App />)
  expect(screen.getByRole('button', { name: /^Places Tokyo/ })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /^Places/ }))
  const places = within(screen.getByRole('complementary', { name: 'Places' }))
  await userEvent.click(places.getByRole('button', { name: /^Tokyo/ }))
  expect(screen.getByRole('button', { name: /^Places · none picked/ })).toBeInTheDocument()
  const passes = await openPasses()
  expect(passes.getByText(/Pick a place/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /^Places/ }))
  await userEvent.click(
    within(screen.getByRole('complementary', { name: 'Places' })).getByRole('button', { name: 'Remove Tokyo' }),
  )
  expect(screen.getByRole('button', { name: /^Places · none$/ })).toBeInTheDocument()
})

test('keyboard: W opens the places sheet and the arrows then step through the places, flying to each', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([strix1, strix9]))))
  render(<App />)
  useApp.setState({ places: [TOKYO, { id: 'helsinki', name: 'Helsinki', lat: 60.17, lon: 24.94 }] })
  await screen.findByRole('button', { name: /^Passes · / })

  await userEvent.keyboard('w')
  const places = within(screen.getByRole('complementary', { name: 'Places' }))
  await userEvent.keyboard('{ArrowDown}')
  expect(places.getByRole('button', { name: /^Helsinki/ })).toHaveAttribute('aria-pressed', 'true')
  expect(useApp.getState().flyTo).toMatchObject({ lat: 60.17, lon: 24.94 })
  expect(screen.getByRole('button', { name: /^Places Helsinki/ })).toBeInTheDocument()
  await userEvent.keyboard('{ArrowUp}')
  expect(places.getByRole('button', { name: /^Tokyo/ })).toHaveAttribute('aria-pressed', 'true')
  await userEvent.keyboard('{Shift>}{ArrowDown}{/Shift}')
  expect(places.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
    expect.stringMatching(/^Helsinki/),
    expect.stringMatching(/^Tokyo/),
  ])
  expect(places.getByRole('button', { name: /^Tokyo/ })).toHaveAttribute('aria-pressed', 'true')

  await userEvent.keyboard('w')
  expect(screen.queryByRole('complementary')).toBeNull()
  await userEvent.keyboard('{ArrowDown}')
  expect(useApp.getState().selection.noradId).toBe(strix1.NORAD_CAT_ID)
  expect(screen.queryByRole('complementary')).toBeNull()
})
