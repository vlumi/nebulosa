import { render } from '@testing-library/react'
import { MapboxOverlay } from '@deck.gl/mapbox'
import { Map as MapLibre } from 'maplibre-gl'
import { epochOf } from './elements'
import { strix1, strix9 } from './test/fixtures'
import { MapView } from './MapView'
import { satelliteFrom } from './orbit'

const { mapInstance, overlayInstance } = vi.hoisted(() => ({
  mapInstance: { addControl: vi.fn(), remove: vi.fn() },
  overlayInstance: { setProps: vi.fn() },
}))
vi.mock('maplibre-gl', () => ({
  Map: vi.fn(function () { return mapInstance }),
  NavigationControl: vi.fn(),
  setWorkerUrl: vi.fn(),
}))
vi.mock('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url', () => ({ default: '/worker.js' }))
vi.mock('@deck.gl/mapbox', () => ({ MapboxOverlay: vi.fn(function () { return overlayInstance }) }))

test('mounts a MapLibre map with a deck.gl overlay and feeds it the layers', () => {
  const sats = [strix1, strix9].map(satelliteFrom)
  const onSelect = vi.fn()
  const { container, unmount } = render(
    <MapView satellites={sats} now={epochOf(strix1)} selected={null} onSelect={onSelect} />,
  )

  expect(MapLibre).toHaveBeenCalledWith(
    expect.objectContaining({ container: container.querySelector('.map'), style: expect.stringContaining('openfreemap') }),
  )
  expect(mapInstance.addControl).toHaveBeenCalledWith(overlayInstance)
  const layers = overlayInstance.setProps.mock.lastCall![0].layers
  expect(layers.map((l: { id: string }) => l.id)).toEqual(['tracks', 'positions', 'labels'])

  const overlayProps = vi.mocked(MapboxOverlay).mock.calls[0][0] as { onClick: (info: unknown) => void }
  overlayProps.onClick({ object: { noradId: strix9.NORAD_CAT_ID } })
  expect(onSelect).toHaveBeenCalledWith(strix9.NORAD_CAT_ID)
  overlayProps.onClick({ object: undefined })
  expect(onSelect).toHaveBeenCalledWith(null)

  unmount()
  expect(mapInstance.remove).toHaveBeenCalled()
})
