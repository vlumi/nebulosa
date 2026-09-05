import { act, render } from '@testing-library/react'
import { MapLibreOverlay } from '@deck.gl/maplibre'
import { Map as MapLibre } from 'maplibre-gl'
import { epochOf } from '../orbit/elements'
import { strix1, strix9 } from '../test/fixtures'

const tokyo = { lat: 35.68, lon: 139.69 }
const tokyoPlace = { id: 'tokyo', name: 'Tokyo', ...tokyo }
import { fitZoom, horizonDeg, measureHorizonDeg } from './fit'
import { MapView } from './MapView'
import { positionAt, satelliteFrom } from '../orbit/orbit'

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
    element: document.createElement('div'),
    getElement: vi.fn(() => markerInstance.element),
    remove: vi.fn(),
  }
  return {
    mapInstance: {
      addControl: vi.fn(),
      remove: vi.fn(),
      easeTo: vi.fn(),
      handlers: {} as Record<string, () => void>,
      on: vi.fn(function (this: unknown, event: string, handler: () => void) {
        mapInstance.handlers[event] = handler
      }),
      off: vi.fn(),
      sources: {} as Record<string, { setData: ReturnType<typeof vi.fn> }>,
      addSource: vi.fn((id: string) => {
        mapInstance.sources[id] = { setData: vi.fn() }
      }),
      getSource: vi.fn((id: string) => mapInstance.sources[id]),
      addLayer: vi.fn(),
      getLayer: vi.fn((id: string) => (mapInstance.sources[id] ? { id } : undefined)),
      setPaintProperty: vi.fn(),
      zoom: 1.5,
      getZoom: vi.fn(() => mapInstance.zoom),
      getCanvas: vi.fn(() => ({ clientWidth: 640, clientHeight: 480, width: 1280, height: 960 })),
      getCenter: vi.fn(() => ({ lng: 139.7, lat: 35.7 })),
      unproject: vi.fn(() => ({ lng: 139.7, lat: 35.7 })),
      labels: [] as unknown[],
      queryRenderedFeatures: vi.fn(() => mapInstance.labels),
      project: vi.fn(([lon, lat]: [number, number]) => ({ x: lon, y: lat })),
      projection: undefined as { type: string } | undefined,
      getProjection: vi.fn(() => mapInstance.projection),
      setProjection: vi.fn((projection: { type: string }) => {
        mapInstance.projection = projection
      }),
    },
    overlayInstance: { setProps: vi.fn() },
    markerInstance,
  }
})
vi.mock('maplibre-gl', () => ({
  Map: vi.fn(function () {
    return mapInstance
  }),
  Marker: vi.fn(function () {
    return markerInstance
  }),
  NavigationControl: vi.fn(),
  setWorkerUrl: vi.fn(),
}))
vi.mock('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url', () => ({ default: '/worker.js' }))
vi.mock('@deck.gl/maplibre', () => ({
  MapLibreOverlay: vi.fn(function () {
    return overlayInstance
  }),
}))

test('mounts a MapLibre map with a deck.gl overlay and feeds it the layers', () => {
  const sats = [strix1, strix9].map(satelliteFrom)
  const onSelect = vi.fn()
  const { container, unmount } = render(
    <MapView
      satellites={sats}
      now={epochOf(strix1)}
      selected={null}
      onSelect={onSelect}
      places={[tokyoPlace]}
      placeId="tokyo"
      onPlaceSelect={vi.fn()}
      onPlaceMove={vi.fn()}
      onPlaceAdd={vi.fn()}
    />,
  )

  expect(MapLibre).toHaveBeenCalledWith(
    expect.objectContaining({
      container: container.querySelector('.map'),
      style: expect.stringContaining('openfreemap'),
    }),
  )
  expect(mapInstance.addControl).toHaveBeenCalledWith(overlayInstance)
  const layers = overlayInstance.setProps.mock.lastCall![0].layers
  expect(layers.map((l: { id: string }) => l.id)).toEqual(['night', 'tracks', 'positions', 'labels'])

  const overlayProps = vi.mocked(MapLibreOverlay).mock.calls[0][0] as {
    onClick: (info: unknown) => void
    onHover: (info: unknown) => void
    pickingRadius: number
  }
  expect(overlayProps.pickingRadius).toBeGreaterThan(0)

  act(() =>
    overlayProps.onHover({ layer: { id: 'tracks' }, object: { noradId: strix9.NORAD_CAT_ID }, coordinate: [0, 0] }),
  )
  expect(overlayInstance.setProps.mock.lastCall![0].layers.map((l: { id: string }) => l.id)).toContain('hover-label')
  act(() => overlayProps.onHover({ layer: null, object: undefined }))
  expect(overlayInstance.setProps.mock.lastCall![0].layers.map((l: { id: string }) => l.id)).not.toContain(
    'hover-label',
  )
  expect(() =>
    act(() => overlayProps.onHover({ layer: { id: 'tracks' }, object: undefined, coordinate: [0, 0] })),
  ).not.toThrow()
  expect(overlayInstance.setProps.mock.lastCall![0].layers.map((l: { id: string }) => l.id)).not.toContain(
    'hover-label',
  )

  const continuation = {
    noradId: strix9.NORAD_CAT_ID,
    family: 'mid-inclination',
    samples: [
      { lonLat: [10, 10], timeMs: 1, altKm: 500 },
      { lonLat: [20, 20], timeMs: 2, altKm: 500 },
    ],
  }
  act(() => overlayProps.onHover({ layer: { id: 'ghost-track' }, object: continuation, coordinate: [19, 19] }))
  expect(overlayInstance.setProps.mock.lastCall![0].layers.map((l: { id: string }) => l.id)).toContain('hover-label')
  overlayProps.onClick({ object: { noradId: strix9.NORAD_CAT_ID } })
  expect(onSelect).toHaveBeenCalledWith(strix9.NORAD_CAT_ID)
  overlayProps.onClick({ object: undefined })
  expect(onSelect).toHaveBeenCalledWith(null)

  unmount()
  expect(mapInstance.remove).toHaveBeenCalled()
})

test("a focus request eases the map to the satellite's current position", () => {
  const sats = [strix1, strix9].map(satelliteFrom)
  const at = epochOf(strix9)
  const { rerender } = render(
    <MapView
      satellites={sats}
      now={at}
      selected={null}
      onSelect={vi.fn()}
      focus={null}
      places={[tokyoPlace]}
      placeId="tokyo"
      onPlaceSelect={vi.fn()}
      onPlaceMove={vi.fn()}
      onPlaceAdd={vi.fn()}
    />,
  )
  expect(mapInstance.easeTo).not.toHaveBeenCalled()

  rerender(
    <MapView
      satellites={sats}
      now={at}
      selected={strix9.NORAD_CAT_ID}
      onSelect={vi.fn()}
      focus={{ noradId: strix9.NORAD_CAT_ID, seq: 1 }}
      places={[tokyoPlace]}
      placeId="tokyo"
      onPlaceSelect={vi.fn()}
      onPlaceMove={vi.fn()}
      onPlaceAdd={vi.fn()}
    />,
  )
  const expected = positionAt(sats[1], at)!
  const { center } = mapInstance.easeTo.mock.lastCall![0]
  expect(center[0]).toBeCloseTo(expected.lon, 6)
  expect(center[1]).toBeCloseTo(expected.lat, 6)
})

test('one pin per place: it reports drags, a tap selects it, a double click adds a place, and a flight centers the map', () => {
  const onPlaceSelect = vi.fn()
  const onPlaceMove = vi.fn()
  const onPlaceAdd = vi.fn()
  const { rerender } = render(
    <MapView
      satellites={[]}
      now={epochOf(strix1)}
      selected={null}
      onSelect={vi.fn()}
      places={[tokyoPlace]}
      placeId="tokyo"
      onPlaceSelect={onPlaceSelect}
      onPlaceMove={onPlaceMove}
      onPlaceAdd={onPlaceAdd}
    />,
  )
  expect(markerInstance.setLngLat).toHaveBeenCalledWith([tokyo.lon, tokyo.lat])
  expect(markerInstance.addTo).toHaveBeenCalledWith(mapInstance)

  markerInstance.lngLat = { lng: 24.94, lat: 60.17 }
  markerInstance.handlers.dragend()
  expect(onPlaceMove).toHaveBeenCalledWith('tokyo', { lat: 60.17, lon: 24.94 })

  markerInstance.element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  expect(onPlaceSelect).toHaveBeenCalledWith('tokyo')

  const dblclick = mapInstance.handlers['dblclick'] as unknown as (e: unknown) => void
  dblclick({ point: { x: 2, y: 1 }, lngLat: { lat: 1, lng: 2 } })
  expect(onPlaceAdd).toHaveBeenLastCalledWith({ lat: 1, lon: 2 }, undefined)
  mapInstance.labels = [
    {
      sourceLayer: 'place',
      properties: { class: 'country', name: 'Finland' },
      geometry: { type: 'Point', coordinates: [3, 1] },
    },
    {
      sourceLayer: 'place',
      properties: { class: 'city', name: 'Helsinki', 'name:en': 'Helsinki' },
      geometry: { type: 'Point', coordinates: [30, 1] },
    },
    {
      sourceLayer: 'place',
      properties: { class: 'town', name: 'Espoo' },
      geometry: { type: 'Point', coordinates: [4, 1] },
    },
    {
      sourceLayer: 'water',
      properties: { class: 'lake', name: 'Nope' },
      geometry: { type: 'Point', coordinates: [2, 1] },
    },
  ]
  dblclick({ point: { x: 2, y: 1 }, lngLat: { lat: 1, lng: 2 } })
  expect(onPlaceAdd).toHaveBeenLastCalledWith({ lat: 1, lon: 2 }, 'Espoo')
  mapInstance.labels = mapInstance.labels.filter(
    (f) => (f as { properties: { class: string } }).properties.class === 'country',
  )
  dblclick({ point: { x: 2, y: 1 }, lngLat: { lat: 1, lng: 2 } })
  expect(onPlaceAdd).toHaveBeenLastCalledWith({ lat: 1, lon: 2 }, 'Finland')

  rerender(
    <MapView
      satellites={[]}
      now={epochOf(strix1)}
      selected={null}
      onSelect={vi.fn()}
      places={[tokyoPlace]}
      placeId="tokyo"
      onPlaceSelect={onPlaceSelect}
      onPlaceMove={onPlaceMove}
      onPlaceAdd={onPlaceAdd}
      flyTo={{ lat: 60.17, lon: 24.94, seq: 1 }}
    />,
  )
  expect(mapInstance.easeTo).toHaveBeenLastCalledWith({ center: [24.94, 60.17], duration: 600 })
})

test('a focus request with a time centers on the position at that time, not the displayed one', () => {
  const sats = [strix1].map(satelliteFrom)
  const displayed = epochOf(strix1)
  const later = displayed.getTime() + 20 * 60_000
  render(
    <MapView
      satellites={sats}
      now={displayed}
      selected={strix1.NORAD_CAT_ID}
      onSelect={vi.fn()}
      focus={{ noradId: strix1.NORAD_CAT_ID, seq: 1, timeMs: later }}
      places={[tokyoPlace]}
      placeId="tokyo"
      onPlaceSelect={vi.fn()}
      onPlaceMove={vi.fn()}
      onPlaceAdd={vi.fn()}
    />,
  )
  const expected = positionAt(sats[0], new Date(later))!
  const { center } = mapInstance.easeTo.mock.lastCall![0]
  expect(center[0]).toBeCloseTo(expected.lon, 6)
  expect(center[1]).toBeCloseTo(expected.lat, 6)
})

test('the projection follows the toggle once the style has loaded and yields to flat past zoom 5.5; the globe lifts deck geometry', () => {
  const sats = [strix1, strix9].map(satelliteFrom)
  const view = (globe: boolean) => (
    <MapView
      satellites={sats}
      now={epochOf(strix1)}
      selected={strix1.NORAD_CAT_ID}
      onSelect={vi.fn()}
      places={[tokyoPlace]}
      placeId="tokyo"
      onPlaceSelect={vi.fn()}
      onPlaceMove={vi.fn()}
      onPlaceAdd={vi.fn()}
      reach
      globe={globe}
    />
  )
  const { rerender } = render(view(false))
  act(() => mapInstance.handlers['style.load']())
  expect(mapInstance.setProjection).toHaveBeenLastCalledWith({ type: 'mercator' })
  expect(mapInstance.addSource).not.toHaveBeenCalled()

  rerender(view(true))
  expect(mapInstance.setProjection).toHaveBeenLastCalledWith({ type: 'globe' })
  mapInstance.zoom = 7
  act(() => mapInstance.handlers['zoom']())
  expect(mapInstance.setProjection).toHaveBeenLastCalledWith({ type: 'mercator' })
  mapInstance.zoom = 3
  act(() => mapInstance.handlers['zoom']())
  expect(mapInstance.setProjection).toHaveBeenLastCalledWith({ type: 'globe' })
  const layers = overlayInstance.setProps.mock.lastCall![0].layers
  expect(layers.map((l: { id: string }) => l.id).slice(0, 3)).toEqual(['night', 'reach', 'tracks'])
  const tracks = layers.find((l: { id: string }) => l.id === 'tracks')
  expect(tracks.props.modelMatrix[14]).toBe(30_000)
})

test('the initial zoom fits the container: the globe to the shorter side, the flat world to the width', () => {
  expect(fitZoom(1400, 900, true)).toBeCloseTo(2.23, 1)
  expect(fitZoom(390, 844, true)).toBeCloseTo(1.02, 1)
  expect(fitZoom(1400, 900, false)).toBeCloseTo(1.22, 1)
  expect(fitZoom(100, 100, true)).toBe(0.5)
  expect(fitZoom(4000, 4000, true)).toBeCloseTo(4.38, 1)
  expect(fitZoom(8000, 8000, true)).toBe(5)
})

test('the visible cap of the globe shrinks as the camera comes closer', () => {
  expect(horizonDeg(2.23, 900)).toBeCloseTo(77, 0)
  expect(horizonDeg(1, 844)).toBeCloseTo(83, 0)
  expect(horizonDeg(5, 900)).toBeLessThan(50)
})

test('a map resize sets the deck viewport to the canvas size without touching the canvas', () => {
  const sats = [strix1, strix9].map(satelliteFrom)
  render(
    <MapView
      satellites={sats}
      now={epochOf(strix1)}
      selected={null}
      onSelect={vi.fn()}
      places={[tokyoPlace]}
      placeId="tokyo"
      onPlaceSelect={vi.fn()}
      onPlaceMove={vi.fn()}
      onPlaceAdd={vi.fn()}
    />,
  )
  const framebuffer = { resize: vi.fn() }
  const surface = {
    cssWidth: 0,
    cssHeight: 0,
    setDrawingBufferSize: vi.fn(),
    getCurrentFramebuffer: () => framebuffer,
  }
  const deck = {
    width: 0,
    height: 0,
    viewManager: { setProps: vi.fn() },
    layerManager: { activateViewport: vi.fn() },
    getViewports: () => ['viewport'],
    userData: { currentViewport: 'stale' } as { currentViewport?: unknown },
    device: { getDefaultCanvasContext: () => surface },
  }
  ;(overlayInstance as unknown as { _deck: unknown })._deck = deck
  act(() => mapInstance.handlers['resize']())
  expect(deck.width).toBe(640)
  expect(deck.height).toBe(480)
  expect(deck.viewManager.setProps).toHaveBeenCalledWith({ width: 640, height: 480 })
  expect(deck.layerManager.activateViewport).toHaveBeenCalledWith('viewport')
  expect([surface.cssWidth, surface.cssHeight]).toEqual([640, 480])
  expect(surface.setDrawingBufferSize).toHaveBeenCalledWith(1280, 960)
  expect(framebuffer.resize).toHaveBeenCalledWith([1280, 960])
  expect(deck.userData.currentViewport).toBeUndefined()
  expect(overlayInstance.setProps).not.toHaveBeenCalledWith(expect.objectContaining({ width: expect.anything() }))
})

test('the horizon is measured on the map: the farthest screen point that round-trips through the projection', () => {
  // A toy globe: orthographic, radius 300 px around the screen center (400, 300), center at 0°N 0°E.
  const R = 300
  const toy = {
    getCenter: () => ({ lng: 0, lat: 0 }),
    getCanvas: () => ({ clientWidth: 800, clientHeight: 600 }),
    project: ([lng, lat]: [number, number]) => ({
      x: 400 + R * Math.sin((lng * Math.PI) / 180) * Math.cos((lat * Math.PI) / 180),
      y: 300 - R * Math.sin((lat * Math.PI) / 180),
    }),
    unproject: ([x, y]: [number, number]) => {
      const nx = Math.max(-1, Math.min(1, (x - 400) / R))
      const ny = Math.max(-1, Math.min(1, (300 - y) / R))
      const lat = Math.asin(ny)
      const lng = Math.asin(Math.max(-1, Math.min(1, nx / Math.cos(lat))))
      return { lng: (lng * 180) / Math.PI, lat: (lat * 180) / Math.PI }
    },
  }
  // An orthographic globe shows exactly 90°; the bisection gets within a fraction of a degree of it.
  expect(measureHorizonDeg(toy, 50)).toBeGreaterThan(85)
  expect(measureHorizonDeg(toy, 50)).toBeLessThanOrEqual(90)
  const flat = { ...toy, project: () => ({ x: NaN, y: NaN }) }
  expect(measureHorizonDeg(flat, 50)).toBe(50)
})
