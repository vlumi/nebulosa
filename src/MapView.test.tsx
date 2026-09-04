import { act, render } from '@testing-library/react'
import { MapboxOverlay } from '@deck.gl/mapbox'
import { Map as MapLibre } from 'maplibre-gl'
import { epochOf } from './elements'
import { strix1, strix9 } from './test/fixtures'

const tokyo = { lat: 35.68, lon: 139.69 }
import { MapView } from './MapView'
import { positionAt, satelliteFrom } from './orbit'

const { mapInstance, overlayInstance, markerInstance } = vi.hoisted(() => {
  const markerInstance = {
    handlers: {} as Record<string, () => void>,
    lngLat: { lng: 0, lat: 0 },
    setLngLat: vi.fn(function (this: unknown, [lng, lat]: [number, number]) {
      markerInstance.lngLat = { lng, lat }
      return markerInstance
    }),
    addTo: vi.fn(() => markerInstance),
    on: vi.fn((event: string, handler: () => void) => {
      markerInstance.handlers[event] = handler
      return markerInstance
    }),
    getLngLat: vi.fn(() => markerInstance.lngLat),
  }
  return {
    mapInstance: { addControl: vi.fn(), remove: vi.fn(), easeTo: vi.fn() },
    overlayInstance: { setProps: vi.fn() },
    markerInstance,
  }
})
vi.mock('maplibre-gl', () => ({
  Map: vi.fn(function () { return mapInstance }),
  Marker: vi.fn(function () { return markerInstance }),
  NavigationControl: vi.fn(),
  setWorkerUrl: vi.fn(),
}))
vi.mock('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url', () => ({ default: '/worker.js' }))
vi.mock('@deck.gl/mapbox', () => ({ MapboxOverlay: vi.fn(function () { return overlayInstance }) }))

test('mounts a MapLibre map with a deck.gl overlay and feeds it the layers', () => {
  const sats = [strix1, strix9].map(satelliteFrom)
  const onSelect = vi.fn()
  const { container, unmount } = render(
    <MapView satellites={sats} now={epochOf(strix1)} selected={null} onSelect={onSelect} location={tokyo} onLocationChange={vi.fn()} />,
  )

  expect(MapLibre).toHaveBeenCalledWith(
    expect.objectContaining({ container: container.querySelector('.map'), style: expect.stringContaining('openfreemap') }),
  )
  expect(mapInstance.addControl).toHaveBeenCalledWith(overlayInstance)
  const layers = overlayInstance.setProps.mock.lastCall![0].layers
  expect(layers.map((l: { id: string }) => l.id)).toEqual(['night', 'tracks', 'positions', 'labels'])

  const overlayProps = vi.mocked(MapboxOverlay).mock.calls[0][0] as {
    onClick: (info: unknown) => void
    onHover: (info: unknown) => void
    pickingRadius: number
  }
  expect(overlayProps.pickingRadius).toBeGreaterThan(0)

  act(() => overlayProps.onHover({ layer: { id: 'tracks' }, object: { noradId: strix9.NORAD_CAT_ID }, coordinate: [0, 0] }))
  expect(overlayInstance.setProps.mock.lastCall![0].layers.map((l: { id: string }) => l.id)).toContain('hover-label')
  act(() => overlayProps.onHover({ layer: null, object: undefined }))
  expect(overlayInstance.setProps.mock.lastCall![0].layers.map((l: { id: string }) => l.id)).not.toContain('hover-label')
  overlayProps.onClick({ object: { noradId: strix9.NORAD_CAT_ID } })
  expect(onSelect).toHaveBeenCalledWith(strix9.NORAD_CAT_ID)
  overlayProps.onClick({ object: undefined })
  expect(onSelect).toHaveBeenCalledWith(null)

  unmount()
  expect(mapInstance.remove).toHaveBeenCalled()
})

test('a focus request eases the map to the satellite\'s current position', () => {
  const sats = [strix1, strix9].map(satelliteFrom)
  const at = epochOf(strix9)
  const { rerender } = render(
    <MapView satellites={sats} now={at} selected={null} onSelect={vi.fn()} focus={null} location={tokyo} onLocationChange={vi.fn()} />,
  )
  expect(mapInstance.easeTo).not.toHaveBeenCalled()

  rerender(
    <MapView satellites={sats} now={at} selected={strix9.NORAD_CAT_ID} onSelect={vi.fn()} focus={{ noradId: strix9.NORAD_CAT_ID, seq: 1 }} location={tokyo} onLocationChange={vi.fn()} />,
  )
  const expected = positionAt(sats[1], at)!
  const { center } = mapInstance.easeTo.mock.lastCall![0]
  expect(center[0]).toBeCloseTo(expected.lon, 6)
  expect(center[1]).toBeCloseTo(expected.lat, 6)
})

test('the observer pin starts at the location and reports where it is dragged', () => {
  const onLocationChange = vi.fn()
  render(<MapView satellites={[]} now={epochOf(strix1)} selected={null} onSelect={vi.fn()} location={tokyo} onLocationChange={onLocationChange} />)
  expect(markerInstance.setLngLat).toHaveBeenCalledWith([tokyo.lon, tokyo.lat])
  expect(markerInstance.addTo).toHaveBeenCalledWith(mapInstance)

  markerInstance.lngLat = { lng: 24.94, lat: 60.17 }
  markerInstance.handlers.dragend()
  expect(onLocationChange).toHaveBeenCalledWith({ lat: 60.17, lon: 24.94 })
})
